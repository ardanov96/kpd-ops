import { createAdminClient } from '@/lib/supabase/server'
import TransaksiClient from '@/components/dashboard/TransaksiClient'


export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ kurir?: string; status?: string; periode?: string; page?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

  const page = Number(params.page || 1)
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let kurirIdFilter: string | null = null
  if (params.kurir) {
    const { data: k } = await supabase
      .from('kurir').select('id').eq('kode', params.kurir).single()
    kurirIdFilter = k?.id || null
  }

  // Query tabel (paginated)
  let query = supabase
    .from('transaksi')
    .select('*, kurir(kode, nama, warna)', { count: 'exact' })
    .order('tanggal', { ascending: false })
    .range(from, to)

  if (kurirIdFilter) query = query.eq('kurir_id', kurirIdFilter)
  if (params.status) query = query.eq('status', params.status)
  if (params.periode) {
    const [year, month] = params.periode.split('-')
    const firstDay = `${year}-${month}-01`
    const lastDay = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10)
    query = query.gte('tanggal', firstDay).lte('tanggal', lastDay)
  }

  // ✅ Query summary — semua data non-CNX sesuai filter aktif
  let summaryQuery = supabase
    .from('transaksi')
    .select('total_biaya, diskon_booking, diskon_asuransi, diskon_forward_rate, potongan, biaya_asuransi, nama_produk, komoditas, status') // ✅ tambah komoditas
    .neq('status', 'CNX')

  if (kurirIdFilter) summaryQuery = summaryQuery.eq('kurir_id', kurirIdFilter)
  if (params.status && params.status !== 'CNX') summaryQuery = summaryQuery.eq('status', params.status)
  if (params.periode) {
    const [year, month] = params.periode.split('-')
    const firstDay = `${year}-${month}-01`
    const lastDay = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10)
    summaryQuery = summaryQuery.gte('tanggal', firstDay).lte('tanggal', lastDay)
  }

  const [
    { data: transaksi, count },
    { data: kurir },
    { data: summaryData },
  ] = await Promise.all([
    query,
    supabase.from('kurir').select('kode, nama').order('nama'),
    summaryQuery,
  ])

  // Hitung summary
  const subtotalBiaya = summaryData?.reduce((acc, r) => acc + (r.total_biaya || 0), 0) || 0
  const subtotalDiskon = summaryData?.reduce((acc, r) => acc + (r.diskon_booking || 0), 0) || 0
  const subtotalDiskonAsuransi = summaryData?.reduce((acc, r) => acc + (r.diskon_asuransi || 0), 0) || 0
  const subtotalDiskonFwdRate = summaryData?.reduce((acc, r) => acc + (r.diskon_forward_rate || 0), 0) || 0
  const subtotalNetProfit = subtotalDiskon + subtotalDiskonAsuransi + subtotalDiskonFwdRate

  // ✅ Hapus semua baris nonCNX, netProfit, kotaCount, top3Kota — tidak dipakai di sini

  // Produk terpopuler
  const produkCount: Record<string, number> = {}
  summaryData?.forEach(r => {
    if (r.nama_produk) produkCount[r.nama_produk] = (produkCount[r.nama_produk] || 0) + 1
  })
  const produkTerpopuler = Object.entries(produkCount).sort((a, b) => b[1] - a[1])[0] || null

  // Komoditas terpopuler
  const komoditasCount: Record<string, number> = {}
  summaryData?.forEach(r => {
    if (r.komoditas) komoditasCount[r.komoditas] = (komoditasCount[r.komoditas] || 0) + 1
  })
  const komoditasTerpopuler = Object.entries(komoditasCount).sort((a, b) => b[1] - a[1])[0] || null

  return (
    <TransaksiClient
      transaksi={transaksi || []}
      totalCount={count || 0}
      page={page}
      pageSize={pageSize}
      kurirList={kurir || []}
      filters={params}
      summary={{
        subtotalBiaya,
        subtotalDiskon,
        subtotalDiskonAsuransi,
        subtotalDiskonFwdRate,
        subtotalNetProfit,
        produkTerpopuler,
        komoditasTerpopuler,
      }}
    />
  )
}