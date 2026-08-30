import { query } from '@/lib/db'
import { notFound } from 'next/navigation'
import InventarisDetailClient from '@/components/dashboard/InventarisDetailClient'

export const dynamic = 'force-dynamic'

export default async function InventarisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let barang: any = null
  let stok: any = null
  let movements: any[] = []

  try {
    const barangRes = await query(`
      SELECT b.*,
        json_build_object('kode', k.kode, 'nama', k.nama) as kategori
      FROM barang b
      LEFT JOIN kategori_inventaris k ON k.id = b.kategori_id
      WHERE b.id = $1 LIMIT 1
    `, [id])

    if (barangRes.rows.length === 0) notFound()
    barang = barangRes.rows[0]

    const stokRes = await query('SELECT * FROM v_stok_aktual WHERE barang_id = $1 LIMIT 1', [id])
    stok = stokRes.rows[0] || null

    const movRes = await query(
      'SELECT * FROM v_kartu_stok WHERE barang_id = $1 ORDER BY tanggal DESC, created_at DESC',
      [id]
    )
    movements = movRes.rows
  } catch (e) {
    console.error('Error fetching inventaris detail page data:', e)
    notFound()
  }

  return (
    <InventarisDetailClient
      barang={barang}
      stok={stok}
      movements={movements}
    />
  )
}
