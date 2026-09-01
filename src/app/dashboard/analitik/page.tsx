import { query } from '@/lib/db'
import AnalitikClient from '@/components/dashboard/AnalitikClient'

export default async function AnalitikPage() {
  let transaksi: any[] = []
  let kurirList: any[] = []

  try {
    const txRes = await query(`
      SELECT t.tanggal, t.status, t.total_biaya, t.diskon_booking, t.diskon_asuransi, t.diskon_forward_rate,
        t.berat_kena_biaya, t.kota_tujuan, t.nama_produk, t.komoditas, t.koli,
        json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir
      FROM transaksi t
      LEFT JOIN kurir k ON k.id = t.kurir_id
      ORDER BY t.tanggal ASC
    `)
    transaksi = txRes.rows

    const kurirRes = await query('SELECT id, kode, nama, warna FROM kurir WHERE aktif IS NOT FALSE ORDER BY nama ASC')
    kurirList = kurirRes.rows
  } catch (e) {
    console.error('Error fetching analitik page data:', e)
  }

  if (kurirList.length === 0) {
    kurirList = [
      { id: '00000000-0000-0000-0000-000000000010', kode: 'LION', nama: 'Lion Parcel', warna: '#f97316' },
      { id: '00000000-0000-0000-0000-000000000020', kode: 'JNE', nama: 'JNE Express', warna: '#ef4444' },
    ]
  }

  return (
    <AnalitikClient
      transaksi={transaksi}
      kurirList={kurirList}
    />
  )
}