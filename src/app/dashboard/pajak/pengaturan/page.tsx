import { createAdminClient } from '@/lib/supabase/server'
import { getActiveOutlet } from '@/lib/supabase/outlet'
import { redirect } from 'next/navigation'
import PajakPengaturanClient from '@/components/dashboard/PajakPengaturanClient'

export const dynamic = 'force-dynamic'

export default async function PajakPengaturanPage() {
  const supabase = createAdminClient()

  // ✅ Pakai helper (Fix #2)
  const outlet = await getActiveOutlet(supabase)

  if (!outlet) redirect('/dashboard')

  const { data: config } = await supabase
    .from('pajak_config')
    .select('*')
    .eq('outlet_id', outlet.id)
    .maybeSingle()

  return <PajakPengaturanClient outlet={outlet} config={config || null} />
}
