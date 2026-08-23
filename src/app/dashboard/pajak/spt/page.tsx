import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOutlet } from '@/lib/supabase/outlet'
import { redirect } from 'next/navigation'
import PajakSPTClient from '@/components/dashboard/PajakSPTClient'

export const dynamic = 'force-dynamic'

export default async function PajakSPTPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

  // ✅ Pakai helper (Fix #2)
  const outlet = await getActiveOutlet(supabase)

  if (!outlet) redirect('/dashboard')

  const { data: config } = await supabase
    .from('pajak_config')
    .select('*')
    .eq('outlet_id', outlet.id)
    .maybeSingle()

  // SPT tahunan (semua tahun yang ada)
  const { data: sptTahunan } = await supabase
    .from('v_spt_tahunan_estimator')
    .select('*')
    .eq('outlet_id', outlet.id)
    .order('tahun', { ascending: false })

  // Rekap detail per bulan untuk tahun yang dipilih (default: tahun terbaru)
  const selectedTahun = params.tahun || (sptTahunan?.[0]?.tahun) || String(new Date().getFullYear())
  const { data: rekapTahunan } = await supabase
    .from('pajak_rekap')
    .select('*')
    .eq('outlet_id', outlet.id)
    .like('periode', `${selectedTahun}-%`)
    .order('periode', { ascending: true })

  const tahunList = (sptTahunan || []).map(s => s.tahun)

  return (
    <PajakSPTClient
      outlet={outlet}
      config={config || null}
      sptTahunan={sptTahunan || []}
      rekapTahunan={rekapTahunan || []}
      selectedTahun={selectedTahun}
      tahunList={tahunList}
    />
  )
}
