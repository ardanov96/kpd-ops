import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { BUCKET_NOTA, deleteFile, parseStoragePath } from '@/lib/storage'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params

  try {
    const existingRes = await query(
      'SELECT id, sumber, lampiran_url FROM transaksi_keuangan WHERE id = $1 LIMIT 1',
      [id]
    )

    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }
    const existing = existingRes.rows[0]

    if (existing.sumber !== 'MANUAL') {
      return NextResponse.json({
        error: `Transaksi auto-generated (sumber=${existing.sumber}) tidak boleh dihapus manual.`,
      }, { status: 400 })
    }

    await query('DELETE FROM transaksi_keuangan WHERE id = $1', [id])

    if (existing.lampiran_url) {
      try {
        const path = parseStoragePath(existing.lampiran_url, BUCKET_NOTA)
        if (path) await deleteFile(BUCKET_NOTA, path)
      } catch (e) {
        console.warn(`[delete-transaksi] Gagal hapus lampiran ${existing.lampiran_url}:`, e)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal menghapus transaksi' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body harus JSON' }, { status: 400 })
  }

  try {
    const existingRes = await query('SELECT id, sumber FROM transaksi_keuangan WHERE id = $1 LIMIT 1', [id])
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }
    const existing = existingRes.rows[0]

    const updates: string[] = []
    const values: any[] = []

    const allowed = ['lampiran_url', 'keterangan', 'tanggal', 'metode']
    for (const key of allowed) {
      if (body[key] !== undefined) {
        values.push(body[key])
        updates.push(`${key} = $${values.length}`)
      }
    }

    if (existing.sumber === 'MANUAL') {
      if (body.nominal !== undefined) {
        values.push(Number(body.nominal))
        updates.push(`nominal = $${values.length}`)
      }
      if (body.kategori_id !== undefined) {
        values.push(body.kategori_id)
        updates.push(`kategori_id = $${values.length}`)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
    }

    values.push(id)
    const res = await query(
      `UPDATE transaksi_keuangan SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    )

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal mengupdate transaksi' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  try {
    const res = await query(
      `SELECT tk.*,
        json_build_object('kode', k.kode, 'nama', k.nama) as kategori
       FROM transaksi_keuangan tk
       LEFT JOIN kategori_akun k ON k.id = tk.kategori_id
       WHERE tk.id = $1 LIMIT 1`,
      [id]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Gagal mengambil transaksi' }, { status: 500 })
  }
}
