'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfilClient({ user, profile }: { user: any; profile: any }) {
  const supabase = createClient()
  const router = useRouter()

  const [nama, setNama] = useState(profile?.nama || '')
  const [telepon, setTelepon] = useState(profile?.telepon || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function saveProfile() {
    setSavingProfile(true)
    setProfileMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ nama, telepon })
      .eq('id', user.id)
    if (error) {
      setProfileMsg({ type: 'err', text: error.message })
    } else {
      setProfileMsg({ type: 'ok', text: 'Profil berhasil disimpan.' })
      router.refresh()
    }
    setSavingProfile(false)
  }

  async function savePassword() {
    if (!newPassword || !confirmPassword) {
      setPasswordMsg({ type: 'err', text: 'Semua field password wajib diisi.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'err', text: 'Password minimal 8 karakter.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'err', text: 'Konfirmasi password tidak cocok.' })
      return
    }
    setSavingPassword(true)
    setPasswordMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordMsg({ type: 'err', text: error.message })
    } else {
      setPasswordMsg({ type: 'ok', text: 'Password berhasil diubah.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', background: '#0d111c', border: '1px solid #1e2433',
    borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: 14,
    boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }

  return (
    <div style={{ padding: 28, maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Profil & Pengaturan</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Kelola informasi akun dan keamanan</p>
      </div>

      {/* Info akun */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #1e2433' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #f97316, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>👤</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{profile?.nama || 'User'}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{user.email}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                background: '#f9731620', color: '#f97316',
                border: '1px solid #f9731640',
                padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              }}>{profile?.role || 'staff'}</span>
            </div>
          </div>
        </div>

        {/* Form profil */}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>✏️ Edit Profil</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Nama Lengkap</label>
            <input style={inp} value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama lengkap" />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input style={{ ...inp, opacity: 0.5, cursor: 'not-allowed' }} value={user.email} disabled />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Email tidak dapat diubah</div>
          </div>
          <div>
            <label style={lbl}>Nomor Telepon</label>
            <input style={inp} value={telepon} onChange={e => setTelepon(e.target.value)} placeholder="08xx..." />
          </div>

          {profileMsg && (
            <div style={{
              background: profileMsg.type === 'ok' ? '#22c55e20' : '#ef444420',
              border: `1px solid ${profileMsg.type === 'ok' ? '#22c55e40' : '#ef444440'}`,
              borderRadius: 8, padding: '10px 14px', fontSize: 13,
              color: profileMsg.type === 'ok' ? '#22c55e' : '#ef4444',
            }}>
              {profileMsg.type === 'ok' ? '✅' : '⚠️'} {profileMsg.text}
            </div>
          )}

          <button
            onClick={saveProfile}
            disabled={savingProfile}
            style={{
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              border: 'none', borderRadius: 8, padding: '10px 20px',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: savingProfile ? 'not-allowed' : 'pointer',
              opacity: savingProfile ? 0.7 : 1, alignSelf: 'flex-start',
            }}
          >
            {savingProfile ? 'Menyimpan...' : '💾 Simpan Profil'}
          </button>
        </div>
      </div>

      {/* Ganti password */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>🔒 Ganti Password</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Password Baru</label>
            <input
              style={inp} type="password"
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
            />
          </div>
          <div>
            <label style={lbl}>Konfirmasi Password Baru</label>
            <input
              style={{
                ...inp,
                borderColor: confirmPassword && newPassword !== confirmPassword ? '#ef4444' : '#1e2433',
              }}
              type="password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Password tidak cocok</div>
            )}
          </div>

          {/* Strength indicator */}
          {newPassword && (
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Kekuatan password:</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { label: 'Lemah', min: 1, color: '#ef4444' },
                  { label: 'Sedang', min: 8, color: '#f59e0b' },
                  { label: 'Kuat', min: 12, color: '#22c55e' },
                ].map((s, i) => (
                  <div key={s.label} style={{ flex: 1 }}>
                    <div style={{
                      height: 4, borderRadius: 2,
                      background: newPassword.length >= s.min ? s.color : '#1e2433',
                      transition: 'background 0.3s',
                    }} />
                    <div style={{ fontSize: 10, color: newPassword.length >= s.min ? s.color : '#475569', marginTop: 3, textAlign: 'center' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {passwordMsg && (
            <div style={{
              background: passwordMsg.type === 'ok' ? '#22c55e20' : '#ef444420',
              border: `1px solid ${passwordMsg.type === 'ok' ? '#22c55e40' : '#ef444440'}`,
              borderRadius: 8, padding: '10px 14px', fontSize: 13,
              color: passwordMsg.type === 'ok' ? '#22c55e' : '#ef4444',
            }}>
              {passwordMsg.type === 'ok' ? '✅' : '⚠️'} {passwordMsg.text}
            </div>
          )}

          <button
            onClick={savePassword}
            disabled={savingPassword || newPassword !== confirmPassword || newPassword.length < 8}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              border: 'none', borderRadius: 8, padding: '10px 20px',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: (savingPassword || newPassword !== confirmPassword || newPassword.length < 8) ? 'not-allowed' : 'pointer',
              opacity: (savingPassword || newPassword !== confirmPassword || newPassword.length < 8) ? 0.5 : 1,
              alignSelf: 'flex-start',
            }}
          >
            {savingPassword ? 'Menyimpan...' : '🔒 Ganti Password'}
          </button>
        </div>
      </div>
    </div>
  )
}