import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { query, isDatabaseConfigured } from '@/lib/db'
import { verifySession } from '@/lib/session'
import Sidebar from '@/components/Sidebar'
import MobileShell from '@/components/dashboard/MobileShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  let profile = await verifySession<any>(cookieStore.get('session_user')?.value)
  let user: any = profile ? { id: profile.id, email: profile.email } : null

  if (!profile && isDatabaseConfigured) {
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

  if (isDatabaseConfigured) {
    try {
      const kurirPromise = query('SELECT kode, nama, warna FROM kurir WHERE aktif IS NOT FALSE ORDER BY nama ASC')
      const invAlertPromise = query('SELECT COUNT(*)::int as count FROM v_stok_aktual WHERE is_below_min = true')
      const pajakAlertPromise = profile.role === 'owner'
        ? query('SELECT COUNT(*)::int as count FROM v_pajak_reminder WHERE sisa_hari <= 7')
        : Promise.resolve({ rows: [{ count: 0 }] } as any)

      const [kRes, iRes, pRes] = await Promise.allSettled([
        kurirPromise,
        invAlertPromise,
        pajakAlertPromise
      ])

      if (kRes.status === 'fulfilled') kurirAktif = kRes.value.rows
      if (iRes.status === 'fulfilled') inventarisAlert = iRes.value.rows[0]?.count || 0
      if (pRes.status === 'fulfilled') pajakAlert = pRes.value.rows[0]?.count || 0
    } catch (e) {
      console.error('Error fetching layout data from Neon:', e)
    }
  }

  if (kurirAktif.length === 0) {
    kurirAktif = [
      { kode: 'LION', nama: 'Lion Parcel', warna: '#f97316' },
      { kode: 'JNE', nama: 'JNE Express', warna: '#ef4444' },
    ]
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
