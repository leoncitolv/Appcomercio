import * as cheerio from 'cheerio';
import { db } from './db.js';
import { config } from './config.js';
import { notifyDeal } from './notifications.js';

const STORE_NAMES = {
  amazon: 'Amazon',
  mercadolibre: 'Mercado Libre',
  playstation: 'PlayStation Store',
  other: 'Otra tienda'
};

export function normalizeStore(store) {
  const value = String(store || '').toLowerCase().trim();
  if (value.includes('amazon')) return 'amazon';
  if (value.includes('mercado') || value.includes('ml')) return 'mercadolibre';
  if (value.includes('play') || value.includes('psn') || value.includes('sony')) return 'playstation';
  return value || 'other';
}

export function displayStore(store) {
  return STORE_NAMES[normalizeStore(store)] || store || 'Otra tienda';
}

export async function checkAllProducts({ notify = true } = {}) {
  const products = db
    .prepare('SELECT * FROM products WHERE enabled = 1 ORDER BY id DESC')
    .all();

  const results = [];
  for (const product of products) {
    try {
      const result = await checkSingleProduct(product, { notify });
      results.push(result);
    } catch (error) {
      results.push({ productId: product.id, ok: false, error: error.message });
    }
  }
  return results;
}

export async function checkSingleProduct(product, { notify = true } = {}) {
  const store = normalizeStore(product.store);
  let priceResult;

  if (store === 'mercadolibre') {
    priceResult = await getMercadoLibrePrice(product.url);
  } else if (store === 'amazon') {
    priceResult = await getAmazonPrice(product.url);
  } else if (store === 'playstation') {
    priceResult = await getPlayStationPrice(product.url);
  } else {
    priceResult = await getGenericPrice(product.url);
  }

  if (!priceResult?.price) {
    throw new Error('No pude detectar precio en la página. Revisa el link o usa API oficial para esa tienda.');
  }

  const previous = getLatestPrice(product.id);
  const minRecord = getMinPrice(product.id);

  const insert = db.prepare(`
    INSERT INTO price_history (product_id, price, currency, source, raw_title)
    VALUES (?, ?, ?, ?, ?)
  `).run(product.id, priceResult.price, priceResult.currency || product.currency || 'MXN', priceResult.source, priceResult.title);

  const deal = evaluateDeal({
    product,
    currentPrice: priceResult.price,
    currency: priceResult.currency || product.currency || 'MXN',
    previousPrice: previous?.price,
    minPrice: minRecord?.price
  });

  let alert = null;
  if (deal.isDeal) {
    const alertRun = db.prepare(`
      INSERT INTO alerts (product_id, price, previous_price, currency, reason, sent)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(
      product.id,
      priceResult.price,
      previous?.price || null,
      priceResult.currency || product.currency || 'MXN',
      deal.reason
    );

    alert = { id: alertRun.lastInsertRowid, reason: deal.reason };

    if (notify) {
      await notifyDeal({
        product,
        price: {
          price: priceResult.price,
          currency: priceResult.currency || product.currency || 'MXN'
        },
        previousPrice: previous?.price,
        reason: deal.reason,
        alertId: alert.id
      });
      db.prepare('UPDATE alerts SET sent = 1 WHERE id = ?').run(alert.id);
    }
  }

  db.prepare('UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(product.id);

  return {
    ok: true,
    productId: product.id,
    productTitle: product.title,
    store: displayStore(product.store),
    historyId: insert.lastInsertRowid,
    price: priceResult.price,
    currency: priceResult.currency || product.currency || 'MXN',
    previousPrice: previous?.price || null,
    isDeal: deal.isDeal,
    reason: deal.reason,
    alert
  };
}

function evaluateDeal({ product, currentPrice, currency, previousPrice, minPrice }) {
  const reasons = [];
  const targetPrice = Number(product.target_price || 0);
  const minDiscountPercent = Number(product.min_discount_percent || config.strongDropPercent || 25);

  if (targetPrice > 0 && currentPrice <= targetPrice) {
    reasons.push(`Llegó a tu precio objetivo: ${formatMoney(currentPrice, currency)} <= ${formatMoney(targetPrice, currency)}`);
  }

  if (previousPrice && previousPrice > currentPrice) {
    const drop = percentageDrop(previousPrice, currentPrice);
    if (drop >= minDiscountPercent) {
      reasons.push(`Bajó ${drop.toFixed(1)}% contra la revisión anterior`);
    }
  }

  if (minPrice && currentPrice < minPrice) {
    reasons.push('Es el precio más bajo registrado en tu historial');
  }

  return {
    isDeal: reasons.length > 0,
    reason: reasons[0] || 'Sin alerta: precio registrado correctamente'
  };
}

function getLatestPrice(productId) {
  return db
    .prepare('SELECT price, currency, checked_at FROM price_history WHERE product_id = ? ORDER BY checked_at DESC, id DESC LIMIT 1')
    .get(productId);
}

function getMinPrice(productId) {
  return db
    .prepare('SELECT MIN(price) AS price FROM price_history WHERE product_id = ?')
    .get(productId);
}

function percentageDrop(previous, current) {
  if (!previous || previous <= 0) return 0;
  return ((previous - current) / previous) * 100;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': config.defaultUserAgent,
      'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`La tienda respondió ${response.status}`);
  }

  return await response.text();
}

async function getMercadoLibrePrice(url) {
  const id = extractMercadoLibreItemId(url);
  if (id) {
    const apiUrl = `https://api.mercadolibre.com/items/${id}`;
    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': config.defaultUserAgent }
    });

    if (response.ok) {
      const item = await response.json();
      if (item.price) {
        return {
          price: Number(item.price),
          currency: item.currency_id || 'MXN',
          title: item.title,
          source: 'mercadolibre-api'
        };
      }
    }
  }

  return await getGenericPrice(url, 'mercadolibre-html');
}

function extractMercadoLibreItemId(url) {
  const clean = String(url || '').replaceAll('-', '').toUpperCase();
  const match = clean.match(/MLM\d{6,}/);
  return match ? match[0] : null;
}

async function getAmazonPrice(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const title = cleanText($('#productTitle').first().text()) || cleanText($('title').text());
  const priceText =
    $('#corePrice_feature_div .a-offscreen').first().text() ||
    $('#priceblock_ourprice').first().text() ||
    $('#priceblock_dealprice').first().text() ||
    $('.a-price .a-offscreen').first().text() ||
    $('meta[property="product:price:amount"]').attr('content');

  const price = parsePrice(priceText);
  return {
    price,
    currency: detectCurrency(priceText) || 'MXN',
    title,
    source: 'amazon-html'
  };
}

async function getPlayStationPrice(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text() ||
    $('title').text();

  const candidates = [
    $('meta[property="product:price:amount"]').attr('content'),
    $('meta[name="twitter:data1"]').attr('content'),
    $('[data-qa="mfeCtaMain#offer0#finalPrice"]').first().text(),
    $('[class*="finalPrice"]').first().text(),
    $('span').filter((_, el) => /\$|MXN|USD/.test($(el).text())).first().text()
  ].filter(Boolean);

  const priceText = candidates.find((value) => parsePrice(value));
  const price = parsePrice(priceText);

  return {
    price,
    currency: detectCurrency(priceText) || 'MXN',
    title: cleanText(title),
    source: 'playstation-html'
  };
}

async function getGenericPrice(url, source = 'generic-html') {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text() ||
    $('title').text();

  const metaPrice =
    $('meta[property="product:price:amount"]').attr('content') ||
    $('meta[itemprop="price"]').attr('content') ||
    $('[itemprop="price"]').attr('content') ||
    $('[itemprop="price"]').first().text();

  let priceText = metaPrice;

  if (!parsePrice(priceText)) {
    const likely = $('body')
      .text()
      .match(/(?:MXN|USD|\$)\s?[0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.\d{2})?/i);
    priceText = likely ? likely[0] : '';
  }

  return {
    price: parsePrice(priceText),
    currency: detectCurrency(priceText) || 'MXN',
    title: cleanText(title),
    source
  };
}

export function parsePrice(value) {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\s/g, '')
    .replace(/MXN|USD|US\$|\$|,/gi, '')
    .replace(/[^0-9.]/g, '');

  if (!text) return null;
  const parts = text.split('.');
  let normalized = text;
  if (parts.length > 2) {
    const cents = parts.pop();
    normalized = `${parts.join('')}.${cents}`;
  }

  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function detectCurrency(value) {
  const text = String(value || '').toUpperCase();
  if (text.includes('USD') || text.includes('US$')) return 'USD';
  if (text.includes('MXN') || text.includes('$')) return 'MXN';
  return null;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatMoney(value, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN'
  }).format(Number(value || 0));
}
