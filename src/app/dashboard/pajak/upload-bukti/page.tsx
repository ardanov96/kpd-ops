import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOutlet } from '@/lib/supabase/outlet'
import { redirect } from 'next/navigation'
import PajakUploadBuktiClient from '@/components/dashboard/PajakUploadBuktiClient'

export const dynamic = 'force-dynamic'

export default async function PajakUploadBuktiPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

  // ✅ Pakai helper (Fix #2)
  const outlet = await getActiveOutlet(supabase)

  if (!outlet) redirect('/dashboard')

  // List rekap yg BELUM atau yang sudah LUNAS (untuk lihat history)
  const { data: rekapList } = await supabase
    .from('pajak_rekap')
    .select('*')
    .eq('outlet_id', outlet.id)
    .order('periode', { ascending: false })
    .limit(36)

  // Initial selected: yg BELUM bayar paling lama, atau sesuai ?id=
  let initialId = params.id
  if (!initialId) {
    const belum = (rekapList || []).find(r => r.status_bayar === 'BELUM')
    initialId = belum?.id
  }
  const initialRekap = (rekapList || []).find(r => r.id === initialId) || null

  return (
    <PajakUploadBuktiClient
      outlet={outlet}
      rekapList={rekapList || []}
      initialId={initialId || ''}
      initialRekap={initialRekap}
    />
  )
}
