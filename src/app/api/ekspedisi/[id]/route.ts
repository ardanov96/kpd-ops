import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { nama, kode, warna, telepon, portal_url, keterangan, aktif } = body
  const { data, error } = await supabase
    .from('kurir')
    .update({ nama, kode: kode?.toUpperCase(), warna, telepon, portal_url, keterangan, aktif })
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('kurir').update({ aktif: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}