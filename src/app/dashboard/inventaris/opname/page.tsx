import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import InventarisOpnameClient from '@/components/dashboard/InventarisOpnameClient'

export const dynamic = 'force-dynamic'

export default async function OpnamePage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  const params = await searchParams
  const outlet = await getActiveOutlet()

  if (!outlet) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>Belum ada outlet</h1>
      </div>
    )
  }

  const now = new Date()
  const defaultPeriode = params.periode || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let existingOpname: any = null
  let stokList: any[] = []
  let opnameHistory: any[] = []
  let existingItems: any[] = []

  try {
    const opnameRes = await query(
      'SELECT * FROM opname WHERE outlet_id = $1 AND periode = $2 LIMIT 1',
      [outlet.id, defaultPeriode]
    )
    existingOpname = opnameRes.rows[0] || null

    const stokRes = await query(`
      SELECT sa.*,
        json_build_object('kode', k.kode, 'nama', k.nama) as kategori
      FROM v_stok_aktual sa
      LEFT JOIN barang b ON b.id = sa.barang_id
      LEFT JOIN kategori_inventaris k ON k.id = b.kategori_id
      WHERE sa.outlet_id = $1
      ORDER BY sa.nama ASC
    `, [outlet.id])
    stokList = stokRes.rows

    const histRes = await query(
      'SELECT * FROM opname WHERE outlet_id = $1 ORDER BY periode DESC LIMIT 12',
      [outlet.id]
    )
    opnameHistory = histRes.rows

    if (existingOpname) {
      const itemsRes = await query('SELECT * FROM opname_item WHERE opname_id = $1', [existingOpname.id])
      existingItems = itemsRes.rows
    }
  } catch (e) {
    console.error('Error fetching opname page data:', e)
  }

  return (
    <InventarisOpnameClient
      outlet={outlet}
      periode={defaultPeriode}
      stokList={stokList}
      existingOpname={existingOpname}
      existingItems={existingItems}
      opnameHistory={opnameHistory}
    />
  )
}
