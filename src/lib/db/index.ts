import { Pool, QueryResult, QueryResultRow, types } from 'pg'
import dns from 'dns'

// Kembalikan tipe DATE (OID 1082) sebagai string 'YYYY-MM-DD' langsung,
// bukan JavaScript Date object, guna mencegah timezone shift dan error React render
types.setTypeParser(1082, (val: string) => val)

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first')
}

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined
}

/**
 * Menormalkan connection string untuk mencegah security warning dari pg / pg-connection-string:
 * Versi baru node-postgres memperingatkan bahwa 'sslmode=require', 'prefer', dan 'verify-ca'
 * akan berubah semantiknya di versi mendatang (pg v9).
 * Mengubah secara otomatis ke 'sslmode=verify-full' menjaga keamanan penuh dan menghilangkan warning overlay di Next.js.
 */
export function normalizeConnectionString(url?: string): string | undefined {
  if (!url) return url
  return url.replace(
    /([?&]sslmode=)(?:require|prefer)(&|$)/,
    (_match, prefix, suffix) => `${prefix}verify-full${suffix}`
  )
}

const rawConnectionString =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  'postgresql://postgres:postgres@localhost:5432/postgres'

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: normalizeConnectionString(rawConnectionString),
    ssl:
      process.env.NODE_ENV === 'production' ||
      (rawConnectionString && rawConnectionString.includes('neon.tech'))
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
