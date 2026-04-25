import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('kurir')
    .select('*')
    .order('nama')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { nama, kode, warna, telepon, portal_url, keterangan } = body
  if (!nama || !kode) return NextResponse.json({ error: 'Nama dan kode wajib diisi' }, { status: 400 })
  const { data, error } = await supabase
    .from('kurir')
    .insert({ nama, kode: kode.toUpperCase(), warna, telepon, portal_url, keterangan, aktif: true })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}