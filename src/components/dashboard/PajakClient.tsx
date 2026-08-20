'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(Number(n || 0)).toLocaleString('id-ID') + ',-'

function formatNPWP(raw: string | null | undefined): string {
  if (!raw) return ''
  const c = String(raw).replace(/\D/g, '')
  if (c.length !== 15) return raw
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}.${c.slice(8, 9)}-${c.slice(9, 12)}.${c.slice(12, 15)}`
}

function fmtPeriode(p: string): string {
  // 'YYYY-MM' -> 'Desember 2025'
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
}

type Reminder = {
  id: string
  periode: string
  nilai_pajak: number
  status_bayar: string
  tanggal_jatuh_tempo: string
  sisa_hari: number
}

type Config = {
  npwp?: string | null
  nama_wp?: string | null
  pkp?: boolean
  form_spt?: string
}

type SptRow = {
  tahun: string
  total_omzet: number
  total_pph_final: number
  bulan_lunas: number
  bulan_belum: number
  total_bulan: number
}

export default function PajakClient({
  outlet, config, rekapList, reminders, rekapBulanIni, currentPeriode, sptTahunan,
}: {
  outlet: { id: string; kode: string; nama: string }
  config: Config
  rekapList: Rekap[]
  reminders: Reminder[]
  rekapBulanIni: Rekap | null
  currentPeriode: string
  sptTahunan: SptRow[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3500)
  }

  async function generateBulanIni() {
    setBusy(true)
    try {
      const res = await fetch('/api/pajak/generate-rekap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outlet.id, periode: currentPeriode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal generate')
      showToast(`Rekap PPh ${currentPeriode} berhasil di-generate.`)
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  const npwpFormatted = formatNPWP(config.npwp)
  const hasConfig = !!(config.npwp && config.nama_wp)

  // Hitung total tahun ini
  const totalTahunIni = sptTahunan[0] || null
  const belum = reminders.length > 0
  const overdueReminder = reminders.find(r => r.sisa_hari < 0)

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🧾 Pajak</h1>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            {outlet.nama} ({outlet.kode}) · NPWP: <strong style={{ color: '#e2e8f0' }}>{npwpFormatted || '⚠ belum diisi'}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/dashboard/pajak/pengaturan" style={{
            background: '#1e2433', border: '1px solid #1e2433', borderRadius: 8,
            color: '#94a3b8', padding: '8px 14px', fontSize: 13, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>⚙️ Pengaturan</Link>
          <Link href="/dashboard/pajak/rekap" style={{
            background: '#1e2433', border: '1px solid #1e2433', borderRadius: 8,
            color: '#94a3b8', padding: '8px 14px', fontSize: 13, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>📋 Rekap Bulanan</Link>
          <Link href="/dashboard/pajak/upload-bukti" style={{
            background: '#1e2433', border: '1px solid #1e2433', borderRadius: 8,
            color: '#94a3b8', padding: '8px 14px', fontSize: 13, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>📎 Upload Bukti SSP</Link>
          <Link href="/dashboard/pajak/spt" style={{
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)', border: 'none', borderRadius: 8,
            color: '#fff', padding: '8px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>📊 SPT Tahunan</Link>
        </div>
      </div>

      {/* Config belum lengkap warning */}
      {!hasConfig && (
        <div style={{
          background: '#f59e0b20', border: '1px solid #f59e0b',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#f59e0b' }}>Setup belum lengkap.</strong>
            <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 2 }}>
              Silakan lengkapi NPWP & nama wajib pajak di{' '}
              <Link href="/dashboard/pajak/pengaturan" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Pengaturan Pajak</Link>.
            </div>
          </div>
        </div>
      )}

      {/* Reminder badge */}
      {belum && (
        <div style={{
          background: overdueReminder ? '#ef444420' : '#f59e0b20',
          border: `1px solid ${overdueReminder ? '#ef4444' : '#f59e0b'}`,
          borderRadius: 10, padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>{overdueReminder ? '🚨' : '⏰'}</span>
            <strong style={{ color: overdueReminder ? '#ef4444' : '#f59e0b', fontSize: 14 }}>
              {overdueReminder
                ? `${Math.abs(overdueReminder.sisa_hari)} hari terlambat bayar PPh Final`
                : `PPh Final ${reminders.length} bulan${reminders.length > 1 ? ' ini' : ''} mendekati jatuh tempo`}
            </strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reminders.slice(0, 3).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e2e8f0', padding: '6px 0', borderTop: '1px solid #1e2433' }}>
                <span>📅 {fmtPeriode(r.periode)} · jatuh tempo {new Date(r.tanggal_jatuh_tempo).toLocaleDateString('id-ID')}</span>
                <span style={{ color: r.sisa_hari < 0 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                  {fmtRp(r.nilai_pajak)} · {r.sisa_hari < 0 ? `${Math.abs(r.sisa_hari)} hari lewat` : `sisa ${r.sisa_hari} hari`}
                </span>
              </div>
            ))}
            {reminders.length > 3 && (
              <Link href="/dashboard/pajak/rekap" style={{ color: '#3b82f6', fontSize: 12, marginTop: 4 }}>
                Lihat semua ({reminders.length}) →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        {/* PPh Bulan Ini */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            PPh Final Bulan Ini · {fmtPeriode(currentPeriode)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f97316', marginTop: 6 }}>
            {rekapBulanIni ? fmtRp(rekapBulanIni.nilai_pajak) : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {rekapBulanIni
              ? `Dasar: ${fmtRp(rekapBulanIni.dasar_pengenaan)} × 0,5%`
              : 'Belum di-generate'}
          </div>
        </div>

        {/* Status Bulan Ini */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Status Bulan Ini
          </div>
          <div style={{ marginTop: 6 }}>
            {rekapBulanIni ? (
              rekapBulanIni.status_bayar === 'LUNAS' ? (
                <span style={{ background: '#22c55e20', color: '#22c55e', padding: '4px 12px', borderRadius: 6, fontSize: 14, fontWeight: 700 }}>✅ LUNAS</span>
              ) : rekapBulanIni.status_bayar === 'BEAS' ? (
                <span style={{ background: '#3b82f620', color: '#3b82f6', padding: '4px 12px', borderRadius: 6, fontSize: 14, fontWeight: 700 }}>🆓 BEBAS</span>
              ) : (
                <span style={{ background: '#f59e0b20', color: '#f59e0b', padding: '4px 12px', borderRadius: 6, fontSize: 14, fontWeight: 700 }}>⏳ BELUM</span>
              )
            ) : (
              <span style={{ background: '#1e2433', color: '#94a3b8', padding: '4px 12px', borderRadius: 6, fontSize: 14, fontWeight: 700 }}>— N/A</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
            {rekapBulanIni?.tanggal_bayar
              ? `Dibayar: ${new Date(rekapBulanIni.tanggal_bayar).toLocaleDateString('id-ID')}`
              : 'Bayar sebelum tgl 15 bulan berikut'}
          </div>
        </div>

        {/* Total Tahun Ini */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Akumulasi {totalTahunIni?.tahun || new Date().getFullYear()}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6', marginTop: 6 }}>
            {totalTahunIni ? fmtRp(totalTahunIni.total_pph_final) : 'Rp. 0,-'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {totalTahunIni
              ? `${totalTahunIni.bulan_lunas}/${totalTahunIni.total_bulan} bulan lunas · Omzet ${fmtRp(totalTahunIni.total_omzet)}`
              : 'Belum ada data'}
          </div>
        </div>

        {/* Belum Bayar */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Belum Bayar
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: reminders.length > 0 ? '#ef4444' : '#22c55e', marginTop: 6 }}>
            {reminders.length}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {reminders.length > 0
              ? `Total ${fmtRp(reminders.reduce((a, r) => a + Number(r.nilai_pajak), 0))}`
              : 'Semua sudah lunas 🎉'}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>⚡ Aksi Cepat</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={generateBulanIni} disabled={busy} style={{
            background: 'linear-gradient(135deg, #f97316, #ef4444)', border: 'none', color: '#fff',
            padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
          }}>
            {busy ? '⏳ Memproses...' : `🔄 Generate Rekap ${currentPeriode}`}
          </button>
          <Link href="/dashboard/pajak/pengaturan" style={{
            background: '#1e2433', border: '1px solid #1e2433', color: '#94a3b8',
            padding: '10px 16px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center',
          }}>⚙️ Setup NPWP</Link>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 10 }}>
          💡 Tombol "Generate Rekap" memicu fn_generate_pph_final_rekap (idempotent).
          Biasanya auto-generated saat closing bulan. Tombol ini untuk generate manual bila perlu.
        </div>
      </div>

      {/* Tabel ringkas 6 rekap terakhir */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>📋 6 Rekap Terakhir</h2>
        {rekapList.length === 0 ? (
          <div style={{ color: '#64748b', padding: 24, textAlign: 'center', background: '#111827', borderRadius: 10 }}>
            Belum ada rekap pajak. Generate rekap bulan ini untuk memulai.
          </div>
        ) : (
          <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e2433' }}>
                  <th style={th}>Periode</th>
                  <th style={th}>Dasar Pengenaan</th>
                  <th style={th}>Tarif</th>
                  <th style={th}>Nilai PPh</th>
                  <th style={th}>Status</th>
                  <th style={th}>Tgl Bayar</th>
                </tr>
              </thead>
              <tbody>
                {rekapList.slice(0, 6).map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #1e2433' }}>
                    <td style={{ ...td, fontWeight: 700 }}>{fmtPeriode(r.periode)}</td>
                    <td style={td}>{fmtRp(r.dasar_pengenaan)}</td>
                    <td style={td}>{Number(r.tarif).toFixed(2)}%</td>
                    <td style={{ ...td, fontWeight: 700, color: '#f97316' }}>{fmtRp(r.nilai_pajak)}</td>
                    <td style={td}>
                      {r.status_bayar === 'LUNAS' ? <span style={status('#22c55e', '#22c55e20')}>✅ LUNAS</span>
                        : r.status_bayar === 'BEAS' ? <span style={status('#3b82f6', '#3b82f620')}>🆓 BEBAS</span>
                        : <span style={status('#f59e0b', '#f59e0b20')}>⏳ BELUM</span>}
                    </td>
                    <td style={td}>{r.tanggal_bayar ? new Date(r.tanggal_bayar).toLocaleDateString('id-ID') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.kind === 'ok' ? '#22c55e' : '#ef4444',
          color: '#fff', padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.5px',
}
const td: React.CSSProperties = { padding: '10px 12px' }
function status(color: string, bg: string): React.CSSProperties {
  return { background: bg, color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-block' }
}
