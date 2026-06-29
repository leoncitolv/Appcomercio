import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { db, initDatabase } from './db.js';
import {
  clearAuthCookie,
  createToken,
  hashPassword,
  requireAuth,
  requireCronSecret,
  setAuthCookie,
  verifyPassword
} from './auth.js';
import { checkAllProducts, checkSingleProduct, displayStore, normalizeStore } from './priceChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

initDatabase();

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: config.appName, now: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const user = db
    .prepare('SELECT * FROM users WHERE email = ? AND active = 1')
    .get(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }

  const publicUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  const token = createToken(publicUser);
  setAuthCookie(res, token);
  return res.json({ user: publicUser });
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/stats', requireAuth, (_req, res) => {
  const products = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;
  const enabled = db.prepare('SELECT COUNT(*) AS total FROM products WHERE enabled = 1').get().total;
  const alerts = db.prepare('SELECT COUNT(*) AS total FROM alerts').get().total;
  const dealsToday = db
    .prepare("SELECT COUNT(*) AS total FROM alerts WHERE date(created_at) = date('now')")
    .get().total;

  const lastCheck = db
    .prepare('SELECT MAX(checked_at) AS last_check FROM price_history')
    .get().last_check;

  res.json({ products, enabled, alerts, dealsToday, lastCheck });
});

app.get('/api/products', requireAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT
      p.*,
      (
        SELECT ph.price FROM price_history ph
        WHERE ph.product_id = p.id
        ORDER BY ph.checked_at DESC, ph.id DESC
        LIMIT 1
      ) AS last_price,
      (
        SELECT ph.currency FROM price_history ph
        WHERE ph.product_id = p.id
        ORDER BY ph.checked_at DESC, ph.id DESC
        LIMIT 1
      ) AS last_currency,
      (
        SELECT ph.checked_at FROM price_history ph
        WHERE ph.product_id = p.id
        ORDER BY ph.checked_at DESC, ph.id DESC
        LIMIT 1
      ) AS last_checked_at,
      (
        SELECT MIN(ph.price) FROM price_history ph
        WHERE ph.product_id = p.id
      ) AS min_price,
      (
        SELECT COUNT(*) FROM alerts a
        WHERE a.product_id = p.id
      ) AS alert_count
    FROM products p
    ORDER BY p.created_at DESC
  `).all();

  res.json({ products: rows.map((row) => ({ ...row, storeLabel: displayStore(row.store) })) });
});

app.post('/api/products', requireAuth, (req, res) => {
  const title = String(req.body.title || '').trim();
  const url = String(req.body.url || '').trim();
  const store = normalizeStore(req.body.store || 'other');
  const targetPrice = req.body.targetPrice === '' ? null : Number(req.body.targetPrice || 0) || null;
  const minDiscountPercent = Number(req.body.minDiscountPercent || 25);
  const currency = String(req.body.currency || 'MXN').toUpperCase();
  const imageUrl = String(req.body.imageUrl || '').trim() || null;
  const notes = String(req.body.notes || '').trim() || null;

  if (!title || !url) {
    return res.status(400).json({ error: 'Falta nombre del producto o URL' });
  }

  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'La URL debe iniciar con http:// o https://' });
  }

  const result = db.prepare(`
    INSERT INTO products
      (title, store, url, image_url, target_price, min_discount_percent, currency, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, store, url, imageUrl, targetPrice, minDiscountPercent, currency, notes, req.user.id);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ product });
});

app.patch('/api/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const title = req.body.title !== undefined ? String(req.body.title).trim() : existing.title;
  const url = req.body.url !== undefined ? String(req.body.url).trim() : existing.url;
  const store = req.body.store !== undefined ? normalizeStore(req.body.store) : existing.store;
  const targetPrice = req.body.targetPrice !== undefined ? Number(req.body.targetPrice || 0) || null : existing.target_price;
  const minDiscountPercent = req.body.minDiscountPercent !== undefined ? Number(req.body.minDiscountPercent || 25) : existing.min_discount_percent;
  const currency = req.body.currency !== undefined ? String(req.body.currency || 'MXN').toUpperCase() : existing.currency;
  const enabled = req.body.enabled !== undefined ? Number(Boolean(req.body.enabled)) : existing.enabled;
  const imageUrl = req.body.imageUrl !== undefined ? String(req.body.imageUrl || '').trim() || null : existing.image_url;
  const notes = req.body.notes !== undefined ? String(req.body.notes || '').trim() || null : existing.notes;

  db.prepare(`
    UPDATE products
    SET title = ?, store = ?, url = ?, image_url = ?, target_price = ?, min_discount_percent = ?, currency = ?, enabled = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, store, url, imageUrl, targetPrice, minDiscountPercent, currency, enabled, notes, id);

  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(id) });
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.post('/api/products/:id/check', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  try {
    const result = await checkSingleProduct(product, { notify: true });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id/history', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const history = db
    .prepare('SELECT * FROM price_history WHERE product_id = ? ORDER BY checked_at DESC, id DESC LIMIT 80')
    .all(id);
  res.json({ history });
});

app.get('/api/alerts', requireAuth, (_req, res) => {
  const alerts = db.prepare(`
    SELECT a.*, p.title, p.store, p.url
    FROM alerts a
    JOIN products p ON p.id = a.product_id
    ORDER BY a.created_at DESC
    LIMIT 80
  `).all();
  res.json({ alerts });
});

app.post('/api/check-all', requireAuth, async (_req, res) => {
  try {
    const results = await checkAllProducts({ notify: true });
    res.json({ ok: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cron/check', requireCronSecret, async (_req, res) => {
  try {
    const results = await checkAllProducts({ notify: true });
    res.json({ ok: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administrador' });

  const users = db
    .prepare('SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC')
    .all();
  res.json({ users });
});

app.post('/api/admin/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administrador' });

  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = String(req.body.role || 'admin').trim();

  if (!name || !email || password.length < 8) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña de mínimo 8 caracteres son obligatorios' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(name, email, hashPassword(password), role);

    const user = db
      .prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json({ user });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ese correo ya existe' });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administrador' });

  const id = Number(req.params.id);
  if (id === req.user.id && req.body.active === false) {
    return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

  const name = req.body.name !== undefined ? String(req.body.name).trim() : existing.name;
  const active = req.body.active !== undefined ? Number(Boolean(req.body.active)) : existing.active;

  db.prepare('UPDATE users SET name = ?, active = ? WHERE id = ?').run(name, active, id);

  const user = db
    .prepare('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?')
    .get(id);
  res.json({ user });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(config.port, () => {
  console.log(`${config.appName} corriendo en http://localhost:${config.port}`);
});
