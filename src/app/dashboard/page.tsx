import { query } from '@/lib/db'
import OverviewClient from '@/components/dashboard/OverviewClient'

export default async function DashboardPage() {
  let summary: any[] = []
  let recentTx: any[] = []
  let grandTotal: any[] = []

  if (process.env.DATABASE_URL) {
    try {
      const summaryRes = await query('SELECT * FROM v_summary_bulanan ORDER BY periode DESC')
      summary = summaryRes.rows

      const recentTxRes = await query(`
        SELECT t.*, to_char(t.tanggal, 'YYYY-MM-DD') as tanggal,
          json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir
        FROM transaksi t
        LEFT JOIN kurir k ON k.id = t.kurir_id
        ORDER BY t.tanggal DESC
        LIMIT 100
      `)
      recentTx = recentTxRes.rows

      const grandTotalRes = await query(`
        SELECT t.total_biaya, t.diskon_booking, t.diskon_asuransi, t.diskon_forward_rate, t.koli, t.status, t.kurir_id, t.nama_produk, t.komoditas, t.kota_tujuan, to_char(t.tanggal, 'YYYY-MM-DD') as tanggal,
          json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir
        FROM transaksi t
        LEFT JOIN kurir k ON k.id = t.kurir_id
      `)
      grandTotal = grandTotalRes.rows
    } catch (e) {
      console.error('Error fetching dashboard page data from Neon:', e)
    }
  }

  return (
    <OverviewClient
      summary={summary}
      recentTx={recentTx}
      grandTotal={grandTotal}
    />
  )
}