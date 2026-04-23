import { createClient } from '@/lib/supabase/server'
import TransaksiClient from '@/components/dashboard/TransaksiClient'

export default async function TransaksiPage({
  searchParams,
}: {
  searchParams: { kurir?: string; status?: string; periode?: string; page?: string }
}) {
  const supabase = createClient()
  const page = Number(searchParams.page || 1)
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('transaksi')
    .select('*, kurir(kode, nama, warna), outlet:outlets(nama)', { count: 'exact' })
    .order('tanggal', { ascending: false })
    .range(from, to)

  if (searchParams.kurir) query = query.eq('kurir.kode', searchParams.kurir)
  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.periode) query = query.like('tanggal', `${searchParams.periode}%`)

  const { data: transaksi, count } = await query

  const { data: kurir } = await supabase.from('kurir').select('*')

  return (
    <TransaksiClient
      transaksi={transaksi || []}
      totalCount={count || 0}
      page={page}
      pageSize={pageSize}
      kurirList={kurir || []}
      filters={searchParams}
    />
  )
}
