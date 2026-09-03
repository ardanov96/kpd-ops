/**
 * POST /api/admin/backup
 *
 * Backup harian ke S3 — dipanggil via Vercel Cron (`vercel.json`).
 *
 * Sprint 6 - Fix BUG #11: Backup robust tanpa `pg_dump` CLI.
 *   - Sebelumnya pakai `execFile('pg_dump', ...)` → tidak jalan di Vercel serverless
 *   - Sekarang pakai `pg` client (sudah ada di package.json: pg ^8.23.0)
 *   - Stream tiap tabel penting → INSERT statements → gzip → upload S3
 *
 * Env vars required:
 *   - SUPABASE_DB_URL (postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres)
 *   - BACKUP_S3_BUCKET (e.g. "ekspedisi-backups")
 *   - BACKUP_S3_REGION (e.g. "ap-southeast-1")
 *   - BACKUP_S3_ACCESS_KEY_ID
 *   - BACKUP_S3_SECRET_ACCESS_KEY
 *   - BACKUP_CRON_SECRET (Bearer token, harus match di vercel.json)
 *
 * Cron expression (di vercel.json):
 *   "0 23 * * *" → jalan setiap hari jam 23:00 UTC = 06:00 WIB
 */

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { Client } from 'pg'
import { gzip } from 'node:zlib'
import { normalizeConnectionString } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 detik max (Vercel hobby)

interface BackupResult {
  ok: boolean
  path?: string
  size?: number
  date?: string
  tables_backed_up?: number
  tables_failed?: string[]
  error?: string
}

// Tabel-tabel yang di-backup (sesuai schema Sprint 1-5)
const BACKUP_TABLES = [
  'outlets',
  'profiles',
  'kurir',
  'kategori_inventaris',
  'barang',
  'stok_movement',
  'opname',
  'opname_item',
  'kategori_akun',
  'transaksi_keuangan',
  'transaksi',
  'recurring_transactions',
  'periode_closing',
  'pajak_config',
  'pajak_rekap',
  'upload_log',
  'stok_awal',
  'jne_packing_list',
] as const

/**
 * Generate INSERT statements dari query hasil.
 * Format: INSERT INTO table (col1, col2) VALUES (val1, val2), (val3, val4) ...;
 */
function escapeValue(val: any): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (val instanceof Date) return `'${val.toISOString()}'`
  // String: escape single quote
  return `'${String(val).replace(/'/g, "''")}'`
}

async function pgBackup(dbUrl: string): Promise<{ sql: string; tablesBackedUp: number; failedTables: string[] }> {
  const client = new Client({ connectionString: normalizeConnectionString(dbUrl) })
  await client.connect()

  const lines: string[] = []
  lines.push('-- Ekspedisi Dashboard Backup')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push('-- Source: Supabase PostgreSQL')
  lines.push('')

  let tablesBackedUp = 0
  const failedTables: string[] = []

  for (const table of BACKUP_TABLES) {
    try {
      // Cek tabel exists
      const exists = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      )
      if (!exists.rows[0]?.exists) {
        failedTables.push(`${table} (not found)`)
        continue
      }

      // Ambil semua rows
      const result = await client.query(`SELECT * FROM "${table}"`)

      if (result.rows.length === 0) {
        lines.push(`-- Table ${table}: empty`)
        lines.push('')
        continue
      }

      const cols = result.fields.map((f) => `"${f.name}"`).join(', ')

      // Batch per 100 rows
      const batchSize = 100
      for (let i = 0; i < result.rows.length; i += batchSize) {
        const batch = result.rows.slice(i, i + batchSize)
        const values = batch.map((row) => {
          const vals = result.fields.map((f) => escapeValue(row[f.name])).join(', ')
          return `(${vals})`
        })
        lines.push(`INSERT INTO "${table}" (${cols}) VALUES`)
        lines.push(values.join(',\n') + ';')
      }
      lines.push('')
      tablesBackedUp++
    } catch (err: any) {
      console.warn(`[pgBackup] Table ${table} gagal:`, err.message)
      failedTables.push(table)
    }
  }

  await client.end()

  return {
    sql: lines.join('\n'),
    tablesBackedUp,
    failedTables,
  }
}

function formatDate(): string {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export async function POST(req: NextRequest): Promise<NextResponse<BackupResult>> {
  // 1. Auth via cron secret
  const expectedSecret = process.env.BACKUP_CRON_SECRET
  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'BACKUP_CRON_SECRET not configured' },
      { status: 500 }
    )
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Validate env
  const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.SUPABASE_DB_URL
  const bucket = process.env.BACKUP_S3_BUCKET
  const region = process.env.BACKUP_S3_REGION
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY

  if (!dbUrl || !bucket || !region || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { ok: false, error: 'Missing required env vars (DATABASE_URL, BACKUP_S3_*)' },
      { status: 500 }
    )
  }

  // 3. pg client → gzip → upload S3
  const date = formatDate()
  const key = `backups/${date}-ekspedisi.sql.gz`

  try {
    // 3a. pg backup (dengan graceful per-table error)
    const { sql, tablesBackedUp, failedTables } = await pgBackup(dbUrl)

    // 3b. gzip
    const compressed = await new Promise<Buffer>((res, rej) => {
      gzip(Buffer.from(sql, 'utf8'), (err, out) => {
        if (err) rej(err)
        else res(out)
      })
    })

    // 3c. upload to S3
    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    })
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: compressed,
        ContentType: 'application/gzip',
        Metadata: {
          'backup-date': date,
          'backup-source': 'ekspedisi-dashboard',
          'tables-backed-up': String(tablesBackedUp),
        },
      })
    )

    return NextResponse.json({
      ok: true,
      path: `s3://${bucket}/${key}`,
      size: compressed.length,
      date,
      tables_backed_up: tablesBackedUp,
      tables_failed: failedTables,
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}