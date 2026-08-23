'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import ViewFileButton from './ViewFileButton'
import { useToast } from './Toast'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(Number(n || 0)).toLocaleString('id-ID') + ',-'

function fmtPeriode(p: string): string {
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const [tahun, m] = p.split('-')
  return `${bulan[Number(m) - 1]} ${tahun}`
}

type Rekap = {
  id: string
  periode: string
  dasar_pengenaan: number
  tarif: number
  nilai_pajak: number
  status_bayar: 'BELUM' | 'LUNAS' | 'BEAS'
  tanggal_bayar?: string | null
  bukti_url?: string | null
  catatan?: string | null
}

export default function PajakRekapClient({
  outlet, rekapList, tahunList, selectedTahun, selectedStatus,
}: {
  outlet: { id: string; kode: string; nama: string }
  rekapList: Rekap[]
  tahunList: string[]
  selectedTahun: string
  selectedStatus: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const { showToast } = useToast()

  function setFilter(key: 'tahun' | 'status', value: string) {
    const sp = new URLSearchParams()
    if (selectedTahun && key !== 'tahun') sp.set('tahun', selectedTahun)
    if (selectedStatus && key !== 'status') sp.set('status', selectedStatus)
    if (value) sp.set(key, value)
    router.push(`/dashboard/pajak/rekap${sp.toString() ? `?${sp.toString()}` : ''}`)
  }

  async function generate(periode: string) {
    setBusy(periode)
    try {
      const res = await fetch('/api/pajak/generate-rekap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outlet.id, periode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal')
      showToast(`Rekap ${periode} berhasil${json.rekap ? ' di-generate/diupdate' : ''}.`)
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(null)
    }
  }

  async function updateStatus(id: string, status_bayar: 'LUNAS' | 'BELUM' | 'BEAS') {
    setBusy(id)
    try {
      const payload: Record<string, unknown> = { id, status_bayar }
      if (status_bayar === 'LUNAS') {
        payload.tanggal_bayar = new Date().toISOString().slice(0, 10)
      } else if (status_bayar === 'BELUM') {
        payload.tanggal_bayar = null
      }
      const res = await fetch('/api/pajak/bayar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal update')
      showToast(`Status diubah ke ${status_bayar}`)
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(null)
    }
  }

  // Summary
  const totalNilai = rekapList.reduce((a, r) => a + Number(r.nilai_pajak), 0)
  const totalLunas = rekapList.filter(r => r.status_bayar === 'LUNAS').reduce((a, r) => a + Number(r.nilai_pajak), 0)
  const totalBelum = rekapList.filter(r => r.status_bayar === 'BELUM').reduce((a, r) => a + Number(r.nilai_pajak), 0)

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={() => router.push('/dashboard/pajak')} style={{
            background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8,
          }}>← Kembali</button>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📋 Rekap Pajak Bulanan</h1>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{outlet.nama} ({outlet.kode})</div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Tahun:</span>
          <button onClick={() => setFilter('tahun', '')} style={chip(selectedTahun === '')}>Semua</button>
          {tahunList.map(t => (
            <button key={t} onClick={() => setFilter('tahun', t)} style={chip(selectedTahun === t)}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Status:</span>
          <button onClick={() => setFilter('status', '')} style={chip(selectedStatus === '')}>Semua</button>
          <button onClick={() => setFilter('status', 'BELUM')} style={chip(selectedStatus === 'BELUM', '#f59e0b')}>⏳ BELUM</button>
          <button onClick={() => setFilter('status', 'LUNAS')} style={chip(selectedStatus === 'LUNAS', '#22c55e')}>✅ LUNAS</button>
          <button onClick={() => setFilter('status', 'BEAS')} style={chip(selectedStatus === 'BEAS', '#3b82f6')}>🆓 BEBAS</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <SummaryCard label="Total Rekap" value={`${rekapList.length} bulan`} color="#3b82f6" />
        <SummaryCard label="Total PPh" value={fmtRp(totalNilai)} color="#f97316" />
        <SummaryCard label="Sudah Lunas" value={fmtRp(totalLunas)} color="#22c55e" />
        <SummaryCard label="Belum Bayar" value={fmtRp(totalBelum)} color="#ef4444" />
      </div>

      {/* Tabel */}
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
        {rekapList.length === 0 ? (
          <div style={{ color: '#64748b', padding: 32, textAlign: 'center' }}>Tidak ada data sesuai filter.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
            <thead>
              <tr style={{ background: '#1e2433' }}>
                <th style={th}>Periode</th>
                <th style={th}>Dasar (Net Omzet)</th>
                <th style={th}>Tarif</th>
                <th style={th}>Nilai PPh</th>
                <th style={th}>Status</th>
                <th style={th}>Tgl Bayar</th>
                <th style={th}>Bukti</th>
                <th style={th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rekapList.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #1e2433' }}>
                  <td style={{ ...td, fontWeight: 700 }}>{fmtPeriode(r.periode)}</td>
                  <td style={td}>{fmtRp(r.dasar_pengenaan)}</td>
                  <td style={td}>{Number(r.tarif).toFixed(2)}%</td>
                  <td style={{ ...td, fontWeight: 700, color: '#f97316' }}>{fmtRp(r.nilai_pajak)}</td>
                  <td style={td}>
                    {r.status_bayar === 'LUNAS' && <span style={badge('#22c55e', '#22c55e20')}>✅ LUNAS</span>}
                    {r.status_bayar === 'BEAS' && <span style={badge('#3b82f6', '#3b82f620')}>🆓 BEBAS</span>}
                    {r.status_bayar === 'BELUM' && <span style={badge('#f59e0b', '#f59e0b20')}>⏳ BELUM</span>}
                  </td>
                  <td style={td}>{r.tanggal_bayar ? new Date(r.tanggal_bayar).toLocaleDateString('id-ID') : '—'}</td>
                  <td style={td}>
                    {r.bukti_url ? (
                      <ViewFileButton bucket="bukti-pajak" path={r.bukti_url} label="📎 Lihat" />
                    ) : <span style={{ color: '#475569', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => generate(r.periode)} disabled={busy === r.periode} style={smBtn('#1e2433', '#94a3b8')} title="Re-generate (idempotent)">
                        {busy === r.periode ? '⏳' : '🔄'}
                      </button>
                      {r.status_bayar !== 'LUNAS' && (
                        <button onClick={() => updateStatus(r.id, 'LUNAS')} disabled={busy === r.id} style={smBtn('#22c55e20', '#22c55e')} title="Set LUNAS">✅</button>
                      )}
                      {r.status_bayar === 'LUNAS' && (
                        <button onClick={() => updateStatus(r.id, 'BELUM')} disabled={busy === r.id} style={smBtn('#f59e0b20', '#f59e0b')} title="Set BELUM">↩️</button>
                      )}
                      <Link href={`/dashboard/pajak/upload-bukti?id=${r.id}`} style={smLink('#1e2433', '#94a3b8')} title="Upload bukti">📎</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: '#64748b' }}>
        💡 Tombol 🔄 regenerate rekap dari income bulan ini (idempotent — tidak duplicate).
        Upload bukti SSP ada di halaman <Link href="/dashboard/pajak/upload-bukti" style={{ color: '#3b82f6' }}>Upload Bukti</Link>.
      </div>

    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
    </div>
  )
}

function chip(active: boolean, accent = '#f97316'): React.CSSProperties {
  return {
    padding: '4px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    background: active ? accent : '#1e2433',
    color: active ? '#fff' : '#94a3b8',
  }
}

function smBtn(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 13, cursor: 'pointer' }
}
function smLink(bg: string, color: string): React.CSSProperties {
  return { ...smBtn(bg, color), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
}

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }
const td: React.CSSProperties = { padding: '10px 12px' }
function badge(color: string, bg: string): React.CSSProperties {
  return { background: bg, color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-block' }
}
