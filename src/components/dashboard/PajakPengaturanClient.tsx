'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from './Toast'
import Link from 'next/link'

function formatNPWP(raw: string | null | undefined): string {
  if (!raw) return ''
  const c = String(raw).replace(/\D/g, '')
  if (c.length !== 15) return raw
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}.${c.slice(8, 9)}-${c.slice(9, 12)}.${c.slice(12, 15)}`
}

export default function PajakPengaturanClient({
  outlet, config,
}: {
  outlet: { id: string; kode: string; nama: string }
  config: any
}) {
  const router = useRouter()
  const [npwp, setNpwp] = useState<string>(config?.npwp || '')
  const [namaWp, setNamaWp] = useState<string>(config?.nama_wp || outlet.nama)
  const [pkp, setPkp] = useState<boolean>(config?.pkp || false)
  const [formSpt, setFormSpt] = useState<string>(config?.form_spt || '1770S3')
  const [omzetTahunan, setOmzetTahunan] = useState<number>(Number(config?.omzet_tahunan) || 0)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  // Auto-format NPWP saat user mengetik
  function onNpwpChange(raw: string) {
    const c = raw.replace(/\D/g, '').slice(0, 15)
    let formatted = c
    if (c.length > 2) formatted = c.slice(0, 2) + '.' + c.slice(2)
    if (c.length > 5) formatted = formatted.slice(0, 6) + '.' + c.slice(5)
    if (c.length > 8) formatted = formatted.slice(0, 10) + '.' + c.slice(8)
    if (c.length > 9) formatted = formatted.slice(0, 12) + '-' + c.slice(9)
    if (c.length > 12) formatted = formatted.slice(0, 16) + '.' + c.slice(12)
    setNpwp(formatted)
  }

  async function save() {
    if (!namaWp.trim()) {
      return showToast('Nama Wajib Pajak wajib diisi', 'err')
    }
    setSaving(true)
    try {
      // Kirim dalam bentuk angka saja (sesuai validasi server)
      const cleaned = npwp.replace(/\D/g, '') || null
      const res = await fetch('/api/pajak/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outlet.id,
          npwp: cleaned,
          nama_wp: namaWp.trim(),
          pkp,
          form_spt: formSpt,
          omzet_tahunan: omzetTahunan,
          metode_pph: 'FINAL_05',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal simpan')
      showToast('✅ Pengaturan pajak berhasil disimpan')
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: '#0d111c', border: '1px solid #1e2433',
    borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: 14,
    boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }
  const previewNpwp = formatNPWP(npwp.replace(/\D/g, ''))

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0', maxWidth: 720 }}>
      <button onClick={() => router.push('/dashboard/pajak')} style={{
        background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8,
      }}>← Kembali ke Pajak</button>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>⚙️ Pengaturan Pajak</h1>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
        {outlet.nama} ({outlet.kode})
      </div>

      <div className="card" style={{ padding: 20, background: '#111827', border: '1px solid #1e2433', borderRadius: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* NPWP */}
          <div>
            <label style={lbl}>NPWP *</label>
            <input style={{ ...inp, fontFamily: 'monospace' }} value={npwp} onChange={(e) => onNpwpChange(e.target.value)} placeholder="00.000.000.0-000.000" />
            {npwp && previewNpwp.length === 0 && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>15 digit angka</div>
            )}
            <div style={{ fontSize: 11, color: npwp.replace(/\D/g, '').length === 15 ? '#22c55e' : '#64748b', marginTop: 4 }}>
              {npwp.replace(/\D/g, '').length}/15 digit
              {npwp.replace(/\D/g, '').length === 15 && ' ✅'}
            </div>
          </div>

          {/* Nama WP */}
          <div>
            <label style={lbl}>Nama Wajib Pajak *</label>
            <input style={inp} value={namaWp} onChange={(e) => setNamaWp(e.target.value)} placeholder="Nama sesuai NPWP" />
          </div>

          {/* PKP */}
          <div>
            <label style={{ ...lbl, marginBottom: 10 }}>Status PKP</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setPkp(false)} style={{
                flex: 1, padding: '12px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                background: !pkp ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#1e2433',
                color: !pkp ? '#fff' : '#94a3b8',
                border: !pkp ? 'none' : '1px solid #1e2433',
              }}>❌ Non-PKP</button>
              <button type="button" onClick={() => setPkp(true)} style={{
                flex: 1, padding: '12px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                background: pkp ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#1e2433',
                color: pkp ? '#fff' : '#94a3b8',
                border: pkp ? 'none' : '1px solid #1e2433',
              }}>✅ PKP</button>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              MVP default: Non-PKP. PKP hanya untuk outlet dengan omzet &gt; Rp 4,8 M.
            </div>
          </div>

          {/* Form SPT */}
          <div>
            <label style={lbl}>Form SPT Tahunan</label>
            <select value={formSpt} onChange={(e) => setFormSpt(e.target.value)} style={inp}>
              <option value="1770S3">1770S3 — WPOP Badan (default)</option>
              <option value="1770S">1770S — WPOP Orang Pribadi</option>
                           <option value="1771">1771 — Badan (non-Persero)</option>
            </select>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              ⚠️ Belum terkonfirmasi ke konsultan pajak. Default 1770S3.
              Verifikasi sebelum pelaporan SPT. (Lihat decision log D-009)
            </div>
          </div>

          {/* Omzet Tahunan */}
          <div>
            <label style={lbl}>Omzet Tahunan (estimasi, Rp)</label>
            <input type="number" min={0} value={omzetTahunan} onChange={(e) => setOmzetTahunan(Number(e.target.value))} style={inp} placeholder="0" />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Untuk referensi penghitungan PPh Final 0,5% × omzet bruto.
              Threshold PKP: Rp 4,8 M.
            </div>
          </div>

          <button onClick={save} disabled={saving} style={{
            background: 'linear-gradient(135deg, #f97316, #ef4444)', border: 'none',
            color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start',
          }}>{saving ? '⏳ Menyimpan...' : '💾 Simpan Pengaturan'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 16, background: '#1e243320', border: '1px solid #1e2433', borderRadius: 12, fontSize: 13, color: '#94a3b8' }}>
        <strong style={{ color: '#f1f5f9' }}>📌 Catatan</strong>
        <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
          <li>NPWP disimpan terenkripsi &amp; hanya owner yang bisa akses (RLS aktif).</li>
          <li>Tarif PPh Final 0,5% hardcode di sistem — sesuai status Non-PKP Anda.</li>
          <li>Form SPT bisa diedit nanti setelah konfirmasi konsultan pajak.</li>
          <li>Omzet tahunan di-input manual untuk referensi penghitungan PPh.</li>
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link href="/dashboard/pajak" style={{ color: '#3b82f6', fontSize: 13 }}>← Lihat dashboard pajak</Link>
      </div>
    </div>
  )
}
