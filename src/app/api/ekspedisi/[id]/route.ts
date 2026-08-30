import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { nama, kode, warna, telepon, portal_url, keterangan, aktif } = body

    const updates: string[] = []
    const values: any[] = []

    if (nama !== undefined) { values.push(nama); updates.push(`nama = $${values.length}`) }
    if (kode !== undefined) { values.push(kode.toUpperCase()); updates.push(`kode = $${values.length}`) }
    if (warna !== undefined) { values.push(warna); updates.push(`warna = $${values.length}`) }
    if (telepon !== undefined) { values.push(telepon || null); updates.push(`telepon = $${values.length}`) }
    if (portal_url !== undefined) { values.push(portal_url || null); updates.push(`portal_url = $${values.length}`) }
    if (keterangan !== undefined) { values.push(keterangan || null); updates.push(`keterangan = $${values.length}`) }
    if (aktif !== undefined) { values.push(Boolean(aktif)); updates.push(`aktif = $${values.length}`) }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 })
    }

    values.push(id)
    const res = await query(
      `UPDATE kurir SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    )

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update kurir' }, { status: 500 })
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await query('UPDATE kurir SET aktif = false WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to disable kurir' }, { status: 500 })
  }
}