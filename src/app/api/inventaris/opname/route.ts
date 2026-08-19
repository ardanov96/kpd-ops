import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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
  const supabase = createAdminClient()
  const body: Body = await req.json()
  const { outlet_id, periode, tanggal_opname, catatan, items } = body

  // ── Validasi ───────────────────────────────────────
  if (!outlet_id) return NextResponse.json({ error: 'outlet_id wajib diisi' }, { status: 400 })
  if (!periode || !/^\d{4}-\d{2}$/.test(periode)) {
    return NextResponse.json({ error: 'periode harus format YYYY-MM' }, { status: 400 })
  }
  if (!tanggal_opname) return NextResponse.json({ error: 'tanggal_opname wajib diisi' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items tidak boleh kosong' }, { status: 400 })
  }

  // ── Cek apakah opname periode ini sudah FINAL ──────
  const { data: existing } = await supabase
    .from('opname')
    .select('id, status')
    .eq('outlet_id', outlet_id)
    .eq('periode', periode)
    .maybeSingle()

  if (existing && existing.status === 'FINAL') {
    return NextResponse.json({
      error: 'Opname periode ini sudah FINAL. Tidak bisa diubah lagi.',
    }, { status: 400 })
  }

  // ── 1. Upsert header opname (status FINAL) ─────────
  const opnamePayload = {
    outlet_id,
    periode,
    tanggal_opname,
    status: 'FINAL',
    catatan: catatan || null,
    finalized_at: new Date().toISOString(),
  }

  let opnameId: string
  if (existing) {
    const { data: upd, error: errUpd } = await supabase
      .from('opname')
      .update(opnamePayload)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (errUpd) return NextResponse.json({ error: errUpd.message }, { status: 500 })
    opnameId = upd.id
  } else {
    const { data: ins, error: errIns } = await supabase
      .from('opname')
      .insert(opnamePayload)
      .select('id')
      .single()
    if (errIns) return NextResponse.json({ error: errIns.message }, { status: 500 })
    opnameId = ins.id
  }

  // ── 2. Hapus opname_item lama (kalau ada, kalau re-opname) ─
  // ON DELETE CASCADE tidak bisa dipakai di sini karena kita update.
  // Kita hapus manual items lama, lalu insert ulang.
  await supabase.from('opname_item').delete().eq('opname_id', opnameId)

  // ── 3. Insert opname_item + ADJ movement untuk selisih ≠ 0 ──
  const movementsToInsert: any[] = []
  const itemsToInsert = items.map((it) => {
    const itemRow = {
      opname_id: opnameId,
      barang_id: it.barang_id,
      qty_sistem: Number(it.qty_sistem) || 0,
      qty_fisik: Number(it.qty_fisik) || 0,
      selisih: Number(it.selisih) || 0,
      harga_satuan: Number(it.harga_satuan) || 0,
      catatan: it.catatan || null,
    }
    // Build ADJ movement untuk selisih ≠ 0
    if (itemRow.selisih !== 0) {
      movementsToInsert.push({
        outlet_id,
        barang_id: it.barang_id,
        tipe: 'ADJ',
        qty: itemRow.selisih,  // bisa +/-
        harga_satuan: itemRow.harga_satuan,
        total: itemRow.selisih * itemRow.harga_satuan,
        ref_type: 'OPNAME',
        ref_id: opnameId,
        keterangan: it.catatan || `Auto-adjust dari opname ${periode}`,
        tanggal: tanggal_opname,
      })
    }
    return itemRow
  })

  const { error: errItems } = await supabase
    .from('opname_item')
    .insert(itemsToInsert)

  if (errItems) {
    // Rollback header (best-effort)
    await supabase.from('opname').delete().eq('id', opnameId)
    return NextResponse.json({ error: `Gagal insert items: ${errItems.message}` }, { status: 500 })
  }

  // ── 4. Insert ADJ movements (jika ada) ─────────────
  if (movementsToInsert.length > 0) {
    const { error: errMov } = await supabase
      .from('stok_movement')
      .insert(movementsToInsert)
    if (errMov) {
      return NextResponse.json({
        error: `Opname tersimpan, tapi gagal insert ADJ movement: ${errMov.message}. Hubungi admin untuk fix.`,
        opname_id: opnameId,
        partial: true,
      }, { status: 500 })
    }
  }

  return NextResponse.json({
    ok: true,
    opname_id: opnameId,
    items_count: items.length,
    adj_count: movementsToInsert.length,
  })
}
