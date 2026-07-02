
// ===============================
// ADVANCED COMPARATOR ENGINE v2
// ===============================

// normalize text
function normalize(t){
  return (t || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

// similarity score (advanced fuzzy match)
function similarity(a,b){
  const aWords = normalize(a).split(' ');
  const bWords = normalize(b).split(' ');

  let match = 0;

  aWords.forEach(w => {
    if(bWords.includes(w)) match++;
  });

  return match / Math.max(aWords.length, bWords.length);
}

// detect best product clusters
function applyAdvancedComparison(products){

  const clusters = [];

  products.forEach(p => {

    let found = false;

    for(let c of clusters){
      if(similarity(p.title, c.base.title) > 0.6){
        c.items.push(p);
        found = true;
        break;
      }
    }

    if(!found){
      clusters.push({
        base: p,
        items: [p]
      });
    }
  });

  clusters.forEach(c => {

    if(c.items.length > 1){

      let cheapest = c.items.reduce((min,p)=>
        p.price < min.price ? p : min
      );

      c.items.forEach(p => {
        p.best = (p === cheapest);
      });

    } else {
      c.items[0].best = false;
    }

  });
}
