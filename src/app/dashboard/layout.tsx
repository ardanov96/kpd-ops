import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import Sidebar from '@/components/Sidebar'
import MobileShell from '@/components/dashboard/MobileShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session_user')

  let user: any = null
  let profile: any = null

  if (sessionCookie?.value) {
    try {
      profile = JSON.parse(sessionCookie.value)
      user = { id: profile.id, email: profile.email }
    } catch {}
  }

  if (!profile && process.env.DATABASE_URL) {
    try {
      const profileRes = await query(
        'SELECT p.*, o.kode as outlet_kode, o.nama as outlet_nama FROM profiles p LEFT JOIN outlets o ON o.id = p.outlet_id ORDER BY p.created_at ASC LIMIT 1'
      )
      if (profileRes.rows.length > 0) {
        profile = profileRes.rows[0]
        user = { id: profile.id, email: profile.email }
      }
    } catch (e) {
      console.error('Error fetching profile from Postgres:', e)
    }
  }

  if (!profile) {
    redirect('/login')
  }

  let kurirAktif: any[] = []
  let inventarisAlert = 0
  let pajakAlert = 0

  if (process.env.DATABASE_URL) {
    try {
      const kurirRes = await query('SELECT kode, nama, warna FROM kurir ORDER BY nama ASC')
      kurirAktif = kurirRes.rows

      const invAlertRes = await query('SELECT COUNT(*)::int as count FROM v_stok_aktual WHERE is_below_min = true')
      inventarisAlert = invAlertRes.rows[0]?.count || 0

      if (profile.role === 'owner') {
        const pajakAlertRes = await query('SELECT COUNT(*)::int as count FROM v_pajak_reminder WHERE sisa_hari <= 7')
        pajakAlert = pajakAlertRes.rows[0]?.count || 0
      }
    } catch (e) {
      console.error('Error fetching layout data from Neon:', e)
    }
  }

  return (
    <MobileShell>
      <Sidebar
        user={user}
        profile={profile}
        kurirAktif={kurirAktif}
        alertCounts={{ inventaris: inventarisAlert, pajak: pajakAlert }}
      />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </MobileShell>
  )
}
