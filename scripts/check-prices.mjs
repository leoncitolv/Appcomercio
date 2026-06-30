// DealWatch MX / Appcomercio
// Fase 13.1: monitoreo automático con Mercado Libre México + reglas + Telegram.
// Lee productos desde Supabase, intenta obtener precio real para links de Mercado Libre,
// actualiza current_price, guarda historial, evalúa alertas y manda Telegram.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = process.env.DEALWATCH_MODE || "mercadolibre_auto_telegram";
const LIVE_PRICES = String(process.env.DEALWATCH_LIVE_PRICES ?? "true").toLowerCase() === "true";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TELEGRAM_TEST = String(process.env.TELEGRAM_TEST || "false").toLowerCase() === "true";

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
  const liveLine = alertEvent.raw?.livePriceSource
    ? `\n🔎 Fuente: <b>${escapeTelegramHtml(alertEvent.raw.livePriceSource)}</b>`
    : "";
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
    `🏷️ Descuento: <b>${escapeTelegramHtml(discount)}%</b>${liveLine}`,
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
    "Fase 13.1 lista: el robot puede revisar Mercado Libre y enviar alertas al grupo.",
    `Fecha de prueba: ${escapeTelegramHtml(new Date().toLocaleString("es-MX"))}`,
  ].join("\n"));
}

function isMercadoLibreProduct(product) {
  const store = String(product.store || "").toLowerCase();
  const url = String(product.product_url || "").toLowerCase();

  return store.includes("mercado") || url.includes("mercadolibre") || url.includes("mercadolivre");
}

function extractMercadoLibreItemId(url) {
  const text = decodeURIComponent(String(url || ""));

  // URLs comunes:
  // https://articulo.mercadolibre.com.mx/MLM-1234567890-nombre...
  // https://www.mercadolibre.com.mx/.../p/MLM1234567890
  // https://.../MLM1234567890
  const match = text.match(/\b(ML[A-Z]{1,3})[-_ ]?(\d{5,})\b/i);

  if (!match) {
    return null;
  }

  return `${match[1].toUpperCase()}${match[2]}`;
}

async function fetchMercadoLibrePrice(product) {
  const productUrl = String(product.product_url || "").trim();
  const itemId = extractMercadoLibreItemId(productUrl);

  if (!itemId) {
    return {
      ok: false,
      supported: false,
      source: "mercadolibre",
      reason: "No se encontró ID de publicación Mercado Libre en el link.",
    };
  }

  const attributes = [
    "id",
    "title",
    "price",
    "original_price",
    "currency_id",
    "permalink",
    "status",
    "site_id",
    "thumbnail",
    "available_quantity",
    "sold_quantity",
  ].join(",");

  const apiUrl = `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}?attributes=${encodeURIComponent(attributes)}`;
  const res = await fetch(apiUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DealWatchMX/1.0 (+https://github.com/laraclv/dealwatch-mx)",
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      ok: false,
      supported: true,
      source: "mercadolibre",
      itemId,
      reason: `Mercado Libre API ${res.status}: ${JSON.stringify(data)}`,
    };
  }

  const price = toNumber(data?.price);

  if (price <= 0) {
    return {
      ok: false,
      supported: true,
      source: "mercadolibre",
      itemId,
      reason: "La API no regresó un precio válido.",
      raw: data,
    };
  }

  return {
    ok: true,
    supported: true,
    source: "mercadolibre",
    itemId,
    title: data.title || product.name,
    price,
    originalPrice: toNumber(data.original_price),
    currencyId: data.currency_id || "MXN",
    permalink: data.permalink || product.product_url || "",
    status: data.status || "unknown",
    siteId: data.site_id || "MLM",
    raw: data,
  };
}

async function maybeUpdateLivePrice(product) {
  const base = {
    product,
    updated: false,
    previousPrice: toNumber(product.current_price),
    newPrice: toNumber(product.current_price),
    source: "manual_rules",
    message: "Producto revisado con precio guardado.",
    live: null,
  };

  if (!LIVE_PRICES) {
    return {
      ...base,
      source: "live_prices_disabled",
      message: "Extracción de precios reales desactivada para esta ejecución.",
    };
  }

  if (!isMercadoLibreProduct(product)) {
    return base;
  }

  const live = await fetchMercadoLibrePrice(product);
  base.live = live;
  base.source = "mercadolibre";

  if (!live.ok) {
    return {
      ...base,
      message: live.reason || "No se pudo obtener precio real de Mercado Libre.",
    };
  }

  const previousPrice = toNumber(product.current_price);
  const newPrice = toNumber(live.price);
  const normalPrice = live.originalPrice > 0 ? live.originalPrice : toNumber(product.normal_price);

  const updatedProduct = {
    ...product,
    name: product.name || live.title,
    current_price: newPrice,
    normal_price: normalPrice,
    product_url: live.permalink || product.product_url,
  };

  const priceChanged = Math.abs(previousPrice - newPrice) >= 0.01;
  const normalChanged = normalPrice > 0 && Math.abs(toNumber(product.normal_price) - normalPrice) >= 0.01;
  const permalinkChanged = live.permalink && live.permalink !== product.product_url;

  if (priceChanged || normalChanged || permalinkChanged) {
    const productPatch = {
      current_price: newPrice,
      normal_price: normalPrice,
      product_url: live.permalink || product.product_url,
      updated_at: new Date().toISOString(),
    };

    await patch("products", `id=eq.${encodeURIComponent(product.id)}`, productPatch);

    if (priceChanged) {
      await insert("price_history", [{
        product_id: product.id,
        workspace_id: product.workspace_id || null,
        user_id: product.user_id,
        previous_price: previousPrice,
        new_price: newPrice,
        source: "mercadolibre_auto",
        note: `Precio automático desde Mercado Libre (${live.itemId}).`,
      }]);
    }
  }

  return {
    product: updatedProduct,
    updated: priceChanged,
    previousPrice,
    newPrice,
    source: "mercadolibre",
    message: priceChanged
      ? `Precio actualizado desde Mercado Libre: ${previousPrice} → ${newPrice}`
      : "Precio Mercado Libre sin cambios.",
    live,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const runRows = await insert("monitor_runs", [{
    source: "github_actions",
    mode: MODE,
    status: "running",
    started_at: startedAt,
    message: LIVE_PRICES
      ? "Iniciando revisión automática con Mercado Libre + reglas guardadas."
      : "Iniciando revisión automática solo con reglas guardadas.",
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

    const recentKeys = new Set((Array.isArray(recentAlerts) ? recentAlerts : []).map(a => `${a.product_id}:${Number(a.current_price || 0)}`));

    const results = [];
    const alertEvents = [];
    let mercadoLibreChecked = 0;
    let mercadoLibreUpdated = 0;
    let mercadoLibreErrors = 0;

    for (const originalProduct of products || []) {
      let product = originalProduct;
      let liveUpdate = null;

      try {
        liveUpdate = await maybeUpdateLivePrice(originalProduct);
        product = liveUpdate.product;

        if (liveUpdate.source === "mercadolibre") {
          mercadoLibreChecked += 1;
          if (liveUpdate.updated) mercadoLibreUpdated += 1;
          if (liveUpdate.live && !liveUpdate.live.ok) mercadoLibreErrors += 1;
        }
      } catch (liveError) {
        mercadoLibreErrors += isMercadoLibreProduct(originalProduct) ? 1 : 0;
        liveUpdate = {
          product: originalProduct,
          updated: false,
          source: isMercadoLibreProduct(originalProduct) ? "mercadolibre" : "manual_rules",
          message: liveError.message,
          live: { ok: false, reason: liveError.message },
        };
        product = originalProduct;
        console.warn(`No se pudo actualizar precio real para ${originalProduct.name}:`, liveError.message);
      }

      const analysis = analyzeProduct(product);

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
          livePrices: LIVE_PRICES,
          livePriceSource: liveUpdate?.source || "manual_rules",
          livePriceUpdated: Boolean(liveUpdate?.updated),
          livePriceMessage: liveUpdate?.message || null,
          mercadoLibreItemId: liveUpdate?.live?.itemId || null,
          mercadoLibreStatus: liveUpdate?.live?.status || null,
          mercadoLibreCurrency: liveUpdate?.live?.currencyId || null,
        },
        checked_at: new Date().toISOString(),
      });

      const alertKey = `${product.id}:${toNumber(product.current_price)}`;
      if (analysis.isOffer && product.workspace_id && !recentKeys.has(alertKey)) {
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
            productUrl: product.product_url || null,
            livePriceSource: liveUpdate?.source || "manual_rules",
            livePriceUpdated: Boolean(liveUpdate?.updated),
            mercadoLibreItemId: liveUpdate?.live?.itemId || null,
          },
        });
      }
    }

    for (const group of chunk(results)) {
      if (group.length) await insert("monitor_results", group);
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
    const telegramSummary = telegramIsConfigured()
      ? ` Telegram: ${telegramSent} enviado(s)${telegramErrors ? `, ${telegramErrors} error(es)` : ""}.`
      : " Telegram no configurado.";
    const mercadoLibreSummary = LIVE_PRICES
      ? ` Mercado Libre: ${mercadoLibreChecked} revisado(s), ${mercadoLibreUpdated} actualizado(s)${mercadoLibreErrors ? `, ${mercadoLibreErrors} error(es)` : ""}.`
      : " Precios reales desactivados.";

    await patch("monitor_runs", `id=eq.${runId}`, {
      status: "success",
      checked_count: results.length,
      offers_count: offerCount,
      message: `Revisión completada. ${results.length} producto(s), ${offerCount} oferta(s).${mercadoLibreSummary}${telegramSummary}`,
      finished_at: new Date().toISOString(),
    });

    console.log(`DealWatch MX OK: ${results.length} productos revisados, ${alertEvents.length} alerta(s) nueva(s), ${mercadoLibreUpdated} precio(s) ML actualizado(s), ${telegramSent} Telegram.`);
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
