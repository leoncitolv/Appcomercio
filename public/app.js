const state = {
  user: null,
  deferredInstallPrompt: null,
  products: [],
  alerts: [],
  admins: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const money = (value, currency = 'MXN') => {
  if (value === null || value === undefined || value === '') return 'Sin precio';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN'
  }).format(Number(value));
};

const dateText = (value) => {
  if (!value) return 'Sin revisión';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value.replace(' ', 'T') + 'Z'));
};

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Ocurrió un error');
  }
  return payload;
}

async function init() {
  registerServiceWorker();
  setupInstallPrompt();
  bindEvents();

  try {
    const { user } = await api('/api/auth/me');
    state.user = user;
    showApp();
    await refreshAll();
  } catch {
    showLogin();
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    $('#installBtn')?.classList.remove('hidden');
  });
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', onLogout);
  $('#productForm').addEventListener('submit', onCreateProduct);
  $('#adminForm').addEventListener('submit', onCreateAdmin);
  $('#checkAllBtn').addEventListener('click', onCheckAll);
  $('#installBtn').addEventListener('click', onInstall);

  $$('.nav-link').forEach((btn) => {
    btn.addEventListener('click', () => setSection(btn.dataset.section));
  });
}

async function onLogin(event) {
  event.preventDefault();
  $('#loginError').textContent = '';
  const form = new FormData(event.currentTarget);

  try {
    const { user } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password')
      })
    });
    state.user = user;
    showApp();
    await refreshAll();
  } catch (error) {
    $('#loginError').textContent = error.message;
  }
}

async function onLogout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  state.user = null;
  showLogin();
}

async function onCreateProduct(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;

  try {
    await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        title: form.get('title'),
        store: form.get('store'),
        url: form.get('url'),
        targetPrice: form.get('targetPrice'),
        minDiscountPercent: form.get('minDiscountPercent'),
        currency: form.get('currency'),
        imageUrl: form.get('imageUrl'),
        notes: form.get('notes')
      })
    });
    event.currentTarget.reset();
    event.currentTarget.querySelector('[name="minDiscountPercent"]').value = 25;
    toast('Producto guardado');
    await refreshProducts();
    await refreshStats();
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function onCreateAdmin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;

  try {
    await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
        role: 'admin'
      })
    });
    event.currentTarget.reset();
    toast('Administrador creado');
    await refreshAdmins();
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function onCheckAll() {
  const button = $('#checkAllBtn');
  button.disabled = true;
  $('#checkLog').innerHTML = '<div class="log-row">Revisando productos activos...</div>';

  try {
    const { results } = await api('/api/check-all', { method: 'POST' });
    renderCheckLog(results);
    await refreshAll();
    toast('Revisión terminada');
  } catch (error) {
    $('#checkLog').innerHTML = `<div class="log-row">${escapeHtml(error.message)}</div>`;
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

async function onInstall() {
  if (!state.deferredInstallPrompt) {
    toast('Abre el menú del navegador y elige “Agregar a pantalla de inicio”.');
    return;
  }
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  $('#installBtn').classList.add('hidden');
}

function showLogin() {
  $('#loginView').classList.remove('hidden');
  $('#appView').classList.add('hidden');
}

function showApp() {
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  $('#userName').textContent = state.user?.name || 'Admin';
  $('#userEmail').textContent = state.user?.email || '';
  $('#userInitial').textContent = (state.user?.name || 'A').charAt(0).toUpperCase();
}

function setSection(section) {
  $$('.nav-link').forEach((btn) => btn.classList.toggle('active', btn.dataset.section === section));
  $$('.section').forEach((el) => el.classList.toggle('active', el.id === section));
}

async function refreshAll() {
  await Promise.all([refreshStats(), refreshProducts(), refreshAlerts(), refreshAdmins()]);
}

async function refreshStats() {
  const stats = await api('/api/stats');
  $('#statProducts').textContent = stats.products;
  $('#statEnabled').textContent = stats.enabled;
  $('#statAlerts').textContent = stats.alerts;
  $('#statDealsToday').textContent = stats.dealsToday;
  $('#lastCheckText').textContent = stats.lastCheck ? dateText(stats.lastCheck) : 'Sin revisiones';
}

async function refreshProducts() {
  const { products } = await api('/api/products');
  state.products = products;
  renderProducts(products);
}

async function refreshAlerts() {
  const { alerts } = await api('/api/alerts');
  state.alerts = alerts;
  renderAlerts(alerts);
}

async function refreshAdmins() {
  try {
    const { users } = await api('/api/admin/users');
    state.admins = users;
    renderAdmins(users);
  } catch {
    $('#adminsList').innerHTML = '<div class="empty-state">No disponible.</div>';
  }
}

function renderProducts(products) {
  const list = $('#productsList');
  if (!products.length) {
    list.innerHTML = '<div class="empty-state">Aún no tienes productos. Agrega Amazon, Mercado Libre o PlayStation.</div>';
    return;
  }

  list.innerHTML = products
    .map((product) => {
      const emoji = storeEmoji(product.store);
      const img = product.image_url
        ? `<img src="${escapeAttr(product.image_url)}" alt="" loading="lazy" />`
        : emoji;
      const statusBadge = product.enabled
        ? '<span class="badge green">Activo</span>'
        : '<span class="badge gray">Pausado</span>';

      return `
        <article class="product-card" data-id="${product.id}">
          <div class="product-thumb">${img}</div>
          <div>
            <div class="card-top">
              <div>
                <div class="card-title">${escapeHtml(product.title)}</div>
                <div class="card-meta">${escapeHtml(product.storeLabel)} · ${product.last_checked_at ? dateText(product.last_checked_at) : 'Sin revisar'}</div>
              </div>
              ${statusBadge}
            </div>
            <div class="price-row">
              <span class="badge">Actual: ${money(product.last_price, product.last_currency || product.currency)}</span>
              <span class="badge gray">Objetivo: ${money(product.target_price, product.currency)}</span>
              <span class="badge gray">Mínimo: ${money(product.min_price, product.currency)}</span>
              <span class="badge gray">Alertas: ${product.alert_count || 0}</span>
            </div>
            <div class="actions-row">
              <button class="icon-btn" data-action="check">Revisar</button>
              <button class="icon-btn" data-action="toggle">${product.enabled ? 'Pausar' : 'Activar'}</button>
              <a class="icon-btn" href="${escapeAttr(product.url)}" target="_blank" rel="noreferrer">Abrir</a>
              <button class="icon-btn" data-action="delete">Eliminar</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  list.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', onProductAction);
  });
}

async function onProductAction(event) {
  const button = event.currentTarget;
  const card = button.closest('.product-card');
  const id = Number(card.dataset.id);
  const product = state.products.find((item) => item.id === id);
  const action = button.dataset.action;
  button.disabled = true;

  try {
    if (action === 'check') {
      const result = await api(`/api/products/${id}/check`, { method: 'POST' });
      toast(result.isDeal ? `🔥 Oferta: ${result.reason}` : 'Precio registrado');
    }

    if (action === 'toggle') {
      await api(`/api/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !Boolean(product.enabled) })
      });
      toast(product.enabled ? 'Producto pausado' : 'Producto activado');
    }

    if (action === 'delete') {
      const confirmDelete = confirm(`¿Eliminar ${product.title}?`);
      if (!confirmDelete) return;
      await api(`/api/products/${id}`, { method: 'DELETE' });
      toast('Producto eliminado');
    }

    await refreshAll();
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

function renderAlerts(alerts) {
  const list = $('#alertsList');
  if (!alerts.length) {
    list.innerHTML = '<div class="empty-state">Todavía no hay alertas. Cuando haya una oferta fuerte aparecerá aquí.</div>';
    return;
  }

  list.innerHTML = alerts
    .map((alert) => `
      <article class="alert-card">
        <div class="card-top">
          <div>
            <div class="card-title">🔥 ${escapeHtml(alert.title)}</div>
            <div class="card-meta">${escapeHtml(alert.store)} · ${dateText(alert.created_at)}</div>
          </div>
          <span class="badge red">${money(alert.price, alert.currency)}</span>
        </div>
        <p class="card-sub">${escapeHtml(alert.reason)}</p>
        <div class="actions-row">
          <a class="icon-btn" href="${escapeAttr(alert.url)}" target="_blank" rel="noreferrer">Ver oferta</a>
        </div>
      </article>
    `)
    .join('');
}

function renderAdmins(users) {
  const list = $('#adminsList');
  if (!users.length) {
    list.innerHTML = '<div class="empty-state">No hay administradores.</div>';
    return;
  }

  list.innerHTML = users
    .map((user) => `
      <article class="admin-card">
        <div class="card-top">
          <div>
            <div class="card-title">${escapeHtml(user.name)}</div>
            <div class="card-meta">${escapeHtml(user.email)} · ${escapeHtml(user.role)}</div>
          </div>
          <span class="badge ${user.active ? 'green' : 'gray'}">${user.active ? 'Activo' : 'Inactivo'}</span>
        </div>
      </article>
    `)
    .join('');
}

function renderCheckLog(results) {
  if (!results?.length) {
    $('#checkLog').innerHTML = '<div class="log-row">No hay productos activos para revisar.</div>';
    return;
  }

  $('#checkLog').innerHTML = results
    .map((result) => {
      if (!result.ok) {
        return `<div class="log-row">⚠️ Producto #${result.productId}: ${escapeHtml(result.error)}</div>`;
      }
      const icon = result.isDeal ? '🔥' : '✅';
      return `<div class="log-row">${icon} ${escapeHtml(result.productTitle)} · ${money(result.price, result.currency)} · ${escapeHtml(result.reason)}</div>`;
    })
    .join('');
}

function storeEmoji(store) {
  const normalized = String(store || '').toLowerCase();
  if (normalized.includes('amazon')) return '📦';
  if (normalized.includes('mercado')) return '🛒';
  if (normalized.includes('play')) return '🎮';
  return '🏷️';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

init();
