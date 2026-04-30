import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Promise
) {
  const supabase = createAdminClient()
  const { id } = await params // ✅ await
  const body = await req.json()
  const { nama, kode, warna, telepon, portal_url, keterangan, aktif } = body
  const { data, error } = await supabase
    .from('kurir')
    .update({ nama, kode: kode?.toUpperCase(), warna, telepon, portal_url, keterangan, aktif })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Promise
) {
  const supabase = createAdminClient()
  const { id } = await params // ✅ await
  const { error } = await supabase.from('kurir').update({ aktif: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}