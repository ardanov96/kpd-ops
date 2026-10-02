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
  let isLion = false

  try {
    const kurirRes = await query('SELECT id, kode, nama, warna FROM kurir WHERE aktif IS NOT FALSE ORDER BY nama ASC')
    kurirList = kurirRes.rows
    selectedKurirData = kurirList.find((k) => k.kode === params.kurir)
    isJNE = selectedKurirData?.kode === 'JNE'
    isLion = selectedKurirData?.kode === 'LION'
  } catch (e) {
    console.error('Error fetching kurir:', e)
  }

  if (kurirList.length === 0) {
    kurirList = [
      { id: '00000000-0000-0000-0000-000000000010', kode: 'LION', nama: 'Lion Parcel', warna: '#f97316' },
      { id: '00000000-0000-0000-0000-000000000020', kode: 'JNE', nama: 'JNE Express', warna: '#ef4444' },
    ]
    selectedKurirData = kurirList.find((k) => k.kode === params.kurir)
    isJNE = selectedKurirData?.kode === 'JNE'
    isLion = selectedKurirData?.kode === 'LION'
  }

  // ─── Khusus JNE: Jika tab JNE dipilih spesifik, tampilkan tabel detail Packing List ───
  if (isJNE && selectedKurirData) {
    let jneSql = 'SELECT * FROM jne_packing_list WHERE kurir_id = $1'
    let countSql = 'SELECT COUNT(*)::int as count FROM jne_packing_list WHERE kurir_id = $1'
    let sumJneSql = `
      SELECT COALESCE(SUM(amount), 0) AS subtotal_biaya,
             COALESCE(SUM(publish_rate), 0) AS subtotal_publish_rate,
             COALESCE(SUM(discount), 0) AS subtotal_discount,
             COALESCE(SUM(COALESCE(disc_others, 0)), 0) AS subtotal_disc_others,
             COALESCE(SUM(insurance), 0) AS subtotal_asuransi,
             COALESCE(SUM(vat_amount), 0) AS subtotal_ppn,
             COALESCE(SUM(total_net), 0) AS subtotal_net_profit,
             COALESCE(SUM(outstanding), 0) AS subtotal_outstanding,
             COALESCE(SUM(cnote_count), 0) AS total_cnote,
             COALESCE(SUM(coly), 0) AS total_coly,
             COALESCE(SUM(weight), 0) AS total_weight,
             COUNT(*) FILTER (WHERE outstanding > 0) AS belum_lunas
      FROM jne_packing_list WHERE kurir_id = $1
    `
    const queryParams: any[] = [selectedKurirData.id]

    if (params.periode) {
      if (/^\d{4}-\d{2}$/.test(params.periode)) {
        queryParams.push(params.periode)
        jneSql += ` AND to_char(tanggal, 'YYYY-MM') = $${queryParams.length}`
        countSql += ` AND to_char(tanggal, 'YYYY-MM') = $${queryParams.length}`
        sumJneSql += ` AND to_char(tanggal, 'YYYY-MM') = $${queryParams.length}`
      } else if (/^\d{4}$/.test(params.periode)) {
        queryParams.push(params.periode)
        jneSql += ` AND to_char(tanggal, 'YYYY') = $${queryParams.length}`
        countSql += ` AND to_char(tanggal, 'YYYY') = $${queryParams.length}`
        sumJneSql += ` AND to_char(tanggal, 'YYYY') = $${queryParams.length}`
      }
    }

    if (params.status) {
      if (params.status === 'LUNAS') {
        jneSql += ` AND outstanding <= 0`
        countSql += ` AND outstanding <= 0`
        sumJneSql += ` AND outstanding <= 0`
      } else if (params.status === 'BELUM_LUNAS') {
        jneSql += ` AND outstanding > 0`
        countSql += ` AND outstanding > 0`
        sumJneSql += ` AND outstanding > 0`
      }
    }

    jneSql += ` ORDER BY tanggal DESC LIMIT ${pageSize} OFFSET ${offset}`

    let jneData: any[] = []
    let totalCount = 0
    let jneSummary: any = null

    try {
      const dataRes = await query(jneSql, queryParams)
      const countRes = await query(countSql, queryParams)
      const sumRes = await query(sumJneSql, queryParams)
      jneData = dataRes.rows
      totalCount = countRes.rows[0]?.count || 0
      jneSummary = sumRes.rows[0]
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
        summary={jneSummary}
      />
    )
  }

  // ─── Semua Ekspedisi (Gabungan Lion Parcel & JNE) ATAU Lion Parcel Spesifik ───
  const sqlParams: any[] = []
  const tWhere = ['1=1']
  const jWhere = ['1=1']

  if (params.periode) {
    if (/^\d{4}-\d{2}$/.test(params.periode)) {
      sqlParams.push(params.periode)
      const pIdx = sqlParams.length
      tWhere.push(`to_char(t.tanggal, 'YYYY-MM') = $${pIdx}`)
      jWhere.push(`to_char(j.tanggal, 'YYYY-MM') = $${pIdx}`)
    } else if (/^\d{4}$/.test(params.periode)) {
      sqlParams.push(params.periode)
      const pIdx = sqlParams.length
      tWhere.push(`to_char(t.tanggal, 'YYYY') = $${pIdx}`)
      jWhere.push(`to_char(j.tanggal, 'YYYY') = $${pIdx}`)
    }
  }

  if (params.status) {
    sqlParams.push(params.status)
    const sIdx = sqlParams.length
    tWhere.push(`t.status = $${sIdx}`)
    if (params.status === 'LUNAS') {
      jWhere.push(`j.outstanding <= 0`)
    } else if (params.status === 'BELUM_LUNAS') {
      jWhere.push(`j.outstanding > 0`)
    } else {
      // Status khusus Lion Parcel (misal POD, CNX) tidak ada pada packing list JNE
      jWhere.push('1=0')
    }
  }

  const tWhereStr = tWhere.join(' AND ')
  const jWhereStr = jWhere.join(' AND ')

  let unionQuery = ''
  let summaryQuery = ''

  if (isLion) {
    unionQuery = `
      SELECT 
        t.id, t.tanggal, t.nomor_stt,
        json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir,
        t.kota_tujuan, t.nama_produk, t.komoditas, t.koli,
        t.berat_kena_biaya, t.biaya_asuransi, t.total_biaya,
        t.potongan, t.diskon_booking, t.diskon_asuransi, t.diskon_forward_rate,
        t.status
      FROM transaksi t
      JOIN kurir k ON k.id = t.kurir_id
      WHERE ${tWhereStr}
    `

    summaryQuery = `
      SELECT t.total_biaya, t.diskon_booking, t.diskon_asuransi, t.diskon_forward_rate, 
             t.potongan, t.biaya_asuransi, t.nama_produk, t.komoditas, t.status,
             to_char(t.tanggal, 'YYYY-MM') as periode,
             'LION' as kurir_kode
      FROM transaksi t
      WHERE ${tWhereStr}
    `
  } else {
    // Default: Semua Ekspedisi (Lion Parcel + JNE Express)
    unionQuery = `
      SELECT 
        t.id, t.tanggal, t.nomor_stt,
        json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir,
        t.kota_tujuan, t.nama_produk, t.komoditas, t.koli,
        t.berat_kena_biaya, t.biaya_asuransi, t.total_biaya,
        t.potongan, t.diskon_booking, t.diskon_asuransi, t.diskon_forward_rate,
        t.status
      FROM transaksi t
      JOIN kurir k ON k.id = t.kurir_id
      WHERE ${tWhereStr}

      UNION ALL

      SELECT 
        j.id, j.tanggal, j.nomor_pl as nomor_stt,
        json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir,
        'JNE Hub / Agen' as kota_tujuan,
        'Packing List' as nama_produk,
        (j.cnote_count || ' Paket Cnote') as komoditas,
        j.coly as koli,
        j.weight as berat_kena_biaya,
        j.insurance as biaya_asuransi,
        j.amount as total_biaya,
        0 as potongan,
        (j.discount + COALESCE(j.disc_others, 0)) as diskon_booking,
        0 as diskon_asuransi,
        0 as diskon_forward_rate,
        CASE WHEN j.outstanding <= 0 THEN 'LUNAS' ELSE 'BELUM_LUNAS' END as status
      FROM jne_packing_list j
      JOIN kurir k ON k.id = j.kurir_id
      WHERE ${jWhereStr}
    `

    summaryQuery = `
      SELECT t.total_biaya, t.diskon_booking, t.diskon_asuransi, t.diskon_forward_rate, 
             t.potongan, t.biaya_asuransi, t.nama_produk, t.komoditas, t.status,
             to_char(t.tanggal, 'YYYY-MM') as periode,
             'LION' as kurir_kode
      FROM transaksi t
      WHERE ${tWhereStr}

      UNION ALL

      SELECT
        j.amount as total_biaya,
        (j.discount + COALESCE(j.disc_others, 0)) as diskon_booking,
        0 as diskon_asuransi,
        0 as diskon_forward_rate,
        0 as potongan,
        j.insurance as biaya_asuransi,
        'Packing List' as nama_produk,
        (j.cnote_count || ' Paket Cnote') as komoditas,
        CASE WHEN j.outstanding <= 0 THEN 'LUNAS' ELSE 'BELUM_LUNAS' END as status,
        to_char(j.tanggal, 'YYYY-MM') as periode,
        'JNE' as kurir_kode
      FROM jne_packing_list j
      WHERE ${jWhereStr}
    `
  }

  let transaksi: any[] = []
  let totalCount = 0
  let summaryData: any[] = []

  try {
    const dataSql = `
      SELECT * FROM (${unionQuery}) u
      ORDER BY u.tanggal DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `
    const countSql = `SELECT COUNT(*)::int as count FROM (${unionQuery}) u`

    const dRes = await query(dataSql, sqlParams)
    const cRes = await query(countSql, sqlParams)
    const sRes = await query(summaryQuery, sqlParams)

    transaksi = dRes.rows
    totalCount = cRes.rows[0]?.count || 0
    summaryData = sRes.rows
  } catch (e) {
    console.error('Error fetching transaksi page data:', e)
  }

  // Penalty Lion Parcel: dihitung on-the-fly per bulan/periode agar
  // konsisten dengan modul Ringkasan & Analitik.
  // Aturan: Lion omzet > 0 dan < 3jt per bulan, mulai April 2024 -> penalty 500rb per bulan
  const LION_PENALTY_START_PERIODE = '2024-04'
  const lionOmzetByPeriode: Record<string, number> = {}
  summaryData.forEach((r) => {
    if (r.kurir_kode === 'LION') {
      const p = String(r.periode || '').slice(0, 7)
      if (!p || p < LION_PENALTY_START_PERIODE) return
      lionOmzetByPeriode[p] = (lionOmzetByPeriode[p] || 0) + (Number(r.total_biaya) || 0)
    }
  })

  let totalPenalty = 0
  let penaltyCount = 0
  for (const lionOmzet of Object.values(lionOmzetByPeriode)) {
    if (lionOmzet > 0 && lionOmzet < 3000000) {
      totalPenalty += 500000
      penaltyCount++
    }
  }

  // Ringkasan transaksi exclude CNX agar konsisten dengan kartu Subtotal & Overview
  const nonCNX = summaryData.filter((r) => r.status !== 'CNX')

  const subtotalBiaya = nonCNX.reduce((acc, r) => acc + (Number(r.total_biaya) || 0), 0)
  const subtotalDiskon = nonCNX.reduce((acc, r) => acc + (Number(r.diskon_booking) || 0), 0)
  const subtotalDiskonAsuransi = nonCNX.reduce((acc, r) => acc + (Number(r.diskon_asuransi) || 0), 0)
  const subtotalDiskonFwdRate = nonCNX.reduce((acc, r) => acc + (Number(r.diskon_forward_rate) || 0), 0)
  const totalKomisiFranchise = subtotalDiskon + subtotalDiskonAsuransi + subtotalDiskonFwdRate
  const subtotalNetProfit = totalKomisiFranchise - totalPenalty

  const produkCount: Record<string, number> = {}
  nonCNX.forEach((r) => {
    if (r.nama_produk) produkCount[r.nama_produk] = (produkCount[r.nama_produk] || 0) + 1
  })
  const produkTerpopuler = Object.entries(produkCount).sort((a, b) => b[1] - a[1])[0] || null

  const komoditasAgg: Record<string, { count: number; omzet: number }> = {}
  nonCNX.forEach((r) => {
    if (!r.komoditas) return
    const k = r.komoditas
    if (!komoditasAgg[k]) komoditasAgg[k] = { count: 0, omzet: 0 }
    komoditasAgg[k].count += 1
    komoditasAgg[k].omzet += Number(r.total_biaya) || 0
  })
  const komoditasTop3 = Object.entries(komoditasAgg)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([name, v]) => [name, v.count, v.omzet] as [string, number, number])
  const totalOmzetKomoditasTop3 = komoditasTop3.reduce((s, [, , omzet]) => s + omzet, 0)

  return (
    <TransaksiClient
      transaksi={transaksi}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      kurirList={kurirList}
      filters={params}
      summary={{
        subtotalBiaya,
        subtotalDiskon,
        subtotalDiskonAsuransi,
        subtotalDiskonFwdRate,
        subtotalNetProfit,
        totalPenalty,
        penaltyCount,
        produkTerpopuler,
        komoditasTop3,
        totalOmzetKomoditasTop3,
      }}
    />
  )
}
