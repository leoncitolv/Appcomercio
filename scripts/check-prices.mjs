// DealWatch MX / Appcomercio
// Fase 24: monitor automático con GitHub Actions + Supabase REST API.
// Revisa reglas, Telegram, historial, Eneba, Mercado Libre, AliExpress manual seguro y estado visual del precio.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = process.env.DEALWATCH_MODE || "rules_only";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TELEGRAM_TEST = String(process.env.TELEGRAM_TEST || "false").toLowerCase() === "true";
const FORCE_SEND_OFFERS = String(process.env.FORCE_SEND_OFFERS || "false").toLowerCase() === "true";
const AUTO_FETCH_ENEBA = String(process.env.AUTO_FETCH_ENEBA || "true").toLowerCase() === "true";
const AUTO_FETCH_MERCADOLIBRE = String(process.env.AUTO_FETCH_MERCADOLIBRE || "true").toLowerCase() === "true";
const AUTO_FETCH_ALIEXPRESS = String(process.env.AUTO_FETCH_ALIEXPRESS || "false").toLowerCase() === "true";
const PRICE_HISTORY_ENABLED = String(process.env.PRICE_HISTORY_ENABLED || "true").toLowerCase() === "true";

if (!SUPABASE_URL) {
  throw new Error("Falta SUPABASE_URL.");
}

if (!SERVICE_ROLE_KEY) {
  throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en GitHub Secrets.");
}

const REST_URL = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;

function headers(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function rest(path, options = {}) {
  const res = await fetch(`${REST_URL}/${path}`, {
    ...options,
    headers: headers(options.headers || {}),
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`Supabase REST ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }

  return data;
}

async function insert(table, rows) {
  return rest(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
}

async function patch(table, filter, body) {
  return rest(`${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
}

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function discountPercent(normalPrice, currentPrice) {
  const normal = toNumber(normalPrice);
  const current = toNumber(currentPrice);

  if (normal <= 0 || current <= 0 || current >= normal) {
    return 0;
  }

  return Math.round(((normal - current) / normal) * 10000) / 100;
}

function analyzeProduct(product) {
  const normal = toNumber(product.normal_price);
  const current = toNumber(product.current_price);
  const target = toNumber(product.target_price);
  const minDiscount = toNumber(product.min_discount_percent);
  const discount = discountPercent(normal, current);

  const meetsTarget = current > 0 && target > 0 && current <= target;
  const meetsDiscount = minDiscount > 0 && discount >= minDiscount;
  const isOffer = Boolean(meetsTarget || meetsDiscount);

  const reasons = [];
  if (meetsTarget) reasons.push(`precio actual <= precio objetivo (${current} <= ${target})`);
  if (meetsDiscount) reasons.push(`descuento ${discount}% >= mínimo ${minDiscount}%`);

  return {
    discount,
    isOffer,
    reason: reasons.length ? reasons.join(" y ") : "Aún no cumple reglas de oferta",
  };
}

function chunk(items, size = 100) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function isEnebaProduct(product) {
  const store = String(product.store || "").toLowerCase();
  const url = String(product.product_url || "").toLowerCase();
  return store.includes("eneba") || url.includes("eneba.com");
}


function isAliExpressProduct(product) {
  const store = String(product.store || "").toLowerCase();
  const url = String(product.product_url || "").toLowerCase();

  return (
    store.includes("aliexpress") ||
    url.includes("aliexpress.com") ||
    url.includes("aliexpress.us") ||
    url.includes("aliexpress.com.mx")
  );
}

function isMercadoLibreProduct(product) {
  const store = String(product.store || "").toLowerCase();
  const url = String(product.product_url || "").toLowerCase();

  return (
    store.includes("mercado libre") ||
    store.includes("mercadolibre") ||
    url.includes("mercadolibre.com") ||
    url.includes("mercadolibre.com.mx") ||
    url.includes("articulo.mercadolibre")
  );
}

function normalizeMercadoLibreId(value) {
  const id = String(value || "").replace(/-/g, "").toUpperCase().trim();
  return /^ML[A-Z]{1,2}\d{6,}$/.test(id) ? id : "";
}

function extractMercadoLibreId(value) {
  const text = decodeURIComponent(String(value || ""));

  const patterns = [
    /[?&](?:wid|item_id)=((?:ML[A-Z]{1,2})-?\d{6,})/i,
    /\/((?:ML[A-Z]{1,2})-?\d{6,})(?:[/?#_\-]|$)/i,
    /((?:ML[A-Z]{1,2})-?\d{6,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const id = match ? normalizeMercadoLibreId(match[1]) : "";
    if (id) return id;
  }

  return "";
}

function parsePriceText(value) {
  if (value == null) return 0;

  let raw = String(value)
    .trim()
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, "")
    .replace(/[^0-9.,]/g, "");

  if (!raw) return 0;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");

    raw = lastDot > lastComma
      ? raw.replace(/,/g, "")
      : raw.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    const parts = raw.split(",");

    if (parts.length > 1 && parts.slice(1).every(part => part.length === 3)) {
      raw = parts.join("");
    } else {
      raw = raw.replace(/,/g, ".");
    }
  } else if (hasDot) {
    const parts = raw.split(".");

    if (parts.length > 1 && parts.slice(1).every(part => part.length === 3)) {
      raw = parts.join("");
    }
  }

  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function isSuspiciousFetchedPrice(fetchedPrice, product) {
  const fetched = toNumber(fetchedPrice);
  const current = toNumber(product.current_price);
  const normal = toNumber(product.normal_price);
  const target = toNumber(product.target_price);
  const reference = Math.max(current, normal, target);

  if (fetched <= 0) return true;

  if (reference >= 100 && fetched < 10) return true;
  if (reference >= 500 && fetched < 50 && fetched < reference * 0.05) return true;

  return false;
}

function findFirstPrice(html) {
  const patterns = [
    /"price"\s*:\s*"?([0-9][0-9.,]*)"?/i,
    /"priceAmount"\s*:\s*"?([0-9][0-9.,]*)"?/i,
    /"amount"\s*:\s*"?([0-9][0-9.,]*)"?/i,
    /(?:MX\$|MXN|\$)\s*([0-9][0-9.,]*)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const price = match ? parsePriceText(match[1]) : 0;
    if (price > 0) return price;
  }

  return 0;
}

async function fetchEnebaPrice(productUrl) {
  if (!productUrl || !String(productUrl).startsWith("http")) return null;

  const res = await fetch(productUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DealWatchMX/1.0; +https://github.com/leoncitolv/Appcomercio)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Eneba HTTP ${res.status}`);
  }

  const html = await res.text();
  const price = findFirstPrice(html);
  return price > 0 ? price : null;
}

async function fetchUrlForMercadoLibreId(productUrl) {
  const res = await fetch(productUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DealWatchMX/1.0; +https://github.com/leoncitolv/Appcomercio)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Mercado Libre HTTP ${res.status}`);
  }

  const finalUrl = res.url || productUrl;
  let id = extractMercadoLibreId(finalUrl);
  let html = "";

  if (!id) {
    html = await res.text();
    id = extractMercadoLibreId(html);
  }

  return { id, html, finalUrl };
}

async function fetchMercadoLibrePrice(productUrl) {
  if (!productUrl || !String(productUrl).startsWith("http")) return null;

  let id = extractMercadoLibreId(productUrl);
  let fallbackHtml = "";
  let finalUrl = productUrl;
  let apiError = "";

  if (!id) {
    const resolved = await fetchUrlForMercadoLibreId(productUrl);
    id = resolved.id;
    fallbackHtml = resolved.html || "";
    finalUrl = resolved.finalUrl || productUrl;
  }

  if (id) {
    const apiUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(id)}`;

    try {
      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent": "DealWatchMX/1.0",
          "Accept": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        const price = toNumber(data.price);

        if (price > 0) {
          return {
            price,
            source: "mercadolibre_api",
            itemId: id,
            title: data.title || null,
            currency: data.currency_id || null,
            finalUrl,
          };
        }
      } else {
        apiError = `Mercado Libre API ${res.status} para ${id}`;
        console.warn(`${apiError}. Se intentará fallback HTML y, si no se puede, se conservará el precio manual guardado.`);
      }
    } catch (error) {
      apiError = `Mercado Libre API error para ${id}: ${error.message}`;
      console.warn(`${apiError}. Se intentará fallback HTML y, si no se puede, se conservará el precio manual guardado.`);
    }
  }

  if (!fallbackHtml) {
    try {
      const resolved = await fetchUrlForMercadoLibreId(productUrl);
      fallbackHtml = resolved.html || "";
      finalUrl = resolved.finalUrl || productUrl;
      if (!id && resolved.id) id = resolved.id;
    } catch (error) {
      if (apiError) {
        throw new Error(`${apiError}; fallback HTML no disponible: ${error.message}`);
      }
      throw error;
    }
  }

  const fallbackPrice = findFirstPrice(fallbackHtml);
  return fallbackPrice > 0
    ? {
        price: fallbackPrice,
        source: "mercadolibre_html_fallback",
        itemId: id || null,
        title: null,
        currency: "MXN",
        finalUrl,
        apiError: apiError || null,
      }
    : null;
}

async function applyFetchedPrice(product, fetchedPrice, source, label, extraRaw = {}) {
  const enriched = { ...product };

  if (!fetchedPrice || fetchedPrice <= 0) {
    return enriched;
  }

  if (isSuspiciousFetchedPrice(fetchedPrice, product)) {
    enriched.raw_price_error = `Precio ${label} sospechoso ignorado: ${fetchedPrice}`;
    console.warn(`Precio ${label} sospechoso ignorado para ${product.name || product.id}: ${fetchedPrice}`);
    return enriched;
  }

  enriched.current_price = fetchedPrice;
  enriched.raw_price_source = source;
  enriched.raw_price_meta = extraRaw;

  if (fetchedPrice !== toNumber(product.current_price)) {
    await patch("products", `id=eq.${product.id}`, {
      current_price: fetchedPrice,
      updated_at: new Date().toISOString(),
    }).catch(error => {
      console.warn(`No se pudo actualizar precio ${label} en Supabase para ${product.id}:`, error.message);
    });
  }

  return enriched;
}

async function enrichProductPrice(product) {
  let enriched = { ...product };

  if (AUTO_FETCH_MERCADOLIBRE && isMercadoLibreProduct(product)) {
    try {
      const fetched = await fetchMercadoLibrePrice(product.product_url);

      if (fetched?.price) {
        enriched = await applyFetchedPrice(
          product,
          fetched.price,
          fetched.source || "mercadolibre_auto_fetch",
          "Mercado Libre",
          {
            itemId: fetched.itemId || null,
            title: fetched.title || null,
            currency: fetched.currency || null,
            finalUrl: fetched.finalUrl || product.product_url || null,
          }
        );
      }
    } catch (error) {
      enriched.raw_price_source = "stored_price";
      enriched.raw_price_error = error.message;
      console.warn(`No se pudo leer precio Mercado Libre para ${product.name || product.id}; se conserva precio manual:`, error.message);
    }

    return enriched;
  }

  if (isAliExpressProduct(product)) {
    enriched.raw_price_source = "aliexpress_manual_safe";

    if (AUTO_FETCH_ALIEXPRESS) {
      enriched.raw_price_error = "AliExpress automático pendiente de API oficial/afiliado. Usando precio guardado manualmente.";
      console.warn(`AliExpress automático aún no implementado para ${product.name || product.id}; se usa precio guardado.`);
    }

    return enriched;
  }

  if (AUTO_FETCH_ENEBA && isEnebaProduct(product)) {
    try {
      const fetchedPrice = await fetchEnebaPrice(product.product_url);
      enriched = await applyFetchedPrice(product, fetchedPrice, "eneba_auto_fetch", "Eneba");
    } catch (error) {
      enriched.raw_price_error = error.message;
      console.warn(`No se pudo leer precio Eneba para ${product.name || product.id}:`, error.message);
    }
  }

  return enriched;
}


function buildPriceStatus(product) {
  const source = String(product.raw_price_source || "stored_price");
  const error = String(product.raw_price_error || "").trim();
  const store = String(product.store || "").toLowerCase();
  const checkedAt = new Date().toISOString();

  const status = {
    code: "manual_safe",
    label: "Precio manual seguro",
    tone: "info",
    icon: "🔵",
    reason: "Tienda en modo manual seguro. Actualiza el precio cuando lo revises.",
    source,
    error: error || null,
    checkedAt,
  };

  if (source === "mercadolibre_api") {
    return {
      ...status,
      code: "auto_updated",
      label: "Precio automático actualizado",
      tone: "success",
      icon: "✅",
      reason: "Actualizado desde Mercado Libre API.",
    };
  }

  if (source === "mercadolibre_html_fallback") {
    return {
      ...status,
      code: "auto_updated_fallback",
      label: "Precio automático actualizado",
      tone: "success",
      icon: "✅",
      reason: "Actualizado desde fallback HTML de Mercado Libre.",
    };
  }

  if (source === "eneba_auto_fetch") {
    return {
      ...status,
      code: "auto_updated",
      label: "Precio automático actualizado",
      tone: "success",
      icon: "✅",
      reason: "Actualizado desde lectura automática de Eneba.",
    };
  }

  if (source === "aliexpress_manual_safe") {
    return {
      ...status,
      code: "manual_safe",
      label: "Precio manual seguro",
      tone: "info",
      icon: "🔵",
      reason: error || "AliExpress está en modo manual seguro para evitar bloqueos o precios falsos.",
    };
  }

  if (error && /sospechoso|suspicious/i.test(error)) {
    return {
      ...status,
      code: "suspicious_ignored",
      label: "Precio sospechoso ignorado",
      tone: "warning",
      icon: "🟠",
      reason: error,
    };
  }

  if (error && (store.includes("mercado") || store.includes("mercadolibre"))) {
    return {
      ...status,
      code: "manual_conserved",
      label: "Precio manual conservado",
      tone: "warning",
      icon: "🟡",
      reason: "Mercado Libre bloqueó la lectura o el producto no está disponible. Se conservó el precio manual guardado.",
    };
  }

  if (error) {
    return {
      ...status,
      code: "manual_conserved",
      label: "Precio manual conservado",
      tone: "warning",
      icon: "🟡",
      reason: error,
    };
  }

  if (store.includes("mercado") || store.includes("mercadolibre") || store.includes("eneba")) {
    return {
      ...status,
      code: "auto_pending",
      label: "Precio automático pendiente",
      tone: "neutral",
      icon: "⚪",
      reason: "Aún no hay una lectura automática registrada en el historial.",
    };
  }

  return status;
}

function buildPriceHistoryRow(product, runId) {
  const current = toNumber(product.current_price);

  // La tabla price_history de esta instalación tiene user_id como obligatorio.
  // Si no viene user_id, se omite ese registro para no romper todo el lote.
  if (!PRICE_HISTORY_ENABLED || !product.workspace_id || !product.user_id || !product.id || current <= 0) {
    return null;
  }

  const normal = toNumber(product.normal_price);

  return {
    user_id: product.user_id,
    workspace_id: product.workspace_id,
    product_id: product.id,
    product_name: product.name || "Producto sin nombre",
    store: product.store || "Tienda",
    product_url: product.product_url || null,

    // Compatibilidad con las 2 versiones de price_history:
    // - Fase 22 limpia: usa price, normal_price, target_price.
    // - Instalaciones previas: pueden exigir old_price/new_price como NOT NULL.
    price: current,
    old_price: normal > 0 ? normal : current,
    new_price: current,
    normal_price: normal,
    target_price: toNumber(product.target_price),

    source: product.raw_price_source || "github_actions",
    checked_at: new Date().toISOString(),
    raw: {
      runId,
      checkedBy: "github_actions",
      mode: MODE,
      userId: product.user_id,
      priceSource: product.raw_price_source || "stored_price",
      priceError: product.raw_price_error || null,
      priceMeta: product.raw_price_meta || null,
      priceStatus: buildPriceStatus(product),
    },
  };
}

async function insertPriceHistory(rows) {
  if (!PRICE_HISTORY_ENABLED || !rows.length) return { inserted: 0, skipped: true };

  try {
    await insert("price_history", rows);
    return { inserted: rows.length, skipped: false };
  } catch (error) {
    console.warn("Historial de precios no disponible. Ejecuta SUPABASE_SQL_FASE22_HISTORIAL_PRECIOS.sql:", error.message);
    return { inserted: 0, skipped: true, error: error.message };
  }
}

function escapeTelegramHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatMoney(value) {
  const number = toNumber(value);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(number);
}

function telegramIsConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}

async function sendTelegramMessage(text) {
  if (!telegramIsConfigured()) {
    return { skipped: true, reason: "Telegram no configurado" };
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    throw new Error(`Telegram API ${res.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

function buildTelegramOfferMessage(alertEvent) {
  const title = escapeTelegramHtml(alertEvent.title || "Oferta detectada");
  const message = escapeTelegramHtml(alertEvent.message || "Regla de oferta cumplida.");
  const current = formatMoney(alertEvent.current_price);
  const target = formatMoney(alertEvent.target_price);
  const discount = toNumber(alertEvent.discount_percent);
  const productUrl = alertEvent.raw?.productUrl || "";
  const linkLine = productUrl && String(productUrl).startsWith("http")
    ? `\n\n🔗 <a href="${escapeTelegramHtml(productUrl)}">Abrir producto</a>`
    : "";

  return [
    "🔥 <b>DealWatch MX · Oferta detectada</b>",
    "",
    `<b>${title}</b>`,
    message,
    "",
    `💰 Precio actual: <b>${escapeTelegramHtml(current)}</b>`,
    `🎯 Precio objetivo: <b>${escapeTelegramHtml(target)}</b>`,
    `🏷️ Descuento: <b>${escapeTelegramHtml(discount)}%</b>`,
    linkLine,
  ].join("\n");
}

async function sendTelegramTestMessage() {
  if (!telegramIsConfigured()) {
    throw new Error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en GitHub Secrets.");
  }

  return sendTelegramMessage([
    "✅ <b>DealWatch MX · Telegram conectado</b>",
    "",
    "El bot ya puede enviar alertas al grupo familiar/amigos.",
    `Fecha de prueba: ${escapeTelegramHtml(new Date().toLocaleString("es-MX"))}`,
  ].join("\n"));
}

async function main() {
  const startedAt = new Date().toISOString();
  const runRows = await insert("monitor_runs", [{
    source: "github_actions",
    mode: MODE,
    status: "running",
    started_at: startedAt,
    message: "Iniciando revisión automática de reglas guardadas.",
  }]);

  const run = Array.isArray(runRows) ? runRows[0] : runRows;
  const runId = run.id;

  try {
    if (TELEGRAM_TEST) {
      await sendTelegramTestMessage();
      console.log("Telegram: mensaje de prueba enviado correctamente.");
    }

    const products = await rest(
      "products?select=id,workspace_id,user_id,name,store,product_url,normal_price,current_price,target_price,min_discount_percent,alerts_enabled,updated_at&alerts_enabled=eq.true&order=updated_at.desc&limit=1000"
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentAlerts = await rest(
      `alert_events?select=product_id,current_price,event_type,created_at&event_type=eq.offer_detected&created_at=gte.${encodeURIComponent(since)}`
    ).catch(() => []);

    const recentKeys = new Set(
      (Array.isArray(recentAlerts) ? recentAlerts : [])
        .map(a => `${a.product_id}:${Number(a.current_price || 0)}`)
    );

    const results = [];
    const alertEvents = [];
    const priceHistoryRows = [];

    for (const originalProduct of products || []) {
      const product = await enrichProductPrice(originalProduct);
      const analysis = analyzeProduct(product);
      const historyRow = buildPriceHistoryRow(product, runId);

      if (historyRow) priceHistoryRows.push(historyRow);

      results.push({
        run_id: runId,
        workspace_id: product.workspace_id,
        product_id: product.id,
        product_name: product.name,
        store: product.store,
        product_url: product.product_url,
        normal_price: toNumber(product.normal_price),
        current_price: toNumber(product.current_price),
        target_price: toNumber(product.target_price),
        min_discount_percent: toNumber(product.min_discount_percent),
        discount_percent: analysis.discount,
        is_offer: analysis.isOffer,
        alert_reason: analysis.reason,
        raw: {
          mode: MODE,
          checkedBy: "github_actions",
          forceSendOffers: FORCE_SEND_OFFERS,
          priceSource: product.raw_price_source || "stored_price",
          priceError: product.raw_price_error || null,
          priceStatus: buildPriceStatus(product),
        },
        checked_at: new Date().toISOString(),
      });

      const alertKey = `${product.id}:${toNumber(product.current_price)}`;

      if (
        analysis.isOffer &&
        product.workspace_id &&
        (FORCE_SEND_OFFERS || !recentKeys.has(alertKey))
      ) {
        alertEvents.push({
          workspace_id: product.workspace_id,
          product_id: product.id,
          event_type: "offer_detected",
          title: `Oferta detectada: ${product.name}`,
          message: `${product.store || "Tienda"}: ${analysis.reason}`,
          current_price: toNumber(product.current_price),
          target_price: toNumber(product.target_price),
          discount_percent: analysis.discount,
          status: "new",
          raw: {
            mode: MODE,
            checkedBy: "github_actions",
            forceSendOffers: FORCE_SEND_OFFERS,
            productUrl: product.product_url || null,
            priceSource: product.raw_price_source || "stored_price",
            priceError: product.raw_price_error || null,
            priceStatus: buildPriceStatus(product),
          },
        });
      }
    }

    for (const group of chunk(results)) {
      if (group.length) await insert("monitor_results", group);
    }

    let historyInserted = 0;
    let historySkipped = false;

    for (const group of chunk(priceHistoryRows)) {
      if (group.length) {
        const historyResult = await insertPriceHistory(group);
        historyInserted += historyResult.inserted || 0;
        historySkipped = historySkipped || Boolean(historyResult.skipped);
      }
    }

    for (const group of chunk(alertEvents)) {
      if (group.length) await insert("alert_events", group);
    }

    let telegramSent = 0;
    let telegramErrors = 0;

    if (telegramIsConfigured()) {
      for (const alertEvent of alertEvents.slice(0, 20)) {
        try {
          await sendTelegramMessage(buildTelegramOfferMessage(alertEvent));
          telegramSent += 1;
        } catch (telegramError) {
          telegramErrors += 1;
          console.warn("No se pudo enviar Telegram:", telegramError.message);
        }
      }
    } else if (alertEvents.length) {
      console.log("Telegram no configurado: se omitió envío de alertas.");
    }

    const offerCount = results.filter(r => r.is_offer).length;
    const newAlertCount = alertEvents.length;

    const telegramSummary = telegramIsConfigured()
      ? ` Telegram: ${telegramSent} enviado(s)${telegramErrors ? `, ${telegramErrors} error(es)` : ""}.`
      : " Telegram no configurado.";

    const historySummary = PRICE_HISTORY_ENABLED
      ? ` Historial: ${historyInserted} registro(s)${historySkipped ? " (pendiente ejecutar SQL Fase 22 o revisar permisos)" : ""}.`
      : " Historial desactivado.";

    await patch("monitor_runs", `id=eq.${runId}`, {
      status: "success",
      checked_count: results.length,
      offers_count: offerCount,
      message: `Revisión completada. ${results.length} producto(s), ${offerCount} oferta(s), ${newAlertCount} alerta(s) enviada(s)/registrada(s).${FORCE_SEND_OFFERS ? " Modo forzado activo." : ""}${telegramSummary}${historySummary}`,
      finished_at: new Date().toISOString(),
    });

    console.log(
      `DealWatch MX OK Fase 25 Estado Visual Precio: ${results.length} productos revisados, ${offerCount} oferta(s), ${alertEvents.length} alerta(s) para notificar, ${telegramSent} Telegram, ${historyInserted} historial. Force=${FORCE_SEND_OFFERS}`
    );
  } catch (error) {
    await patch("monitor_runs", `id=eq.${runId}`, {
      status: "error",
      error_message: error.message,
      finished_at: new Date().toISOString(),
    }).catch(() => undefined);

    throw error;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
