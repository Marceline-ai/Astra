// db-обёртка: реальный PostgreSQL (pg Pool) либо in-memory (pg-mem) для разработки.
// Переключение: DB_MODE=pg-mem | pg (по умолчанию pg-mem, если DATABASE_URL не задан).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.env.DB_MODE || (process.env.DATABASE_URL ? 'pg' : 'pg-mem');

let pool;

if (MODE === 'pg') {
  const pg = await import('pg');
  pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
} else {
  const { newDb } = await import('pg-mem');
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  // pg-mem не поддерживает BIGSERIAL/DECIMAL(p,s)/TIMESTAMPTZ/CREATE INDEX — адаптим схему:
  let sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf8');
  sql = sql
    .replace(/BIGSERIAL/g, 'SERIAL')
    .replace(/DECIMAL\(\d+,\s*\d+\)/g, 'NUMERIC')
    .replace(/TIMESTAMPTZ/g, 'TIMESTAMP WITH TIME ZONE')
    .replace(/CURRENT_TIMESTAMP/g, 'now()');
  sql = sql.split('\n').filter(l => !/^CREATE INDEX/i.test(l)).join('\n');
  mem.public.none(sql); // проверено: pg-mem выполняет многостатейментный DDL через none()
  const Pg = mem.adapters.createPg().Pool;
  pool = new Pg(); //экземпляр Pool: имеет .query() и .connect() (транзакции)
}

export const MODE_LABEL = MODE;

export async function query(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows ?? res;
}

export async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
