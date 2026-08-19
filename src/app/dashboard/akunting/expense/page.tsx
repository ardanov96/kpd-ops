import { createAdminClient } from '@/lib/supabase/server'
import AkuntingExpenseForm from '@/components/dashboard/AkuntingExpenseForm'

export const dynamic = 'force-dynamic'

export default async function AkuntingExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; tipe?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

  // Ambil outlet pertama
  const { data: outlet } = await supabase
    .from('outlets')
    .select('id, kode, nama')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!outlet) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#f1f5f9' }}>Belum ada outlet</h1>
      </div>
    )
  }

  // Ambil kategori akun (expense + income + equity)
  const { data: kategoriList } = await supabase
    .from('kategori_akun')
    .select('*')
    .order('tipe')
    .order('urutan')
    .order('kode')

  // Filter transaksi by query
  let query = supabase
    .from('transaksi_keuangan')
    .select('*, kategori:kategori_akun(kode, nama, tipe)')
    .eq('outlet_id', outlet.id)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (params.periode) {
    query = query.eq('periode', params.periode) as any
  }
  if (params.tipe) {
    query = query.eq('tipe', params.tipe) as any
  }

  const { data: transaksiList } = await query

  return (
    <AkuntingExpenseForm
      outlet={outlet}
      kategoriList={kategoriList || []}
      transaksiList={transaksiList || []}
      filterPeriode={params.periode || ''}
      filterTipe={params.tipe || ''}
    />
  )
}
