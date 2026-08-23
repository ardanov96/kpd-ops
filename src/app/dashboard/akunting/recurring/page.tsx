import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOutlet } from '@/lib/supabase/outlet'
import AkuntingRecurringClient from '@/components/dashboard/AkuntingRecurringClient'

export const dynamic = 'force-dynamic'

export default async function AkuntingRecurringPage() {
  const supabase = createAdminClient()

  // ✅ Pakai helper (Fix #2)
  const outlet = await getActiveOutlet(supabase)

  if (!outlet) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#f1f5f9' }}>Belum ada outlet</h1>
      </div>
    )
  }

  // Ambil kategori akun (expense + income)
  const { data: kategoriList } = await supabase
    .from('kategori_akun')
    .select('*')
    .in('tipe', ['INCOME', 'EXPENSE'])
    .order('tipe')
    .order('urutan')

  // Ambil template recurring untuk outlet ini
  const { data: recurringList } = await supabase
    .from('recurring_transactions')
    .select('*, kategori:kategori_akun(kode, nama, tipe)')
    .eq('outlet_id', outlet.id)
    .order('aktif', { ascending: false })
    .order('tanggal_setiap_bulan')

  return (
    <AkuntingRecurringClient
      outlet={outlet}
      kategoriList={kategoriList || []}
      recurringList={recurringList || []}
    />
  )
}
