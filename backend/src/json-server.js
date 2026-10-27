// json-server.js — «база данных» проекта на json-server (файл backend/db/db.json).
//
// ВАЖНО: не запускайте отдельно `npx json-server` и `npm run dev` на одном порту —
// второй процесс падает с EADDRINUSE, и тогда сайт ходит в «сырую» базу без
// бизнес-логики (пустые dropdown «Мастер»/«Время», 404 на входе в админку).
// Этот файл поднимает ВСЁ ОДНИМ процессом:
//   - полноценный API (Express): /api/public/*, /api/admin/*, авторизация, слоты;
//   - коллекции json-server (/users, /masters, /services, ...) для прямой работы с базой.
//
// Запуск:  npm run db   (или npm run dev / npm start — то же самое)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import jsonServer from 'json-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Порт по умолчанию 3000 (его ждут vite-прокси фронтенда и сам сайт).
const RAW_PORT = Number.parseInt(process.env.PORT ?? '', 10);
const PORT = Number.isFinite(RAW_PORT) && RAW_PORT > 0 ? RAW_PORT : 3000;

// 1) Полноценное API приложения (импортируется сервер, но НЕ слушает порт,
//    пока запущен из этого файла — см. end of server.js).
const { app: apiApp } = await import('./server.js');

const root = express();
root.use(apiApp); // все /api/*, /health и статика dist — здесь

// 2) Коллекции json-server поверх той же базы db.json (низкоуровневый CRUD).
try {
  const DB_FILE = path.join(__dirname, '..', 'db', 'db.json');
  if (fs.existsSync(DB_FILE)) {
    const server = jsonServer.create();
    server.use(jsonServer.defaults({ static: false }));
    // "root" — базовый путь (/db/*), чтобы коллекции не перекрывали маршруты API.
    server.use(jsonServer.router({ root: '/db', source: DB_FILE, _id: false }));
    root.use(server);
    console.log('[json-server] collections available under /db/* (e.g. GET /db/masters)');
  } else {
    console.warn('[json-server] db/db.json not found — run "npm run migrate" first');
  }
} catch (e) {
  console.warn('[json-server] raw collections disabled:', e.message);
}

const listener = root.listen(PORT, () => {
  console.log(`Astra DB+API (json-server + Express) on http://localhost:${PORT}`);
  console.log(`  API:        /api/public/* , /api/admin/*`);
  console.log(`  JSON base:  /db/<collection>  (users, masters, services, bookings, ...)`);
});

// Понятная ошибка вместо «молчаливого» падения, если порт уже занят вторым запуском.
listener.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[ERROR] Порт ${PORT} уже занят. Скорее всего, вы запустили сервер дважды\n` +
      `(например, и "npm run dev", и "npm run json-server"). Достаточно ОДНОЙ команды:\n` +
      `    npm run dev          (в каталоге backend)\n` +
      `Остановите лишние процессы и повторите.\n`
    );
    process.exit(1);
  }
  throw err;
});
