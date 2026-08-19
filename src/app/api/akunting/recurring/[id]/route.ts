import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH: update template (partial)
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.nama_template !== undefined) update.nama_template = body.nama_template.trim()
  if (body.kategori_id !== undefined) update.kategori_id = body.kategori_id
  if (body.tipe !== undefined) {
    if (!['MASUK', 'KELUAR'].includes(body.tipe)) return NextResponse.json({ error: 'tipe invalid' }, { status: 400 })
    update.tipe = body.tipe
  }
  if (body.nominal !== undefined) {
    const n = Number(body.nominal)
    if (!n || n <= 0) return NextResponse.json({ error: 'nominal harus > 0' }, { status: 400 })
    update.nominal = n
  }
  if (body.metode !== undefined) {
    if (body.metode && !['CASH', 'BANK', 'EWALLET'].includes(body.metode)) {
      return NextResponse.json({ error: 'metode invalid' }, { status: 400 })
    }
    update.metode = body.metode || null
  }
  if (body.tanggal_setiap_bulan !== undefined) {
    const tgl = Number(body.tanggal_setiap_bulan)
    if (!Number.isInteger(tgl) || tgl < 1 || tgl > 31) {
      return NextResponse.json({ error: 'tanggal harus 1-31' }, { status: 400 })
    }
    update.tanggal_setiap_bulan = tgl
  }
  if (body.aktif !== undefined) update.aktif = !!body.aktif

  const { data, error } = await supabase
    .from('recurring_transactions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: hapus template
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params

  const { error } = await supabase
    .from('recurring_transactions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
