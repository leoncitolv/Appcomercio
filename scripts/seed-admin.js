import { initDatabase } from '../src/db.js';
import { config } from '../src/config.js';

initDatabase();
console.log(`Admin inicial listo: ${config.adminEmail}`);
