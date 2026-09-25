import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../models/schema';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// All `timestamp` columns in the schema are timezone-naive ("timestamp
// without time zone"). If the Postgres server's session timezone isn't UTC
// (e.g. it's set to a local zone like Africa/Kigali, UTC+2), `now()` writes
// local wall-clock time into those columns, and node-postgres reads naive
// timestamps back assuming they ARE UTC — so every stored time ends up
// shifted by the server's UTC offset. That's exactly what produced orders
// appearing to be placed hours in the future ("-7200s ago" for a UTC+2 host).
// Forcing every connection's session timezone to UTC makes `now()` always
// write true UTC, closing the gap without touching the schema.
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'UTC'").catch((err) => {
    console.error('Failed to set session timezone to UTC:', err.message);
  });
});

export const db = drizzle(pool, { schema });

export type DB = typeof db;
