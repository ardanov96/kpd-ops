import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get('origin')
  const destination = req.nextUrl.searchParams.get('destination')
  const weight = req.nextUrl.searchParams.get('weight') || '1'

  if (!origin || !destination) {
    return NextResponse.json({ error: 'origin dan destination wajib diisi' }, { status: 400 })
  }

  const res = await fetch(
    `https://use.api.co.id/expedition/shipping-cost?origin_village_code=${origin}&destination_village_code=${destination}&weight=${weight}`,
    { headers: { 'x-api-co-id': process.env.APICOOID_KEY! } }
  )
  const data = await res.json()

  if (!data.is_success) {
    return NextResponse.json({ error: data.message || 'Gagal mengambil data ongkir' }, { status: 400 })
  }

  return NextResponse.json(data.data)
}