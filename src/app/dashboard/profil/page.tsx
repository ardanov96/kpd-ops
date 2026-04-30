import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfilClient from '@/components/dashboard/ProfilClient'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <ProfilClient user={user} profile={profile} />
}