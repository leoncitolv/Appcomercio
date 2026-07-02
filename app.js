const stores = {
  aliexpress: { name: "AliExpress" },
  amazon: { name: "Amazon" },
  mercadolibre: { name: "Mercado Libre" }
};

let products = [
  { title: "Audífonos Bluetooth", price: 199, store: "aliexpress", image: "https://via.placeholder.com/150", url: "#" },
  { title: "Mouse Gamer", price: 350, store: "amazon", image: "https://via.placeholder.com/150", url: "#" },
  { title: "Teclado Mecánico", price: 599, store: "mercadolibre", image: "https://via.placeholder.com/150", url: "#" }
];

function render(list){
  const container = document.getElementById("productGrid");
  container.innerHTML = list.map(p => `
    <div class="card">
      <img src="${p.image}" />
      <div class="badge">${stores[p.store].name}</div>
      <h3>${p.title}</h3>
      <p>$${p.price}</p>
      <a href="${p.url}" target="_blank">Ver</a>
    </div>
  `).join("");
}

function filterByStore(store){
  render(products.filter(p => p.store === store));
}

function filterAll(){
  render(products);
}

render(products);
