
const supabaseUrl = "TU_SUPABASE_URL";
const supabaseKey = "TU_SUPABASE_ANON_KEY";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let products = [];

async function loadProducts(){
  const { data } = await supabase.from('products').select('*');
  products = data || [];

  applyAdvancedComparison(products);
  render(products);
}

loadProducts();

function render(list){
  const c = document.getElementById("productGrid");

  c.innerHTML = list.map(p => `
    <div class="card ${p.best ? 'best' : ''}">
      <img src="${p.image || ''}" />
      <h3>${p.title}</h3>
      <p>$${p.price}</p>
      <small>${p.store}</small>
      ${p.best ? '<div class="badge">🔥 MEJOR OFERTA</div>' : ''}
    </div>
  `).join('');
}
