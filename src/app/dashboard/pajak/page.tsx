import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOutlet } from '@/lib/supabase/outlet'
import { redirect } from 'next/navigation'
import PajakClient from '@/components/dashboard/PajakClient'

export const dynamic = 'force-dynamic'

export default async function PajakDashboardPage() {
  const supabase = createAdminClient()

  // ✅ Pakai helper (Fix #2)
  const outlet = await getActiveOutlet(supabase)

  if (!outlet) redirect('/dashboard')

  // Config pajak
  const { data: config } = await supabase
    .from('pajak_config')
    .select('*')
    .eq('outlet_id', outlet.id)
    .maybeSingle()

  // Rekap semua (untuk tabel ringkas & KPI)
  const { data: rekapList } = await supabase
    .from('pajak_rekap')
    .select('*')
    .eq('outlet_id', outlet.id)
    .order('periode', { ascending: false })
    .limit(24)

  // Reminder (jatuh tempo <= 30 hari ke depan)
  const { data: reminders } = await supabase
    .from('v_pajak_reminder')
    .select('*')
    .eq('outlet_id', outlet.id)
    .lte('sisa_hari', 30)
    .order('sisa_hari', { ascending: true })

  // Rekap bulan ini (untuk KPI utama)
  const now = new Date()
  const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const rekapBulanIni = (rekapList || []).find(r => r.periode === currentPeriode)

  // SPT tahunan (semua tahun yang ada)
  const { data: sptTahunan } = await supabase
    .from('v_spt_tahunan_estimator')
    .select('*')
    .eq('outlet_id', outlet.id)
    .order('tahun', { ascending: false })

  return (
    <PajakClient
      outlet={outlet}
      config={config || {}}
      rekapList={rekapList || []}
      reminders={reminders || []}
      rekapBulanIni={rekapBulanIni || null}
      currentPeriode={currentPeriode}
      sptTahunan={sptTahunan || []}
    />
  )
}
