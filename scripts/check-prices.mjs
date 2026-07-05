// DealWatch MX / Appcomercio
// Fase 11: monitor automático básico con GitHub Actions + Supabase REST API.
// No hace scraping todavía. Evalúa reglas ya guardadas: precio objetivo y descuento mínimo.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = process.env.DEALWATCH_MODE || "rules_only";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TELEGRAM_TEST = String(process.env.TELEGRAM_TEST || "false").toLowerCase() === "true";
const FORCE_SEND_OFFERS = String(process.env.FORCE_SEND_OFFERS || "false").toLowerCase() === "true";
const AUTO_FETCH_ENEBA = String(process.env.AUTO_FETCH_ENEBA || "true").toLowerCase() === "true";

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

    // 1,099.99 -> 1099.99
    // 1.099,99 -> 1099.99
    raw = lastDot > lastComma
      ? raw.replace(/,/g, "")
      : raw.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    const parts = raw.split(",");

    // 1,099 / 12,999 / 1,099,999 -> miles, no decimales
    if (parts.length > 1 && parts.slice(1).every(part => part.length === 3)) {
      raw = parts.join("");
    } else {
      // 1099,99 -> decimal europeo
      raw = raw.replace(/,/g, ".");
    }
  } else if (hasDot) {
    const parts = raw.split(".");

    // 1.099 / 12.999 / 1.099.999 -> miles, no decimales
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
  if (reference >= 100 && fetched < reference * 0.1) return true;

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

async function enrichProductPrice(product) {
  const enriched = { ...product };

  if (!AUTO_FETCH_ENEBA || !isEnebaProduct(product)) {
    return enriched;
  }

  try {
    const fetchedPrice = await fetchEnebaPrice(product.product_url);

    if (fetchedPrice && fetchedPrice > 0) {
      if (isSuspiciousFetchedPrice(fetchedPrice, product)) {
        enriched.raw_price_error = `Precio Eneba sospechoso ignorado: ${fetchedPrice}`;
        console.warn(`Precio Eneba sospechoso ignorado para ${product.name || product.id}: ${fetchedPrice}`);
        return enriched;
      }

      enriched.current_price = fetchedPrice;
      enriched.raw_price_source = "eneba_auto_fetch";

      if (fetchedPrice !== toNumber(product.current_price)) {
        await patch("products", `id=eq.${product.id}`, {
          current_price: fetchedPrice,
          updated_at: new Date().toISOString(),
        }).catch(error => {
          console.warn(`No se pudo actualizar precio Eneba en Supabase para ${product.id}:`, error.message);
        });
      }
    }
  } catch (error) {
    enriched.raw_price_error = error.message;
    console.warn(`No se pudo leer precio Eneba para ${product.name || product.id}:`, error.message);
  }

  return enriched;
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

    for (const originalProduct of products || []) {
      const product = await enrichProductPrice(originalProduct);
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
          forceSendOffers: FORCE_SEND_OFFERS,
          priceSource: product.raw_price_source || "stored_price",
          priceError: product.raw_price_error || null,
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
    const newAlertCount = alertEvents.length;
    const telegramSummary = telegramIsConfigured()
      ? ` Telegram: ${telegramSent} enviado(s)${telegramErrors ? `, ${telegramErrors} error(es)` : ""}.`
      : " Telegram no configurado.";

    await patch("monitor_runs", `id=eq.${runId}`, {
      status: "success",
      checked_count: results.length,
      offers_count: offerCount,
      message: `Revisión completada. ${results.length} producto(s), ${offerCount} oferta(s), ${newAlertCount} alerta(s) enviada(s)/registrada(s).${FORCE_SEND_OFFERS ? " Modo forzado activo." : ""}${telegramSummary}`,
      finished_at: new Date().toISOString(),
    });

    console.log(
      `DealWatch MX OK: ${results.length} productos revisados, ${offerCount} oferta(s), ${alertEvents.length} alerta(s) para notificar, ${telegramSent} Telegram. Force=${FORCE_SEND_OFFERS}`
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
