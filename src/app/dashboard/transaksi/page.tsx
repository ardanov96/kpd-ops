import { createClient } from '@/lib/supabase/server'
import TransaksiClient from '@/components/dashboard/TransaksiClient'

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ kurir?: string; status?: string; periode?: string; page?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const page = Number(params.page || 1)
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // ✅ Ambil kurir_id dulu jika ada filter kurir
  let kurirIdFilter: string | null = null
  if (params.kurir) {
    const { data: k } = await supabase
      .from('kurir')
      .select('id')
      .eq('kode', params.kurir)
      .single()
    kurirIdFilter = k?.id || null
  }

  let query = supabase
    .from('transaksi')
    .select('*, kurir(kode, nama, warna)', { count: 'exact' }) // ✅ hapus join outlets
    .order('tanggal', { ascending: false })
    .range(from, to)

  // ✅ Filter pakai kurir_id bukan kurir.kode
  if (kurirIdFilter) query = query.eq('kurir_id', kurirIdFilter)
  if (params.status) query = query.eq('status', params.status)
  if (params.periode) query = query.like('tanggal', `${params.periode}%`)

  const { data: transaksi, count } = await query
  const { data: kurir } = await supabase.from('kurir').select('kode, nama').order('nama')

  return (
    <TransaksiClient
      transaksi={transaksi || []}
      totalCount={count || 0}
      page={page}
      pageSize={pageSize}
      kurirList={kurir || []}
      filters={params}
    />
  )
}