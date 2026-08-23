import { createAdminClient } from '@/lib/supabase/server'
import HarianClient from '@/components/dashboard/HarianClient'

export default async function HarianPage() {
  const supabase = createAdminClient()

  // Ambil 30 hari terakhir
  const today = new Date()
  const since = new Date(today)
  since.setDate(today.getDate() - 30)

  const sinceStr = since.toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  // Data summary harian (per outlet per kurir per tanggal)
  const { data: summary } = await supabase
    .from('v_summary_harian')
    .select('*')
    .gte('tanggal', sinceStr)
    .order('tanggal', { ascending: false })

  // Data 7 hari terakhir untuk comparison chart
  const since7 = new Date(today)
  since7.setDate(today.getDate() - 7)
  const since7Str = since7.toISOString().slice(0, 10)

  const { data: summary7d } = await supabase
    .from('v_summary_harian')
    .select('*')
    .gte('tanggal', since7Str)
    .order('tanggal', { ascending: false })

  // 10 transaksi terbaru untuk recent activity
  const { data: recentTxRaw } = await supabase
    .from('transaksi')
    .select('id, nomor_stt, tanggal, kota_tujuan, total_biaya, status, jenis_kiriman, kurir:kurir!kurir_id(kode, nama, warna)')
    .order('tanggal', { ascending: false })
    .limit(10)

  // Normalize: Supabase bisa return kurir sebagai array atau object, kita flatten ke single object
  const recentTx = (recentTxRaw || []).map((tx: any) => ({
    ...tx,
    kurir: Array.isArray(tx.kurir) ? tx.kurir[0] ?? null : tx.kurir,
  }))

  // Daftar kurir aktif (untuk filter dropdown)
  const { data: kurirList } = await supabase
    .from('kurir')
    .select('kode, nama, warna')
    .order('kode')

  return (
    <HarianClient
      summary={summary || []}
      summary7d={summary7d || []}
      recentTx={recentTx || []}
      kurirList={kurirList || []}
      todayStr={todayStr}
    />
  )
}