'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(Number(n || 0)).toLocaleString('id-ID') + ',-'

function fmtPeriode(p: string): string {
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const [tahun, m] = p.split('-')
  return `${bulan[Number(m) - 1]} ${tahun}`
}

function formatNPWP(raw: string | null | undefined): string {
  if (!raw) return ''
  const c = String(raw).replace(/\D/g, '')
  if (c.length !== 15) return raw
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}.${c.slice(8, 9)}-${c.slice(9, 12)}.${c.slice(12, 15)}`
}

type Rekap = {
  id: string
  periode: string  // 'YYYY-MM'
  dasar_pengenaan: number
  tarif: number
  nilai_pajak: number
  status_bayar: 'BELUM' | 'LUNAS' | 'BEAS'
  tanggal_bayar?: string | null
}

type SptRow = {
  tahun: string
  total_omzet: number
  total_pph_final: number
  bulan_lunas: number
  bulan_belum: number
  total_bulan: number
}

type Config = {
  npwp?: string | null
  nama_wp?: string | null
  form_spt?: string
}

export default function PajakSPTClient({
  outlet, config, sptTahunan, rekapTahunan, selectedTahun, tahunList,
}: {
  outlet: { id: string; kode: string; nama: string }
  config: Config | null
  sptTahunan: SptRow[]
  rekapTahunan: Rekap[]
  selectedTahun: string
  tahunList: string[]
}) {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  function pickTahun(t: string) {
    router.push(`/dashboard/pajak/spt?tahun=${t}`)
  }

  const sptSelected = sptTahunan.find(s => s.tahun === selectedTahun)
  const totalOmzet = Number(sptSelected?.total_omzet || 0)
  const totalPPh = Number(sptSelected?.total_pph_final || 0)
  const bulanLunas = Number(sptSelected?.bulan_lunas || 0)
  const totalBulan = Number(sptSelected?.total_bulan || 0)

  function printSPT() {
    setToast({ msg: '🖨️ Membuka dialog print — gunakan "Save as PDF" untuk simpan', kind: 'ok' })
    setTimeout(() => window.print(), 300)
  }

  function copyCSV() {
    const header = 'Periode,Dasar Pengenaan,Tarif (%),Nilai PPh,Status,Tanggal Bayar,Catatan\n'
    const rows = rekapTahunan.map(r => {
      const status = r.status_bayar === 'LUNAS' ? `LUNAS (${r.tanggal_bayar || ''})` : r.status_bayar
      return `${r.periode},${r.dasar_pengenaan},${r.tarif},${r.nilai_pajak},${status},${r.tanggal_bayar || ''},-`
    }).join('\n')
    const csv = header + rows + `\n\nTOTAL,${totalOmzet},,${totalPPh},${bulanLunas}/${totalBulan} lunas,,`
    navigator.clipboard.writeText(csv)
    setToast({ msg: '📋 CSV disalin ke clipboard', kind: 'ok' })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }} className="print-clean">
      <button onClick={() => router.push('/dashboard/pajak')} style={{
        background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8,
      }} className="no-print">← Kembali ke Pajak</button>

      <div className="no-print" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📊 SPT Tahunan — Estimator</h1>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            Untuk diberikan ke konsultan pajak · {outlet.nama} ({outlet.kode})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copyCSV} style={{
            background: '#1e2433', border: '1px solid #1e2433', color: '#94a3b8',
            padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}>📋 Copy CSV</button>
          <button onClick={printSPT} style={{
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)', border: 'none', color: '#fff',
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>🖨️ Print / Save PDF</button>
        </div>
      </div>

      {/* Filter tahun */}
      {tahunList.length > 0 && (
        <div className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Tahun:</span>
          {tahunList.map(t => (
            <button key={t} onClick={() => pickTahun(t)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: t === selectedTahun ? '#f97316' : '#1e2433',
              color: t === selectedTahun ? '#fff' : '#94a3b8',
            }}>{t}</button>
          ))}
        </div>
      )}

      {/* Form SPT header (cetak) */}
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Form SPT
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {config?.form_spt || '1770S3'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              ⚠️ Konfirmasi form aktual ke konsultan pajak sebelum pelaporan
            </div>
          </div>
          <div style={{ minWidth: 280 }}>
            <Field label="Nama Wajib Pajak" value={config?.nama_wp || outlet.nama} />
            <Field label="NPWP" value={formatNPWP(config?.npwp) || '⚠ belum diisi'} mono />
            <Field label="Outlet" value={`${outlet.nama} (${outlet.kode})`} />
            <Field label="Tahun Pajak" value={selectedTahun} />
          </div>
        </div>
      </div>

      {/* KPI Tahunan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <BigStat label={`Omzet Bruto ${selectedTahun}`} value={fmtRp(totalOmzet)} color="#3b82f6" />
        <BigStat label="PPh Final Terutang" value={fmtRp(totalPPh)} color="#f97316" />
        <BigStat label="Tarif Efektif" value={`${totalOmzet > 0 ? ((totalPPh / totalOmzet) * 100).toFixed(2) : '0.00'}%`} color="#a78bfa" />
        <BigStat label="Status Bayar" value={`${bulanLunas}/${totalBulan} bulan`} color={bulanLunas === totalBulan ? '#22c55e' : '#f59e0b'} />
      </div>

      {/* Tabel per bulan */}
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
        <h2 style={{ padding: '14px 18px', margin: 0, fontSize: 16, fontWeight: 700, borderBottom: '1px solid #1e2433' }}>
          📋 Rincian Per Bulan
        </h2>
        {rekapTahunan.length === 0 ? (
          <div style={{ color: '#64748b', padding: 32, textAlign: 'center' }}>
            Belum ada data rekap untuk tahun {selectedTahun}. Generate rekap bulanan dulu.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#1e2433' }}>
                <th style={th}>No</th>
                <th style={th}>Periode</th>
                <th style={th}>Dasar Pengenaan (Net Omzet)</th>
                <th style={th}>Tarif</th>
                <th style={th}>Nilai PPh</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rekapTahunan.map((r, i) => (
                <tr key={r.id} style={{ borderTop: '1px solid #1e2433' }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmtPeriode(r.periode)}</td>
                  <td style={td}>{fmtRp(r.dasar_pengenaan)}</td>
                  <td style={td}>{Number(r.tarif).toFixed(2)}%</td>
                  <td style={{ ...td, fontWeight: 700, color: '#f97316' }}>{fmtRp(r.nilai_pajak)}</td>
                  <td style={td}>
                    {r.status_bayar === 'LUNAS' && <span style={badge('#22c55e', '#22c55e20')}>✅ LUNAS</span>}
                    {r.status_bayar === 'BEAS' && <span style={badge('#3b82f6', '#3b82f620')}>🆓 BEBAS</span>}
                    {r.status_bayar === 'BELUM' && <span style={badge('#f59e0b', '#f59e0b20')}>⏳ BELUM</span>}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #1e2433', background: '#0d111c' }}>
                <td colSpan={2} style={{ ...td, fontWeight: 800 }}>TOTAL TAHUN {selectedTahun}</td>
                <td style={{ ...td, fontWeight: 800, color: '#3b82f6' }}>{fmtRp(totalOmzet)}</td>
                <td style={td}>—</td>
                <td style={{ ...td, fontWeight: 800, color: '#f97316', fontSize: 14 }}>{fmtRp(totalPPh)}</td>
                <td style={td}>—</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="no-print" style={{ marginTop: 16, padding: 14, background: '#1e243320', border: '1px solid #1e2433', borderRadius: 12, fontSize: 12, color: '#94a3b8' }}>
        <strong style={{ color: '#f1f5f9' }}>📌 Catatan</strong>
        <ul style={{ paddingLeft: 18, margin: '6px 0 0' }}>
          <li>Dasar pengenaan = net omzet (total_biaya − diskon) dari akunting, bukan bruto.</li>
          <li>PPh Final terutang = dasar × 0,5%.</li>
          <li>Estimator untuk konsultan pajak — bukan pengganti SPT resmi DJP.</li>
          <li>e-Filing tetap manual di website DJP. Sistem ini hanya rekap internal.</li>
          <li>Export PDF jadi Sprint 5; sementara pakai Print → Save as PDF.</li>
        </ul>
      </div>

      <div className="no-print" style={{ marginTop: 16 }}>
        <Link href="/dashboard/pajak/rekap" style={{ color: '#3b82f6', fontSize: 13 }}>← Lihat tabel rekap lengkap</Link>
      </div>

      {toast && (
        <div className="no-print" style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.kind === 'ok' ? '#22c55e' : '#ef4444',
          color: '#fff', padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14,
        }}>{toast.msg}</div>
      )}

      {/* Print-only CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          div, table, th, td { color: #000 !important; background: #fff !important; }
          h1, h2 { color: #000 !important; }
          table { border-collapse: collapse !important; }
          th, td { border: 1px solid #ccc !important; padding: 6px 10px !important; }
        }
      `}</style>
    </div>
  )
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 14, color: '#f1f5f9', fontFamily: mono ? 'monospace' : 'inherit', fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function BigStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }
const td: React.CSSProperties = { padding: '10px 12px' }
function badge(color: string, bg: string): React.CSSProperties {
  return { background: bg, color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-block' }
}
