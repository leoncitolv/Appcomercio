// DealWatch MX / Appcomercio
// Fase 11: monitor automático básico con GitHub Actions + Supabase REST API.
// No hace scraping todavía. Evalúa reglas ya guardadas: precio objetivo y descuento mínimo.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = process.env.DEALWATCH_MODE || "rules_only";

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

    for (const product of products || []) {
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
        raw: { mode: MODE, checkedBy: "github_actions" },
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
          raw: { mode: MODE, checkedBy: "github_actions", productUrl: product.product_url || null },
        });
      }
    }

    for (const group of chunk(results)) {
      if (group.length) await insert("monitor_results", group);
    }

    for (const group of chunk(alertEvents)) {
      if (group.length) await insert("alert_events", group);
    }

    await patch(`monitor_runs`, `id=eq.${runId}`, {
      status: "success",
      checked_count: results.length,
      offers_count: results.filter(r => r.is_offer).length,
      message: `Revisión completada. ${results.length} producto(s), ${results.filter(r => r.is_offer).length} oferta(s).`,
      finished_at: new Date().toISOString(),
    });

    console.log(`DealWatch MX OK: ${results.length} productos revisados, ${alertEvents.length} alerta(s) nueva(s).`);
  } catch (error) {
    await patch(`monitor_runs`, `id=eq.${runId}`, {
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
