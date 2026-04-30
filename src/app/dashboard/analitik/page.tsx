import { createAdminClient } from '@/lib/supabase/server'
import AnalitikClient from '@/components/dashboard/AnalitikClient'

export default async function AnalitikPage() {
  const supabase = createAdminClient()

  const { data: transaksi } = await supabase
    .from('transaksi')
    .select('tanggal, status, total_biaya, diskon_booking, diskon_asuransi, diskon_forward_rate, berat_kena_biaya, kota_tujuan, nama_produk, komoditas, koli, kurir:kurir(kode, nama, warna)')
    .order('tanggal', { ascending: true })

  const { data: kurirList } = await supabase
    .from('kurir')
    .select('id, kode, nama, warna')
    .order('nama')

  return (
    <AnalitikClient
      transaksi={transaksi || []}
      kurirList={kurirList || []}
    />
  )
}