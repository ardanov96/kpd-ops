import { query } from '@/lib/db'
import HarianClient from '@/components/dashboard/HarianClient'

export default async function HarianPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; kurir?: string }>
}) {
  const params = await searchParams

  // 1. Ambil daftar periode bulan yang tersedia di database
  let availablePeriods: string[] = []
  try {
    const pRes = await query(`
      SELECT DISTINCT to_char(tanggal, 'YYYY-MM') as periode
      FROM v_summary_harian
      ORDER BY periode DESC
    `)
    availablePeriods = pRes.rows.map((r: any) => r.periode)
  } catch (e) {
    console.error('Error fetching available periods for harian:', e)
  }

  if (availablePeriods.length === 0) {
    availablePeriods = ['2026-08']
  }

  // Default ke periode bulan terbaru yang ada datanya di database
  const selectedPeriode = params.periode && availablePeriods.includes(params.periode)
    ? params.periode
    : availablePeriods[0]

  // 2. Query summary harian untuk periode terpilih (menggabungkan Lion Parcel & JNE)
  let summary: any[] = []
  let kurirList: any[] = []

  try {
    const [summaryRes, kurirRes] = await Promise.all([
      query(`
        SELECT 
          outlet,
          kurir_kode,
          kurir_nama,
          kurir_warna,
          to_char(tanggal, 'YYYY-MM-DD') as tanggal,
          total_paket,
          total_koli,
          total_omzet,
          total_diskon,
          net_omzet,
          pod_count,
          cnx_count,
          cod_count,
          noncod_count
        FROM v_summary_harian
        WHERE to_char(tanggal, 'YYYY-MM') = $1
        ORDER BY tanggal ASC
      `, [selectedPeriode]),
      query('SELECT kode, nama, warna FROM kurir WHERE aktif IS NOT FALSE ORDER BY kode ASC')
    ])

    summary = summaryRes.rows
    kurirList = kurirRes.rows
  } catch (e) {
    console.error('Error fetching harian page data:', e)
  }

  if (kurirList.length === 0) {
    kurirList = [
      { kode: 'LION', nama: 'Lion Parcel', warna: '#f97316' },
      { kode: 'JNE', nama: 'JNE Express', warna: '#ef4444' },
    ]
  }

  return (
    <HarianClient
      summary={summary}
      kurirList={kurirList}
      selectedPeriode={selectedPeriode}
      availablePeriods={availablePeriods}
      initialKurir={params.kurir || ''}
    />
  )
}
