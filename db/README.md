# База данных Astra Salon

## Миграция: PostgreSQL (pg / pg-mem) → json-server

Схема SQL (`schema.sql`) сохранена как справочник. Фактическое хранилище теперь —
JSON-файл `backend/db/db.json` в формате **json-server** (коллекции по таблицам).

| Таблица SQL        | Коллекция JSON         |
|------------------|-----------------------|
| users            | users                 |
| clients          | clients               |
| masters          | masters               |
| categories       | categories            |
| services         | services              |
| master_services  | master_services       |
| schedules        | schedules             |
| schedule_exceptions | schedule_exceptions |
| bookings         | bookings              |
| login_attempts   | login_attempts        |

TIMESTAMPTZ → ISO-строки UTC, DECIMAL → number, SERIAL → авто-id (`_sequence` в db.json).

## Команды

```bash
cd backend
npm run migrate        # создать/пересоздать backend/db/db.json из seed-данных
npm start              # Express API (порт 3000), работает поверх db.json через lowdb
npm run json-server    # чистый json-server REST CRUD по db.json (порт 3000)
```

Запуск чистого json-server вручную (например, на другом порту):

```bash
cd backend
npx json-server --watch db/db.json --port 3000 --routes src/json-server.routes.json
```

Файл `src/json-server.routes.json` — правила маршрутизации для флага `--routes`
(алиас `/master-services` → коллекция `master_services`).

Эндпоинты приложения (`/api/public/*`, `/api/admin/*`) остались прежними — фронтенд не менялся.
