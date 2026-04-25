import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()  // ✅ add await here
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  else redirect('/login')
}