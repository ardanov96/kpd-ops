import { Pool, QueryResult, QueryResultRow } from 'pg'
import dns from 'dns'

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first')
}

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined
}

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      process.env.NEON_DATABASE_URL ||
      process.env.SUPABASE_DB_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres',
    ssl:
      process.env.NODE_ENV === 'production' ||
      (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech'))
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params)
}
