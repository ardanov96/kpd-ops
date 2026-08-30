import { query } from '@/lib/db'
import TransaksiClient from '@/components/dashboard/TransaksiClient'
import JneTransaksiWrapper from '@/components/dashboard/JneTransaksiWrapper'

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ kurir?: string; status?: string; periode?: string; page?: string }>
}) {
  const params = await searchParams

  const page = Number(params.page || 1)
  const pageSize = 50
  const offset = (page - 1) * pageSize

  let kurirList: any[] = []
  let selectedKurirData: any = null
  let isJNE = false

  try {
    const kurirRes = await query('SELECT id, kode, nama, warna FROM kurir ORDER BY nama ASC')
    kurirList = kurirRes.rows
    selectedKurirData = kurirList.find((k) => k.kode === params.kurir)
    isJNE = selectedKurirData?.kode === 'JNE'
  } catch (e) {
    console.error('Error fetching kurir:', e)
  }

  // ── JNE ──
  if (isJNE && selectedKurirData) {
    let jneSql = 'SELECT * FROM jne_packing_list WHERE kurir_id = $1'
    let countSql = 'SELECT COUNT(*)::int as count FROM jne_packing_list WHERE kurir_id = $1'
    const queryParams: any[] = [selectedKurirData.id]

    if (params.periode) {
      const [year, month] = params.periode.split('-')
      const firstDay = `${year}-${month}-01`
      const lastDay = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10)

      queryParams.push(firstDay, lastDay)
      jneSql += ` AND tanggal >= $2 AND tanggal <= $3`
      countSql += ` AND tanggal >= $2 AND tanggal <= $3`
    }

    jneSql += ` ORDER BY tanggal DESC LIMIT ${pageSize} OFFSET ${offset}`

    let jneData: any[] = []
    let totalCount = 0

    try {
      const [dataRes, countRes] = await Promise.all([
        query(jneSql, queryParams),
        query(countSql, queryParams),
      ])
      jneData = dataRes.rows
      totalCount = countRes.rows[0]?.count || 0
    } catch (e) {
      console.error('Error fetching JNE data:', e)
    }

    return (
      <JneTransaksiWrapper
        data={jneData}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        kurirList={kurirList}
        filters={params}
        kurirInfo={selectedKurirData}
      />
    )
  }

  // ── Non-JNE ──
  let whereClauses: string[] = ['1=1']
  const sqlParams: any[] = []

  if (params.kurir && selectedKurirData) {
    sqlParams.push(selectedKurirData.id)
    whereClauses.push(`t.kurir_id = $${sqlParams.length}`)
  }
  if (params.status) {
    sqlParams.push(params.status)
    whereClauses.push(`t.status = $${sqlParams.length}`)
  }
  if (params.periode) {
    const [year, month] = params.periode.split('-')
    const firstDay = `${year}-${month}-01`
    const lastDay = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10)

    sqlParams.push(firstDay)
    whereClauses.push(`t.tanggal >= $${sqlParams.length}`)
    sqlParams.push(lastDay)
    whereClauses.push(`t.tanggal <= $${sqlParams.length}`)
  }

  const whereSql = whereClauses.join(' AND ')

  let transaksi: any[] = []
  let totalCount = 0
  let summaryData: any[] = []

  try {
    const dataSql = `
      SELECT t.*,
        json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir
      FROM transaksi t
      LEFT JOIN kurir k ON k.id = t.kurir_id
      WHERE ${whereSql}
      ORDER BY t.tanggal DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
    const countSql = `SELECT COUNT(*)::int as count FROM transaksi t WHERE ${whereSql}`
    const sumSql = `
      SELECT total_biaya, diskon_booking, diskon_asuransi, diskon_forward_rate, potongan, biaya_asuransi, nama_produk, komoditas, status
      FROM transaksi t
      WHERE ${whereSql} AND t.status != 'CNX'
    `

    const [dRes, cRes, sRes] = await Promise.all([
      query(dataSql, sqlParams),
      query(countSql, sqlParams),
      query(sumSql, sqlParams),
    ])

    transaksi = dRes.rows
    totalCount = cRes.rows[0]?.count || 0
    summaryData = sRes.rows
  } catch (e) {
    console.error('Error fetching transaksi page data:', e)
  }

  const subtotalBiaya = summaryData.reduce((acc, r) => acc + (Number(r.total_biaya) || 0), 0)
  const subtotalDiskon = summaryData.reduce((acc, r) => acc + (Number(r.diskon_booking) || 0), 0)
  const subtotalDiskonAsuransi = summaryData.reduce((acc, r) => acc + (Number(r.diskon_asuransi) || 0), 0)
  const subtotalDiskonFwdRate = summaryData.reduce((acc, r) => acc + (Number(r.diskon_forward_rate) || 0), 0)
  const subtotalNetProfit = subtotalDiskon + subtotalDiskonAsuransi + subtotalDiskonFwdRate

  const produkCount: Record<string, number> = {}
  summaryData.forEach((r) => { if (r.nama_produk) produkCount[r.nama_produk] = (produkCount[r.nama_produk] || 0) + 1 })
  const produkTerpopuler = Object.entries(produkCount).sort((a, b) => b[1] - a[1])[0] || null

  const komoditasCount: Record<string, number> = {}
  summaryData.forEach((r) => { if (r.komoditas) komoditasCount[r.komoditas] = (komoditasCount[r.komoditas] || 0) + 1 })
  const komoditasTerpopuler = Object.entries(komoditasCount).sort((a, b) => b[1] - a[1])[0] || null

  return (
    <TransaksiClient
      transaksi={transaksi}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      kurirList={kurirList}
      filters={params}
      summary={{ subtotalBiaya, subtotalDiskon, subtotalDiskonAsuransi, subtotalDiskonFwdRate, subtotalNetProfit, produkTerpopuler, komoditasTerpopuler }}
    />
  )
}