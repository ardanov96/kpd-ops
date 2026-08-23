import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { BUCKET_NOTA, deleteFile, parseStoragePath } from '@/lib/storage'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/**
 * DELETE: hapus transaksi (hanya yang sumber='MANUAL' yang boleh dihapus owner).
 *
 * Jika transaksi punya lampiran (lampiran_url), file di Storage juga dihapus
 * agar tidak ada orphan file di bucket.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params

  // 1. Ambil data transaksi (cek sumber + lampiran)
  const { data: existing } = await supabase
    .from('transaksi_keuangan')
    .select('id, sumber, lampiran_url')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })

  if (existing.sumber !== 'MANUAL') {
    return NextResponse.json({
      error: `Transaksi auto-generated (sumber=${existing.sumber}) tidak boleh dihapus manual.`,
    }, { status: 400 })
  }

  // 2. Hapus transaksi di DB
  const { error } = await supabase
    .from('transaksi_keuangan')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 3. Cleanup lampiran di Storage (best-effort, jangan gagalkan response kalau gagal)
  if (existing.lampiran_url) {
    try {
      const path = parseStoragePath(existing.lampiran_url, BUCKET_NOTA)
      if (path) await deleteFile(BUCKET_NOTA, path)
    } catch (e) {
      console.warn(`[delete-transaksi] Gagal hapus lampiran ${existing.lampiran_url}:`, e)
    }
  }

  return NextResponse.json({ ok: true })
}

/**
 * PATCH: update partial fields transaksi (digunakan setelah upload nota
 * untuk simpan lampiran_url). Digunakan juga oleh UI lain.
 *
 * Body fields yang didukung (semua optional):
 *   - lampiran_url: string | null
 *   - keterangan: string | null
 *   - tanggal: 'YYYY-MM-DD'
 *   - nominal: number
 *   - metode: 'CASH' | 'BANK' | 'EWALLET' | null
 *   - kategori_id: uuid
 *
 * Catatan: hanya transaksi MANUAL yang boleh diedit kategori/nominal.
 * Untuk lampiran_url: semua sumber boleh (untuk konsistensi).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 })
  }

  // Whitelist fields yang boleh di-update
  const allowed: Record<string, unknown> = {}
  const safeFields = ['lampiran_url', 'keterangan', 'tanggal', 'metode'] as const
  for (const k of safeFields) {
    if (body[k] !== undefined) allowed[k] = body[k]
  }

  // Field kategori_id & nominal hanya boleh untuk MANUAL
  const protectedFields: string[] = []
  const { data: existing } = await supabase
    .from('transaksi_keuangan')
    .select('id, sumber')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })

  if (existing.sumber === 'MANUAL') {
    if (body.nominal !== undefined) allowed.nominal = Number(body.nominal)
    if (body.kategori_id !== undefined) allowed.kategori_id = body.kategori_id
  } else {
    if (body.nominal !== undefined) protectedFields.push('nominal')
    if (body.kategori_id !== undefined) protectedFields.push('kategori_id')
  }

  if (protectedFields.length > 0) {
    return NextResponse.json(
      { error: `Transaksi auto-generated (sumber=${existing.sumber}) tidak boleh edit field: ${protectedFields.join(', ')}` },
      { status: 400 }
    )
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transaksi_keuangan')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * GET: ambil 1 transaksi by ID
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params
  const { data, error } = await supabase
    .from('transaksi_keuangan')
    .select('*, kategori:kategori_akun(kode,nama)')
    .eq('id', id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
