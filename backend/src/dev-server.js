// Запуск API в режиме разработки: pg-mem + сид данных из макета.
// Использование: node src/dev-server.js  (PORT по умолчанию 3000)
import './seed.js';
await import('./server.js');
