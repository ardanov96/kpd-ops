import { query } from '@/lib/db'
import OverviewClient from '@/components/dashboard/OverviewClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string }
}) {
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {}
  const initialTab = resolvedParams?.tab || 'overview'

  let summary: any[] = []
  let recentTx: any[] = []
  let grandTotal: any[] = []
  let jneList: any[] = []
  let kurirList: any[] = []

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
        SELECT t.total_biaya, t.diskon_booking, t.diskon_asuransi, t.diskon_forward_rate, t.koli, t.status, t.kurir_id, t.nama_produk, t.komoditas, t.kota_tujuan, t.berat_kena_biaya, to_char(t.tanggal, 'YYYY-MM-DD') as tanggal,
          json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir
        FROM transaksi t
        LEFT JOIN kurir k ON k.id = t.kurir_id
      `)
      grandTotal = grandTotalRes.rows

      const jneRes = await query(`
        SELECT 
          j.id,
          j.nomor_pl,
          to_char(j.tanggal, 'YYYY-MM-DD') as tanggal,
          j.amount as total_biaya,
          j.publish_rate,
          j.discount as diskon_booking,
          COALESCE(j.disc_others, 0) as disc_others,
          j.total_net as net_profit,
          j.cnote_count,
          j.coly as koli,
          j.weight as berat_kena_biaya,
          to_char(j.date_paid, 'YYYY-MM-DD') as date_paid,
          j.outstanding,
          j.insurance,
          j.vat_amount,
          CASE WHEN j.outstanding <= 0 THEN 'LUNAS' ELSE 'BELUM_LUNAS' END as status_pembayaran,
          j.kurir_id,
          json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir
        FROM jne_packing_list j
        LEFT JOIN kurir k ON k.id = j.kurir_id
        ORDER BY j.tanggal DESC
      `)
      jneList = jneRes.rows

      const kurirRes = await query('SELECT id, kode, nama, warna FROM kurir WHERE aktif IS NOT FALSE ORDER BY nama ASC')
      kurirList = kurirRes.rows
    } catch (e) {
      console.error('Error fetching dashboard page data from Neon:', e)
    }
  }

  return (
    <OverviewClient
      summary={summary}
      recentTx={recentTx}
      grandTotal={grandTotal}
      jneList={jneList}
      kurirList={kurirList}
      initialTab={initialTab}
    />
  )
}