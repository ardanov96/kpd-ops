import { createAdminClient } from '@/lib/supabase/server'
import AkuntingLaporanClient from '@/components/dashboard/AkuntingLaporanClient'

export const dynamic = 'force-dynamic'

export default async function LaporanLabaRugiPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

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

  const now = new Date()
  const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const selectedPeriode = params.periode || currentPeriode

  // Laba-Rugi periode ini
  const { data: lr } = await supabase
    .from('v_laba_rugi')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('periode', selectedPeriode)
    .maybeSingle()

  // Breakdown per kategori
  const { data: breakdown } = await supabase
    .from('v_keuangan_per_kategori')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('periode', selectedPeriode)
    .order('kategori_tipe')
    .order('kategori_kode')

  // Cashflow untuk periode ini
  const { data: cashflow } = await supabase
    .from('v_cashflow')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('periode', selectedPeriode)

  // Neraca (snapshot)
  const { data: neraca } = await supabase
    .from('v_neraca')
    .select('*')
    .eq('outlet_id', outlet.id)
    .maybeSingle()

  return (
    <AkuntingLaporanClient
      outlet={outlet}
      selectedPeriode={selectedPeriode}
      currentPeriode={currentPeriode}
      labaRugi={lr || { total_income: 0, total_expense: 0, laba_kotor: 0 }}
      breakdown={breakdown || []}
      cashflow={cashflow || []}
      neraca={neraca || null}
    />
  )
}
