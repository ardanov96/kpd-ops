import { createAdminClient } from '@/lib/supabase/server'
import TransaksiClient from '@/components/dashboard/TransaksiClient'
import JneTransaksiWrapper from '@/components/dashboard/JneTransaksiWrapper';

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

  // ✅ Cek apakah filter kurir adalah JNE
  const { data: kurirList } = await supabase.from('kurir').select('id, kode, nama, warna').order('nama')
  const selectedKurirData = kurirList?.find(k => k.kode === params.kurir)
  const isJNE = selectedKurirData?.kode === 'JNE'

  // ── JNE: fetch dari jne_packing_list ──
  if (isJNE) {
    let jneQuery = supabase
      .from('jne_packing_list')
      .select('*', { count: 'exact' })
      .eq('kurir_id', selectedKurirData!.id)
      .order('tanggal', { ascending: false })
      .range(from, to)

    if (params.periode) {
      const [year, month] = params.periode.split('-')
      const firstDay = `${year}-${month}-01`
      const lastDay = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10)
      jneQuery = jneQuery.gte('tanggal', firstDay).lte('tanggal', lastDay)
    }

    const { data: jneData, count } = await jneQuery

    return (
      <JneTransaksiWrapper
        data={jneData || []}
        totalCount={count || 0}
        page={page}
        pageSize={pageSize}
        kurirList={kurirList || []}
        filters={params}
        kurirInfo={selectedKurirData}
      />
    )
  }

  // ── Non-JNE: flow normal ──
  let kurirIdFilter: string | null = null
  if (params.kurir && selectedKurirData) {
    kurirIdFilter = selectedKurirData.id
  }

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

  let summaryQuery = supabase
    .from('transaksi')
    .select('total_biaya, diskon_booking, diskon_asuransi, diskon_forward_rate, potongan, biaya_asuransi, nama_produk, komoditas, status')
    .neq('status', 'CNX')

  if (kurirIdFilter) summaryQuery = summaryQuery.eq('kurir_id', kurirIdFilter)
  if (params.status && params.status !== 'CNX') summaryQuery = summaryQuery.eq('status', params.status)
  if (params.periode) {
    const [year, month] = params.periode.split('-')
    const firstDay = `${year}-${month}-01`
    const lastDay = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10)
    summaryQuery = summaryQuery.gte('tanggal', firstDay).lte('tanggal', lastDay)
  }

  const [{ data: transaksi, count }, { data: summaryData }] = await Promise.all([query, summaryQuery])

  const subtotalBiaya = summaryData?.reduce((acc, r) => acc + (r.total_biaya || 0), 0) || 0
  const subtotalDiskon = summaryData?.reduce((acc, r) => acc + (r.diskon_booking || 0), 0) || 0
  const subtotalDiskonAsuransi = summaryData?.reduce((acc, r) => acc + (r.diskon_asuransi || 0), 0) || 0
  const subtotalDiskonFwdRate = summaryData?.reduce((acc, r) => acc + (r.diskon_forward_rate || 0), 0) || 0
  const subtotalNetProfit = subtotalDiskon + subtotalDiskonAsuransi + subtotalDiskonFwdRate

  const produkCount: Record<string, number> = {}
  summaryData?.forEach(r => { if (r.nama_produk) produkCount[r.nama_produk] = (produkCount[r.nama_produk] || 0) + 1 })
  const produkTerpopuler = Object.entries(produkCount).sort((a, b) => b[1] - a[1])[0] || null

  const komoditasCount: Record<string, number> = {}
  summaryData?.forEach(r => { if (r.komoditas) komoditasCount[r.komoditas] = (komoditasCount[r.komoditas] || 0) + 1 })
  const komoditasTerpopuler = Object.entries(komoditasCount).sort((a, b) => b[1] - a[1])[0] || null

  return (
    <TransaksiClient
      transaksi={transaksi || []}
      totalCount={count || 0}
      page={page}
      pageSize={pageSize}
      kurirList={kurirList || []}
      filters={params}
      summary={{ subtotalBiaya, subtotalDiskon, subtotalDiskonAsuransi, subtotalDiskonFwdRate, subtotalNetProfit, produkTerpopuler, komoditasTerpopuler }}
    />
  )
}