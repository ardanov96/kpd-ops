import { createAdminClient } from '@/lib/supabase/server'
import AkuntingClosingClient from '@/components/dashboard/AkuntingClosingClient'

export const dynamic = 'force-dynamic'

export default async function AkuntingClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

  // Outlet pertama
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

  // Default = bulan ini; tapi tampilkan rekomendasi bulan kemarin (closing biasanya akhir bulan)
  const now = new Date()
  const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  // Jika hari ini <= 5, rekomendasikan closing bulan kemarin (akhir bulan)
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const recommendedPeriode = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}`
  const selectedPeriode = params.periode || currentPeriode

  // Ambil preview laba-rugi untuk periode yang dipilih
  const { data: lr } = await supabase
    .from('v_laba_rugi')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('periode', selectedPeriode)
    .maybeSingle()

  // Cek apakah sudah closing
  const { data: existing } = await supabase
    .from('periode_closing')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('periode', selectedPeriode)
    .maybeSingle()

  // History closing (12 terakhir)
  const { data: history } = await supabase
    .from('periode_closing')
    .select('*')
    .eq('outlet_id', outlet.id)
    .order('periode', { ascending: false })
    .limit(12)

  return (
    <AkuntingClosingClient
      outlet={outlet}
      selectedPeriode={selectedPeriode}
      recommendedPeriode={recommendedPeriode}
      currentPeriode={currentPeriode}
      preview={lr || { total_income: 0, total_expense: 0, laba_kotor: 0 }}
      existing={existing}
      history={history || []}
    />
  )
}
