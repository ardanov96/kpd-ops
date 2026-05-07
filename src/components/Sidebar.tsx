'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',           icon: '📊', label: 'Ringkasan' },
  { href: '/dashboard/transaksi', icon: '📦', label: 'Transaksi' },
  { href: '/dashboard/analitik',  icon: '📈', label: 'Analitik' },
  { href: '/dashboard/upload',    icon: '📤', label: 'Import Laporan' },
  { href: '/dashboard/profil',    icon: '⚙️', label: 'Pengaturan' },
]

type KurirAktif = { kode: string; nama: string; warna: string }

export default function Sidebar({
  user, profile, kurirAktif,
}: {
  user: any
  profile: any
  kurirAktif: KurirAktif[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: '#111827',
      borderRight: '1px solid #1e2433', display: 'flex',
      flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e2433' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #f97316, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Ekspedisi</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Dashboard v1.0</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 8px', marginBottom: 8 }}>Menu</div>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                background: active ? 'linear-gradient(135deg, #f9731620, #ef444420)' : 'transparent',
                color: active ? '#f97316' : '#94a3b8',
                fontWeight: active ? 700 : 400, fontSize: 14,
                transition: 'all 0.15s', cursor: 'pointer',
                borderLeft: active ? '2px solid #f97316' : '2px solid transparent',
              }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </Link>
          )
        })}

        {/* ✅ Kurir Aktif dari database */}
        {kurirAktif.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 8px', marginBottom: 10 }}>
              Kurir Aktif
            </div>
            {kurirAktif.map(k => (
              <div key={k.kode} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', marginBottom: 2 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: k.warna || '#64748b', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {k.nama}
                </span>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* User */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #1e2433' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1e2433', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{profile?.nama || 'User'}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{profile?.role || 'staff'}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          style={{ width: '100%', background: '#1e2433', border: '1px solid #2d3748', borderRadius: 8, padding: '8px 12px', color: '#94a3b8', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          🚪 Keluar
        </button>
      </div>
    </aside>
  )
}