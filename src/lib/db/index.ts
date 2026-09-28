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

// Invalidate pool jika masih memakai konfigurasi lama di dev server (HMR/Turbopack)
if (
  globalForDb.pool &&
  ((globalForDb.pool as any).options?.idleTimeoutMillis !== 15000 ||
   !(globalForDb.pool as any).options?.keepAlive)
) {
  try { globalForDb.pool.end() } catch {}
  globalForDb.pool = undefined
}

function createPool(): Pool {
  const isNeon = Boolean(rawConnectionString && rawConnectionString.includes('neon.tech'))
  const p = new Pool({
    connectionString: normalizeConnectionString(rawConnectionString),
    ssl:
      process.env.NODE_ENV === 'production' || isNeon
        ? { rejectUnauthorized: false }
        : false,
    max: 10,
    // Neon PgBouncer memutus koneksi idle setelah ~20-30 detik.
    // Menyetel idleTimeoutMillis ke 15s memastikan node-postgres mempensiunkan koneksi idle
    // sebelum diputus sepihak oleh Neon PgBouncer, mencegah error 'Connection terminated unexpectedly'.
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 15000, // 15s kompensasi latensi trans-pasifik ke Neon.tech (US-East)
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  })

  // Tangani error pada client idle di dalam pool agar tidak memicu unhandled exception / crash
  p.on('error', (err: any) => {
    console.warn('[db] Idle client error caught by pool handler (connection recycled):', err?.message || err)
  })

  return p
}

export const pool = globalForDb.pool ?? createPool()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool
}

function isTransientError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase()
  const code = String(err?.code || '')
  return (
    msg.includes('connection terminated') ||
    msg.includes('timeout') ||
    msg.includes('socket closed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('connection ended') ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === '57P01' || // admin_shutdown (Neon compute wake/restart)
    code === '57P02' || // crash_shutdown
    code === '57P03' || // cannot_connect_now
    code === '08006' || // connection_failure
    code === '08001' || // sqlclient_unable_to_establish_sqlconnection
    code === '08004'    // sqlserver_rejected_establishment_of_sqlconnection
  )
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params)
  } catch (err: any) {
    if (isTransientError(err)) {
      console.warn('[db] query retry after transient connection error:', err?.message || err)
      // Jeda 250ms sebelum retry agar pool dapat membuat socket baru yang sehat
      await new Promise((resolve) => setTimeout(resolve, 250))
      return await pool.query<T>(text, params)
    }
    throw err
  }
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
  let client: any
  try {
    client = await pool.connect()
  } catch (err: any) {
    // Retry 1x jika koneksi timeout / terputus sementara (mis. Neon cold-start)
    if (isTransientError(err)) {
      console.warn('[db] withTransaction connect retry:', err?.message || err)
      await new Promise((resolve) => setTimeout(resolve, 250))
      client = await pool.connect()
    } else {
      throw err
    }
  }

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

