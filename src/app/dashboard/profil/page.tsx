import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import ProfilClient from '@/components/dashboard/ProfilClient'

export default async function ProfilPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session_user')

  let profile: any = null
  let user: any = null

  if (sessionCookie?.value) {
    try {
      profile = JSON.parse(sessionCookie.value)
      user = { id: profile.id, email: profile.email }
    } catch {}
  }

  if (!profile && process.env.DATABASE_URL) {
    try {
      const res = await query('SELECT * FROM profiles ORDER BY created_at ASC LIMIT 1')
      if (res.rows.length > 0) {
        profile = res.rows[0]
        user = { id: profile.id, email: profile.email }
      }
    } catch (e) {
      console.error('Error fetching profile for profil page:', e)
    }
  }

  if (!profile) {
    redirect('/login')
  }

  return <ProfilClient user={user} profile={profile} />
}