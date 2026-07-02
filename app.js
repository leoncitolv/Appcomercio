// ======================
// SUPABASE CONFIG
// ======================
const supabaseUrl = "https://ltsrjxvisptbdhhkabhj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0c3JqeHZpc3B0YmRoaGthYmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzExMjksImV4cCI6MjA5ODQwNzEyOX0.9StxmpDTM9UVprgAG8xJ8sw7i23huuPHcZ-pkR8WTEE";

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ======================
// DATA
// ======================
let products = [];

// ======================
// LOAD FROM SUPABASE
// ======================
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*');

  if (error) {
    console.log("Error:", error);
    return;
  }

  products = data;
  render(products);
}

loadProducts();

// ======================
// REALTIME SYNC
// ======================
supabase
  .channel('products-channel')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'products' },
    () => {
      loadProducts();
    }
  )
  .subscribe();

// ======================
// STORES
// ======================
const stores = {
  aliexpress: { name: "AliExpress" },
  amazon: { name: "Amazon" },
  mercadolibre: { name: "Mercado Libre" }
};

// ======================
// RENDER
// ======================
function render(list){
  const container = document.getElementById("productGrid");

  container.innerHTML = list.map(p => `
    <div class="card">
      <img src="${p.image}" />
      <div class="badge">${stores[p.store]?.name || p.store}</div>
      <h3>${p.title}</h3>
      <p>$${p.price}</p>
      <a href="${p.url}" target="_blank">Ver producto</a>
    </div>
  `).join("");
}

// ======================
// FILTERS
// ======================
function filterByStore(store){
  render(products.filter(p => p.store === store));
}

function filterAll(){
  render(products);
}
