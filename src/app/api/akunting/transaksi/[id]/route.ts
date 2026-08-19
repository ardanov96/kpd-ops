import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// DELETE: hapus transaksi (hanya yang sumber='MANUAL' yang boleh dihapus owner)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createAdminClient()
  const { id } = await params

  // Cek apakah transaksi ada & sumber-nya
  const { data: existing } = await supabase
    .from('transaksi_keuangan')
    .select('id, sumber')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })

  if (existing.sumber !== 'MANUAL') {
    return NextResponse.json({
      error: `Transaksi auto-generated (sumber=${existing.sumber}) tidak boleh dihapus manual.`,
    }, { status: 400 })
  }

  const { error } = await supabase
    .from('transaksi_keuangan')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
