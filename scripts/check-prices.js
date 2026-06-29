import { initDatabase } from '../src/db.js';
import { checkAllProducts } from '../src/priceChecker.js';

initDatabase();

const results = await checkAllProducts({ notify: true });
console.log(JSON.stringify({ ok: true, results }, null, 2));
