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

  // ✅ Alert: barang di bawah stok minimum (dari view v_stok_aktual)
  const { count: inventarisAlert } = await supabase
    .from('v_stok_aktual')
    .select('barang_id', { count: 'exact', head: true })
    .eq('is_below_min', true)

  // ✅ Alert: PPh Final yang harus segera dibayar (jatuh tempo <= 7 hari ATAU sudah lewat)
  // Hanya untuk role owner (data sensitif)
  const { count: pajakAlert } = profile?.role === 'owner'
    ? await supabase
        .from('v_pajak_reminder')
        .select('id', { count: 'exact', head: true })
        .lte('sisa_hari', 7)
    : { count: 0 }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d111c' }}>
      <Sidebar
        user={user}
        profile={profile}
        kurirAktif={kurirAktif || []}
        alertCounts={{ inventaris: inventarisAlert || 0, pajak: (pajakAlert as number) || 0 }}
      />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}