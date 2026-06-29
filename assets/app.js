const STORAGE_KEY = "appcomercio_state_v1";
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const money = (value) => Number(value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const nowISO = () => new Date().toISOString();

const defaultState = {
  admin: null,
  products: []
};

function loadState() {
  try { return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return { ...defaultState }; }
}
function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
let state = loadState();

async function hash(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}
function show(view) {
  $("loginView").classList.toggle("hidden", view !== "login");
  $("dashboardView").classList.toggle("hidden", view !== "dashboard");
}
function initAuthView() {
  const hasAdmin = !!state.admin?.pinHash;
  $("setupBox").classList.toggle("hidden", hasAdmin);
  $("loginBox").classList.toggle("hidden", !hasAdmin);
  show(sessionStorage.getItem("appcomercio_auth") === "true" && hasAdmin ? "dashboard" : "login");
  if (hasAdmin) renderDashboard();
}

$("setupBtn").addEventListener("click", async () => {
  const name = $("setupName").value.trim() || "Admin";
  const pin = $("setupPin").value.trim();
  if (pin.length < 4) return toast("Usa un PIN de mínimo 4 dígitos.");
  state.admin = { name, pinHash: await hash(pin), createdAt: nowISO() };
  saveState(state);
  sessionStorage.setItem("appcomercio_auth", "true");
  toast("Acceso creado.");
  initAuthView();
});

$("loginBtn").addEventListener("click", async () => {
  const pin = $("loginPin").value.trim();
  if (await hash(pin) !== state.admin?.pinHash) return toast("PIN incorrecto.");
  sessionStorage.setItem("appcomercio_auth", "true");
  toast("Bienvenido.");
  initAuthView();
});
$("resetBtn").addEventListener("click", () => {
  if (!confirm("¿Restablecer esta app local? Se borrarán productos y PIN.")) return;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem("appcomercio_auth");
  state = loadState();
  initAuthView();
});
$("logoutBtn").addEventListener("click", () => { sessionStorage.removeItem("appcomercio_auth"); initAuthView(); });

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-page").forEach(p => p.classList.toggle("active", p.id === `${name}Tab`));
}
document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
document.querySelectorAll(".go-add").forEach(btn => btn.addEventListener("click", () => switchTab("add")));

function getStatus(product) {
  const regular = Number(product.regularPrice || 0);
  const current = Number(product.currentPrice || 0);
  const target = Number(product.targetPrice || 0);
  const minDiscount = Number(product.discount || 0);
  const discount = regular > 0 && current > 0 ? Math.round(((regular - current) / regular) * 100) : 0;
  const historicalLow = Math.min(...(product.history || []).map(h => Number(h.price)).filter(Boolean), current || Infinity);
  const good = current > 0 && ((target > 0 && current <= target) || (discount >= minDiscount && minDiscount > 0) || current <= historicalLow);
  let reason = "Precio en observación";
  if (good && target > 0 && current <= target) reason = "Oferta buena: llegó a tu precio objetivo";
  else if (good && discount >= minDiscount) reason = `Oferta buena: ${discount}% de descuento`;
  else if (good) reason = "Oferta buena: iguala el menor precio guardado";
  return { good, discount, reason, historicalLow };
}
function renderDashboard() {
  $("adminName").textContent = state.admin?.name || "admin";
  $("adminNameInput").value = state.admin?.name || "";
  renderProducts();
}
function renderProducts() {
  const list = $("productList");
  list.innerHTML = "";
  const q = $("searchInput").value.toLowerCase().trim();
  const store = $("storeFilter").value;
  const products = state.products.filter(p => {
    const matchesText = [p.name, p.store, p.category].join(" ").toLowerCase().includes(q);
    const matchesStore = store === "all" || p.store === store;
    return matchesText && matchesStore;
  });
  const goodCount = state.products.filter(p => getStatus(p).good).length;
  $("goodDealsCount").textContent = goodCount;
  $("emptyState").classList.toggle("hidden", state.products.length !== 0);
  for (const product of products) list.appendChild(productCard(product));
}
function productCard(product) {
  const tpl = $("productTemplate").content.cloneNode(true);
  const article = tpl.querySelector("article");
  const status = getStatus(product);
  tpl.querySelector(".store-badge").textContent = product.store;
  tpl.querySelector("h3").textContent = product.name;
  tpl.querySelector(".category").textContent = product.category || "Sin categoría";
  tpl.querySelector(".current").textContent = money(product.currentPrice);
  tpl.querySelector(".target").textContent = money(product.targetPrice);
  const statusEl = tpl.querySelector(".status");
  statusEl.textContent = status.reason;
  statusEl.classList.add(status.good ? "good" : "normal");
  const history = tpl.querySelector(".mini-history");
  const values = (product.history || []).slice(-10).map(h => Number(h.price)).filter(Boolean);
  const max = Math.max(...values, Number(product.currentPrice || 0), 1);
  values.forEach(value => {
    const bar = document.createElement("span");
    bar.className = "bar";
    bar.style.height = `${Math.max(8, (value / max) * 38)}px`;
    history.appendChild(bar);
  });
  tpl.querySelector(".open-link").href = product.url;
  tpl.querySelector(".menu-btn").addEventListener("click", () => editProduct(product.id));
  tpl.querySelector(".update-price").addEventListener("click", () => updatePrice(product.id));
  tpl.querySelector(".delete").addEventListener("click", () => deleteProduct(product.id));
  return article;
}

$("searchInput").addEventListener("input", renderProducts);
$("storeFilter").addEventListener("change", renderProducts);

function formToProduct(existing = {}) {
  const currentPrice = Number($("currentPriceInput").value || 0);
  const history = existing.history || [];
  if (currentPrice > 0 && currentPrice !== Number(existing.currentPrice || 0)) history.push({ price: currentPrice, date: nowISO() });
  return {
    ...existing,
    id: existing.id || crypto.randomUUID(),
    name: $("nameInput").value.trim(),
    store: $("storeInput").value,
    category: $("categoryInput").value.trim(),
    url: $("urlInput").value.trim(),
    regularPrice: Number($("regularPriceInput").value || 0),
    currentPrice,
    targetPrice: Number($("targetPriceInput").value || 0),
    discount: Number($("discountInput").value || 25),
    notes: $("notesInput").value.trim(),
    updatedAt: nowISO(),
    history
  };
}
$("productForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("editingId").value;
  if (id) {
    const idx = state.products.findIndex(p => p.id === id);
    state.products[idx] = formToProduct(state.products[idx]);
  } else {
    state.products.unshift(formToProduct());
  }
  saveState(state);
  clearForm();
  renderProducts();
  switchTab("products");
  toast("Producto guardado.");
  const saved = state.products[0];
  if (saved && getStatus(saved).good) notify(`Oferta buena: ${saved.name}`, `${money(saved.currentPrice)} en ${saved.store}`);
});
function editProduct(id) {
  const p = state.products.find(item => item.id === id);
  if (!p) return;
  $("editingId").value = p.id;
  $("nameInput").value = p.name;
  $("storeInput").value = p.store;
  $("categoryInput").value = p.category || "";
  $("urlInput").value = p.url;
  $("regularPriceInput").value = p.regularPrice || "";
  $("currentPriceInput").value = p.currentPrice || "";
  $("targetPriceInput").value = p.targetPrice || "";
  $("discountInput").value = p.discount || 25;
  $("notesInput").value = p.notes || "";
  $("formTitle").textContent = "Editar producto";
  switchTab("add");
}
function clearForm() {
  $("productForm").reset();
  $("editingId").value = "";
  $("discountInput").value = 25;
  $("formTitle").textContent = "Agregar producto";
}
$("clearFormBtn").addEventListener("click", clearForm);
async function updatePrice(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  const value = prompt(`Nuevo precio para ${product.name}:`, product.currentPrice || "");
  if (value === null) return;
  const price = Number(String(value).replace(/,/g, ""));
  if (!price || price <= 0) return toast("Precio inválido.");
  product.currentPrice = price;
  product.updatedAt = nowISO();
  product.history = product.history || [];
  product.history.push({ price, date: nowISO() });
  saveState(state);
  renderProducts();
  const status = getStatus(product);
  toast(status.reason);
  if (status.good) notify(`Oferta buena: ${product.name}`, `${money(price)} en ${product.store}`);
}
function deleteProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product || !confirm(`¿Eliminar ${product.name}?`)) return;
  state.products = state.products.filter(p => p.id !== id);
  saveState(state);
  renderProducts();
  toast("Producto eliminado.");
}

$("saveAdminBtn").addEventListener("click", async () => {
  state.admin.name = $("adminNameInput").value.trim() || state.admin.name;
  const newPin = $("newPinInput").value.trim();
  if (newPin) {
    if (newPin.length < 4) return toast("El PIN debe tener mínimo 4 dígitos.");
    state.admin.pinHash = await hash(newPin);
    $("newPinInput").value = "";
  }
  saveState(state);
  renderDashboard();
  toast("Administrador actualizado.");
});
$("exportBtn").addEventListener("click", () => {
  const data = JSON.stringify({ exportedAt: nowISO(), state }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `appcomercio-respaldo-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$("importInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const json = JSON.parse(await file.text());
  if (!json.state?.products) return toast("Archivo no válido.");
  state.products = json.state.products;
  saveState(state);
  renderProducts();
  toast("Productos importados.");
});
$("wipeProductsBtn").addEventListener("click", () => {
  if (!confirm("¿Borrar todos los productos?")) return;
  state.products = [];
  saveState(state);
  renderProducts();
});

async function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "icons/icon-192.png" }); } catch {}
}
$("notifyBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) return toast("Este navegador no soporta notificaciones locales.");
  const permission = await Notification.requestPermission();
  toast(permission === "granted" ? "Notificaciones activadas." : "No se activaron las notificaciones.");
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  $("installBtn").classList.remove("hidden");
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").classList.add("hidden");
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}

initAuthView();
