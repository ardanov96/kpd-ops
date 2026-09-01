import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Pastikan tabel kurir dan kolom-kolomnya siap
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS kurir (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          kode text UNIQUE NOT NULL,
          nama text NOT NULL,
          warna text DEFAULT '#f97316',
          telepon text,
          portal_url text,
          keterangan text,
          aktif boolean DEFAULT true,
          created_at timestamptz DEFAULT now()
        );
      `)
      await query(`ALTER TABLE kurir ADD COLUMN IF NOT EXISTS telepon text;`)
      await query(`ALTER TABLE kurir ADD COLUMN IF NOT EXISTS portal_url text;`)
      await query(`ALTER TABLE kurir ADD COLUMN IF NOT EXISTS keterangan text;`)
      await query(`ALTER TABLE kurir ADD COLUMN IF NOT EXISTS aktif boolean DEFAULT true;`)
    } catch (dbErr) {
      console.error('Error checking kurir schema:', dbErr)
    }

    let res = await query('SELECT * FROM kurir ORDER BY nama ASC')

    // 2. Jika database kurir masih kosong, otomatis seed 2 default franchise (LION & JNE)
    if (res.rows.length === 0) {
      try {
        await query(`
          INSERT INTO kurir (id, kode, nama, warna, portal_url, keterangan, aktif)
          VALUES
            ('00000000-0000-0000-0000-000000000010', 'LION', 'Lion Parcel', '#f97316', 'https://genesis.lionparcel.com', 'Franchise Ekspedisi Lion Parcel (Genesis)', true),
            ('00000000-0000-0000-0000-000000000020', 'JNE', 'JNE Express', '#ef4444', 'https://myjne.jne.co.id', 'Franchise Ekspedisi JNE Express (MyJNE)', true)
          ON CONFLICT (kode) DO UPDATE SET
            nama = EXCLUDED.nama,
            warna = EXCLUDED.warna,
            portal_url = COALESCE(kurir.portal_url, EXCLUDED.portal_url),
            keterangan = COALESCE(kurir.keterangan, EXCLUDED.keterangan),
            aktif = true;
        `)
        res = await query('SELECT * FROM kurir ORDER BY nama ASC')
      } catch (seedErr) {
        console.error('Error seeding default kurir:', seedErr)
      }
    }

    return NextResponse.json(res.rows, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch kurir' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nama, kode, warna, telepon, portal_url, keterangan } = body
    if (!nama || !kode) return NextResponse.json({ error: 'Nama dan kode wajib diisi' }, { status: 400 })

    const res = await query(
      `INSERT INTO kurir (nama, kode, warna, telepon, portal_url, keterangan, aktif)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [nama, kode.toUpperCase(), warna || '#f97316', telepon || null, portal_url || null, keterangan || null]
    )

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create kurir' }, { status: 500 })
  }
}