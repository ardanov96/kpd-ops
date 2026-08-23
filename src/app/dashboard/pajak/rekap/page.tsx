import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOutlet } from '@/lib/supabase/outlet'
import { redirect } from 'next/navigation'
import PajakRekapClient from '@/components/dashboard/PajakRekapClient'

export const dynamic = 'force-dynamic'

export default async function PajakRekapPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string; status?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

  // ✅ Pakai helper (Fix #2)
  const outlet = await getActiveOutlet(supabase)

  if (!outlet) redirect('/dashboard')

  // Build query
  let query = supabase
    .from('pajak_rekap')
    .select('*')
    .eq('outlet_id', outlet.id)
    .order('periode', { ascending: false })

  if (params.tahun) query = query.like('periode', `${params.tahun}-%`)
  if (params.status) query = query.eq('status_bayar', params.status)

  const { data: rekapList } = await query

  // Ambil juga SPT tahunan untuk filter chips
  const { data: sptTahunan } = await supabase
    .from('v_spt_tahunan_estimator')
    .select('tahun')
    .eq('outlet_id', outlet.id)
    .order('tahun', { ascending: false })

  const tahunList = Array.from(new Set((sptTahunan || []).map(s => s.tahun)))
  // tambahkan tahun sekarang
  const thisYear = String(new Date().getFullYear())
  if (!tahunList.includes(thisYear)) tahunList.unshift(thisYear)

  return (
    <PajakRekapClient
      outlet={outlet}
      rekapList={rekapList || []}
      tahunList={tahunList}
      selectedTahun={params.tahun || ''}
      selectedStatus={params.status || ''}
    />
  )
}
