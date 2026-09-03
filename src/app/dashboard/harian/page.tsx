import { query } from '@/lib/db'
import HarianClient from '@/components/dashboard/HarianClient'

export default async function HarianPage() {
  const today = new Date()
  const since = new Date(today)
  since.setDate(today.getDate() - 30)

  const sinceStr = since.toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  const since7 = new Date(today)
  since7.setDate(today.getDate() - 7)
  const since7Str = since7.toISOString().slice(0, 10)

  let summary: any[] = []
  let summary7d: any[] = []
  let recentTx: any[] = []
  let kurirList: any[] = []

  try {
    const sumRes = await query(
      'SELECT * FROM v_summary_harian WHERE tanggal >= $1 ORDER BY tanggal DESC',
      [sinceStr]
    )
    summary = sumRes.rows

    const sum7Res = await query(
      'SELECT * FROM v_summary_harian WHERE tanggal >= $1 ORDER BY tanggal DESC',
      [since7Str]
    )
    summary7d = sum7Res.rows

    const txRes = await query(`
      SELECT t.id, t.nomor_stt, to_char(t.tanggal, 'YYYY-MM-DD') as tanggal, t.kota_tujuan, t.total_biaya, t.status, t.jenis_kiriman,
        json_build_object('kode', k.kode, 'nama', k.nama, 'warna', k.warna) as kurir
      FROM transaksi t
      LEFT JOIN kurir k ON k.id = t.kurir_id
      ORDER BY t.tanggal DESC
      LIMIT 10
    `)
    recentTx = txRes.rows

    const kurirRes = await query('SELECT kode, nama, warna FROM kurir WHERE aktif IS NOT FALSE ORDER BY kode ASC')
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

  const sanitizeDate = (val: any): string => {
    if (!val) return ''
    if (typeof val === 'string') return val.slice(0, 10)
    if (val instanceof Date) return val.toISOString().slice(0, 10)
    return String(val).slice(0, 10)
  }

  const safeSummary = summary.map(r => ({ ...r, tanggal: sanitizeDate(r.tanggal) }))
  const safeSummary7d = summary7d.map(r => ({ ...r, tanggal: sanitizeDate(r.tanggal) }))
  const safeRecentTx = recentTx.map(r => ({ ...r, tanggal: sanitizeDate(r.tanggal) }))

  return (
    <HarianClient
      summary={safeSummary}
      summary7d={safeSummary7d}
      recentTx={safeRecentTx}
      kurirList={kurirList}
      todayStr={todayStr}
    />
  )
}