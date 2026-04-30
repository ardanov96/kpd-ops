import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, outlets(*)')
    .eq('id', user.id)
    .single()

  // ✅ Tambah fetch kurir aktif
  const { data: kurirAktif } = await supabase
    .from('kurir')
    .select('kode, nama, warna')
    .eq('aktif', true)
    .order('nama')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d111c' }}>
      <Sidebar user={user} profile={profile} kurirAktif={kurirAktif || []} /> {/* ✅ */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}