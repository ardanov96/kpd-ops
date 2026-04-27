import { createAdminClient } from '@/lib/supabase/server'
import OverviewClient from '@/components/dashboard/OverviewClient'

export default async function DashboardPage() {
  const supabase = createAdminClient()

  const { data: summary } = await supabase
    .from('v_summary_bulanan')
    .select('*')
    .order('periode', { ascending: false })

  const { data: recentTx } = await supabase
    .from('transaksi')
    .select('*, kurir(kode, nama, warna)') 
    .order('tanggal', { ascending: false })
    .limit(100) 

  // ✅ tambah kurir(kode, nama, warna) agar filter bisa berjalan
  const { data: grandTotal } = await supabase
  .from('transaksi')
  .select('total_biaya, diskon_booking, diskon_asuransi, diskon_forward_rate, koli, status, kurir_id, nama_produk, komoditas, kota_tujuan, kurir(kode, nama, warna)') 

  return (
    <OverviewClient
      summary={summary || []}
      recentTx={recentTx || []}
      grandTotal={grandTotal || []}
    />
  )
}