import { createClient } from '@/lib/supabase/server'
import TransaksiClient from '@/components/dashboard/TransaksiClient'

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ kurir?: string; status?: string; periode?: string; page?: string }>
}) {
  const supabase = await createClient()          // ✅ await
  const params = await searchParams              // ✅ await searchParams (Next.js 15)

  const page = Number(params.page || 1)
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('transaksi')
    .select('*, kurir(kode, nama, warna), outlet:outlets(nama)', { count: 'exact' })
    .order('tanggal', { ascending: false })
    .range(from, to)

  if (params.kurir) query = query.eq('kurir.kode', params.kurir)
  if (params.status) query = query.eq('status', params.status)
  if (params.periode) query = query.like('tanggal', `${params.periode}%`)

  const { data: transaksi, count } = await query
  const { data: kurir } = await supabase.from('kurir').select('*')

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