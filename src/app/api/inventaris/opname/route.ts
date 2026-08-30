import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireOwner, isAuthError } from '@/lib/api/auth'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

type Item = {
  barang_id: string
  qty_sistem: number
  qty_fisik: number
  selisih: number
  harga_satuan?: number
  catatan?: string | null
}

type Body = {
  outlet_id: string
  periode: string
  tanggal_opname: string
  catatan?: string | null
  items: Item[]
}

export async function POST(req: NextRequest) {
  const guard = await requireOwner(req)
  if (isAuthError(guard)) return guard
  const { profile } = guard

  let body: Body
  try {
    body = await req.json()
  } catch {
    return apiBadRequest('Body harus JSON')
  }
  const { outlet_id, periode, tanggal_opname, catatan, items } = body

  if (!outlet_id) return apiBadRequest('outlet_id wajib diisi')
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    return apiBadRequest('periode harus format YYYY-MM')
  }
  if (!tanggal_opname) return apiBadRequest('tanggal_opname wajib diisi')
  if (!Array.isArray(items) || items.length === 0) {
    return apiBadRequest('items tidak boleh kosong')
  }

  if (profile.role !== 'owner' && profile.outlet_id !== outlet_id) {
    return NextResponse.json({ error: 'Akses ditolak ke outlet ini' }, { status: 403 })
  }

  try {
    const existingRes = await query(
      'SELECT id, status FROM opname WHERE outlet_id = $1 AND periode = $2 LIMIT 1',
      [outlet_id, periode]
    )

    if (existingRes.rows.length > 0 && existingRes.rows[0].status === 'FINAL') {
      return apiBadRequest('Opname periode ini sudah FINAL. Tidak bisa diubah lagi.')
    }

    const itemsJson = JSON.stringify(
      items.map((it) => ({
        barang_id: it.barang_id,
        qty_sistem: Number(it.qty_sistem) || 0,
        qty_fisik: Number(it.qty_fisik) || 0,
        selisih: Number(it.selisih) || 0,
        harga_satuan: Number(it.harga_satuan) || 0,
        catatan: it.catatan || null,
      }))
    )

    const rpcRes = await query(
      'SELECT * FROM fn_save_opname_atomic($1, $2, $3, $4, $5::jsonb)',
      [outlet_id, periode, tanggal_opname, catatan || null, itemsJson]
    )

    const result = rpcRes.rows[0]

    return apiOk({
      ok: true,
      opname_id: result?.opname_id,
      items_count: result?.items_count,
      adj_count: result?.adj_count,
    })
  } catch (error: any) {
    return apiError(error, 500, '[POST opname]', `Gagal menyimpan opname: ${error?.message}`)
  }
}