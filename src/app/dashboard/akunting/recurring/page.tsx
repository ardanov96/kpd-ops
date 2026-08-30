import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import AkuntingRecurringClient from '@/components/dashboard/AkuntingRecurringClient'

export const dynamic = 'force-dynamic'

export default async function AkuntingRecurringPage() {
  const outlet = await getActiveOutlet()

  if (!outlet) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#f1f5f9' }}>Belum ada outlet</h1>
      </div>
    )
  }

  let kategoriList: any[] = []
  let recurringList: any[] = []

  try {
    const katRes = await query(
      "SELECT * FROM kategori_akun WHERE tipe IN ('INCOME', 'EXPENSE') ORDER BY tipe ASC, urutan ASC"
    )
    kategoriList = katRes.rows

    const recRes = await query(`
      SELECT rt.*,
        json_build_object('kode', k.kode, 'nama', k.nama, 'tipe', k.tipe) as kategori
      FROM recurring_transactions rt
      LEFT JOIN kategori_akun k ON k.id = rt.kategori_id
      WHERE rt.outlet_id = $1
      ORDER BY rt.aktif DESC, rt.tanggal_setiap_bulan ASC
    `, [outlet.id])
    recurringList = recRes.rows
  } catch (e) {
    console.error('Error fetching recurring page data:', e)
  }

  return (
    <AkuntingRecurringClient
      outlet={outlet}
      kategoriList={kategoriList}
      recurringList={recurringList}
    />
  )
}
