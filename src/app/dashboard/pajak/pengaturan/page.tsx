import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PajakPengaturanClient from '@/components/dashboard/PajakPengaturanClient'

export const dynamic = 'force-dynamic'

export default async function PajakPengaturanPage() {
  const supabase = createAdminClient()

  const { data: outlet } = await supabase
    .from('outlets')
    .select('id, kode, nama')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!outlet) redirect('/dashboard')

  const { data: config } = await supabase
    .from('pajak_config')
    .select('*')
    .eq('outlet_id', outlet.id)
    .maybeSingle()

  return <PajakPengaturanClient outlet={outlet} config={config || null} />
}
