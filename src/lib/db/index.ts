import { Pool, QueryResult, QueryResultRow, types } from 'pg'
import dns from 'dns'

// Kembalikan tipe DATE (OID 1082) sebagai string 'YYYY-MM-DD' langsung,
// bukan JavaScript Date object, guna mencegah timezone shift dan error React render
types.setTypeParser(1082, (val: string) => val)

// Konversi tipe NUMERIC (OID 1700) dari default string ke JavaScript number.
// Tanpa ini, operasi aritmatika di frontend (mis. `omzet += t.total_biaya`) menjadi
// string concatenation dan menghasilkan nilai astronomis (e+206, Infinity).
types.setTypeParser(1700, (val: string) => (val === '' ? null : Number(val)))

// Konversi tipe BIGINT (OID 20) dari default string ke JavaScript number.
// Aman untuk codebase ini karena semua kolom BIGINT di schema adalah nilai moneter
// (total_biaya, diskon_*, biaya_*, dll); ID tabel semuanya UUID, bukan BIGINT.
types.setTypeParser(20, (val: string) => (val === '' ? null : Number(val)))

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

/**
 * Jalankan callback di dalam transaksi database. Auto COMMIT jika sukses,
 * ROLLBACK jika error, dan RELEASE client ke pool di finally.
 *
 * Catatan: connection pool Neon max=10. Jika callback panjang dan pool
 * sibuk, transaksi bisa timeout. Gunakan untuk operasi batch yang harus
 * atomik (mis. upload XLSX).
 */
export async function withTransaction<T>(
  fn: (run: <R extends QueryResultRow = any>(text: string, params?: any[]) => Promise<QueryResult<R>>) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn((text, params) => client.query(text, params))
    await client.query('COMMIT')
    return result
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    throw e
  } finally {
    client.release()
  }
}
