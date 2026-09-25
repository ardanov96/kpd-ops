'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from 'recharts'
import { formatCurrencyShort, formatCurrency, formatCurrencyAccounting } from '@/lib/format/currency'

const num = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

// Penalty Lion Parcel mulai berlaku April 2024 (masa probation).
// Sinkron dengan Analitik, Transaksi, dan migration 018.
const LION_PENALTY_START_PERIODE = '2024-04'

const STATUS_COLOR: Record<string, string> = {
  POD: '#22c55e',
  CNX: '#ef4444',
  PENDING: '#f59e0b',
  TRANSIT: '#3b82f6',
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const BERAT_BUCKET = [
  { label: '< 1 kg',  min: 0,  max: 1 },
  { label: '1–3 kg',  min: 1,  max: 3 },
  { label: '3–5 kg',  min: 3,  max: 5 },
  { label: '5–10 kg', min: 5,  max: 10 },
  { label: '> 10 kg', min: 10, max: Infinity },
]

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ background: '#1e2433', borderRadius: 4, height: 5, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min((value / Math.max(max, 1)) * 100, 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub: string; icon: string; color: string }) {
  return (
    <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: color, borderRadius: '14px 0 0 14px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>
        </div>
        <div style={{ fontSize: 26 }}>{icon}</div>
      </div>
    </div>
  )
}

const toDateStr = (val: any): string => {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'object' && typeof val.toISOString === 'function') return val.toISOString().slice(0, 10)
  return String(val)
}

export default function OverviewClient({
  summary,
  recentTx,
  grandTotal,
  kurirList = [],
  initialTab = 'overview',
}: {
  summary: any[]
  recentTx: any[]
  grandTotal: any[]
  kurirList?: any[]
  initialTab?: string
}) {
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'overview')
  const [selectedKurir, setSelectedKurir] = useState<string>('')
  const [filterMode, setFilterMode] = useState<'bulan' | 'tahun'>('bulan')
  const [selectedPeriode, setSelectedPeriode] = useState('')
  const [selectedTahun, setSelectedTahun] = useState('')

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // Daftar ekspedisi unik
  const kurirOptions = useMemo(() => {
    const map: Record<string, { kode: string; nama: string; warna: string }> = {}
    kurirList.forEach(k => {
      if (k.kode && !map[k.kode]) {
        map[k.kode] = { kode: k.kode, nama: k.nama, warna: k.warna || '#64748b' }
      }
    })
    grandTotal.forEach(d => {
      if (d.kurir?.kode && !map[d.kurir.kode]) {
        map[d.kurir.kode] = { kode: d.kurir.kode, nama: d.kurir.nama, warna: d.kurir.warna || '#64748b' }
      }
    })
    return Object.values(map)
  }, [grandTotal, kurirList])

  const selectedKurirInfo = kurirOptions.find(k => k.kode === selectedKurir)
  const accentColor = selectedKurirInfo?.warna || '#f97316'

  // Daftar tahun unik dari data transaksi
  const tahunOptions = useMemo(() => {
    const set = new Set<string>()
    grandTotal.forEach(d => {
      const yr = toDateStr(d.tanggal).slice(0, 4)
      if (yr && /^\d{4}$/.test(yr)) set.add(yr)
    })
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [grandTotal])

  // Filter grandTotal berdasarkan kurir & periode / tahun
  const filteredGrandTotal = useMemo(() => {
    let data = selectedKurir ? grandTotal.filter(d => d.kurir?.kode === selectedKurir) : grandTotal
    if (filterMode === 'bulan' && selectedPeriode) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 7) === selectedPeriode)
    } else if (filterMode === 'tahun' && selectedTahun) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 4) === selectedTahun)
    }
    return data
  }, [grandTotal, selectedKurir, filterMode, selectedPeriode, selectedTahun])

  const filteredRecentTx = useMemo(() => {
    let data = selectedKurir ? recentTx.filter(d => d.kurir?.kode === selectedKurir) : recentTx
    if (filterMode === 'bulan' && selectedPeriode) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 7) === selectedPeriode)
    } else if (filterMode === 'tahun' && selectedTahun) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 4) === selectedTahun)
    }
    return data
  }, [recentTx, selectedKurir, filterMode, selectedPeriode, selectedTahun])

  const filteredSummary = useMemo(() => {
    const selectedKurirNama = selectedKurir
      ? kurirOptions.find(k => k.kode === selectedKurir)?.nama
      : null
    let data = selectedKurirNama ? summary.filter(d => d.kurir === selectedKurirNama) : summary
    if (filterMode === 'bulan' && selectedPeriode) {
      data = data.filter(d => d.periode === selectedPeriode)
    } else if (filterMode === 'tahun' && selectedTahun) {
      data = data.filter(d => String(d.periode || '').slice(0, 4) === selectedTahun)
    }
    return data
  }, [summary, selectedKurir, filterMode, selectedPeriode, selectedTahun, kurirOptions])

  // Non-CNX transaksi untuk metrik keuntungan & analitik
  const nonCNX = useMemo(() => filteredGrandTotal.filter(d => d.status !== 'CNX'), [filteredGrandTotal])

  // Stats KPI Dashboard
  const stats = useMemo(() => {
    // Penalty Lion Parcel: dihitung on-the-fly dari raw transaksi agar konsisten
    const lionOmzetByPeriode: Record<string, number> = {}
    filteredGrandTotal.forEach(t => {
      if (t.kurir?.kode === 'LION') {
        const p = String(t.tanggal || '').slice(0, 7)
        if (!p || p < LION_PENALTY_START_PERIODE) return
        lionOmzetByPeriode[p] = (lionOmzetByPeriode[p] || 0) + num(t.total_biaya)
      }
    })

    let totalPenalty = 0
    let penaltyCount = 0
    for (const lionOmzet of Object.values(lionOmzetByPeriode)) {
      if (lionOmzet > 0 && lionOmzet < 3000000) {
        totalPenalty += 500000
        penaltyCount++
      }
    }

    const totalOmzet = filteredGrandTotal.reduce((s, d) => s + num(d.total_biaya), 0)
    const totalDiskon = filteredGrandTotal.reduce((s, d) => s + num(d.diskon_booking), 0)
    const totalKoli = filteredGrandTotal.reduce((s, d) => s + num(d.koli), 0)
    const podCount = filteredGrandTotal.filter(d => d.status === 'POD').length
    const podRate = filteredGrandTotal.length > 0 ? ((podCount / filteredGrandTotal.length) * 100).toFixed(1) : '0'

    const byDate: Record<string, { count: number; omzet: number }> = {}
    filteredRecentTx.forEach(d => {
      const dt = toDateStr(d.tanggal).slice(0, 10) || ''
      if (!byDate[dt]) byDate[dt] = { count: 0, omzet: 0 }
      byDate[dt].count++
      byDate[dt].omzet += num(d.total_biaya)
    })
    const dailyTrend = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({ date: date.slice(5), count: d.count, omzet: d.omzet }))

    const kurirSummary = filteredSummary.reduce((acc: Record<string, any>, s) => {
      if (!acc[s.kurir]) acc[s.kurir] = { nama: s.kurir, warna: s.kurir_warna, paket: 0, omzet: 0, diskon: 0, penalty: 0 }
      acc[s.kurir].paket += num(s.total_paket)
      acc[s.kurir].omzet += num(s.total_omzet)
      acc[s.kurir].diskon += num(s.total_diskon)
      acc[s.kurir].penalty += num(s.penalty)
      return acc
    }, {})

    const netProfit = nonCNX.reduce((s, d) =>
      s + num(d.diskon_booking) + num(d.diskon_asuransi) + num(d.diskon_forward_rate), 0) - totalPenalty

    const produkCount: Record<string, number> = {}
    nonCNX.forEach(d => {
      if (d.nama_produk) produkCount[d.nama_produk] = (produkCount[d.nama_produk] || 0) + 1
    })
    const produkTerpopuler = Object.entries(produkCount).sort((a, b) => b[1] - a[1])[0] || null

    const kotaCount: Record<string, number> = {}
    nonCNX.forEach(d => {
      if (d.kota_tujuan) {
        const kota = d.kota_tujuan.split('-')[1]?.trim() || d.kota_tujuan
        kotaCount[kota] = (kotaCount[kota] || 0) + 1
      }
    })
    const top3Kota = Object.entries(kotaCount).sort((a, b) => b[1] - a[1]).slice(0, 3)

    return { totalOmzet, totalDiskon, totalKoli, podRate, podCount, dailyTrend, kurirSummary: Object.values(kurirSummary), netProfit, totalPenalty, penaltyCount, produkTerpopuler, top3Kota }
  }, [filteredGrandTotal, filteredRecentTx, filteredSummary, nonCNX])

  const maxKurirOmzet = Math.max(...stats.kurirSummary.map((k: any) => k.omzet), 1)

  // ── Tab 4: Komparasi Periode (Analitik) ──
  const periodeData = useMemo(() => {
    const map: Record<string, { periode: string; omzet: number; paket: number; pod: number; total: number; diskon: number; lionOmzet: number }> = {}
    filteredGrandTotal.forEach(t => {
      const p = String(t.tanggal || '').slice(0, 7)
      if (!p) return
      if (!map[p]) map[p] = { periode: p, omzet: 0, paket: 0, pod: 0, total: 0, diskon: 0, lionOmzet: 0 }
      map[p].omzet += num(t.total_biaya)
      map[p].paket++
      map[p].total++
      map[p].diskon += num(t.diskon_booking) + num(t.diskon_asuransi) + num(t.diskon_forward_rate)
      if (t.status === 'POD') map[p].pod++

      if (t.kurir?.kode === 'LION') {
        map[p].lionOmzet += num(t.total_biaya)
      }
    })

    return Object.values(map)
      .sort((a, b) => a.periode.localeCompare(b.periode))
      .map(d => {
        const isLionPenalty = d.periode >= LION_PENALTY_START_PERIODE
          && d.lionOmzet > 0
          && d.lionOmzet < 3000000
        const penalty = isLionPenalty ? 500000 : 0
        const netProfit = d.diskon - penalty
        return {
          ...d,
          penalty,
          netProfit,
          podRate: d.total > 0 ? +((d.pod / d.total) * 100).toFixed(1) : 0,
        }
      })
  }, [filteredGrandTotal])

  // ── Tab 5: Top Kota (Analitik) ──
  const kotaData = useMemo(() => {
    const map: Record<string, { kota: string; jumlah: number; omzet: number }> = {}
    nonCNX.forEach(t => {
      const kota = t.kota_tujuan?.split('-')[1]?.trim() || t.kota_tujuan || '—'
      if (!map[kota]) map[kota] = { kota, jumlah: 0, omzet: 0 }
      map[kota].jumlah++
      map[kota].omzet += num(t.total_biaya)
    })
    return Object.values(map).sort((a, b) => b.jumlah - a.jumlah).slice(0, 10)
  }, [nonCNX])

  // ── Tab 6: Analisis Berat (Analitik) ──
  const beratData = useMemo(() =>
    BERAT_BUCKET.map(b => {
      const rows = nonCNX.filter(t => {
        const berat = num(t.berat_kena_biaya)
        return berat >= b.min && berat < b.max
      })
      return {
        label: b.label,
        jumlah: rows.length,
        omzet: rows.reduce((s, t) => s + num(t.total_biaya), 0),
        pct: nonCNX.length > 0 ? +((rows.length / nonCNX.length) * 100).toFixed(1) : 0,
      }
    }),
    [nonCNX]
  )

  // ── Tab 7: Heatmap Hari (Analitik) ──
  const heatmapData = useMemo(() => {
    const map: Record<number, { hari: string; jumlah: number; omzet: number }> = {}
    for (let i = 0; i < 7; i++) map[i] = { hari: HARI[i], jumlah: 0, omzet: 0 }
    nonCNX.forEach(t => {
      const d = new Date(t.tanggal)
      const day = isNaN(d.getDay()) ? 0 : d.getDay()
      map[day].jumlah++
      map[day].omzet += num(t.total_biaya)
    })
    return Object.values(map)
  }, [nonCNX])

  const maxHari = Math.max(...heatmapData.map(h => h.jumlah), 1)

  // 7 Tabs Terpadu
  const tabs = [
    { key: 'overview', label: '📊 Ringkasan' },
    { key: 'tren',     label: '📈 Tren Harian' },
    { key: 'kurir',    label: '🚚 Per Kurir' },
    { key: 'periode',  label: '📅 Komparasi Periode' },
    { key: 'kota',     label: '🗺️ Top Kota Tujuan' },
    { key: 'berat',    label: '⚖️ Analisis Berat' },
    { key: 'heatmap',  label: '🗓️ Pola Hari' },
  ]

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>Dashboard Ringkasan & Analitik</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
            {selectedKurir && (filterMode === 'bulan' ? selectedPeriode : selectedTahun)
              ? `${selectedKurirInfo?.nama} · ${filterMode === 'bulan' ? selectedPeriode : `Tahun ${selectedTahun}`}`
              : selectedKurir
              ? `Data ekspedisi ${selectedKurirInfo?.nama}`
              : filterMode === 'bulan' && selectedPeriode
              ? `Semua ekspedisi · ${selectedPeriode}`
              : filterMode === 'tahun' && selectedTahun
              ? `Semua ekspedisi · Tahun ${selectedTahun}`
              : 'Ringkasan performa dan analitik mendalam lintas ekspedisi'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Filter Ekspedisi */}
          <select
            value={selectedKurir}
            onChange={e => setSelectedKurir(e.target.value)}
            style={{
              background: '#1e2433',
              border: `1px solid ${selectedKurirInfo ? selectedKurirInfo.warna : '#2d3748'}`,
              borderRadius: 8, padding: '7px 14px',
              color: selectedKurirInfo ? selectedKurirInfo.warna : '#94a3b8',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              outline: 'none', minWidth: 170,
            }}
          >
            <option value="">🚚 Semua Ekspedisi</option>
            {kurirOptions.map(k => (
              <option key={k.kode} value={k.kode}>{k.nama} ({k.kode})</option>
            ))}
          </select>

          {/* Toggle Mode: Bulanan vs Tahunan */}
          <div style={{
            display: 'flex',
            background: '#1e2433',
            borderRadius: 8,
            padding: 3,
            border: '1px solid #2d3748',
          }}>
            <button
              type="button"
              onClick={() => setFilterMode('bulan')}
              style={{
                background: filterMode === 'bulan' ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'transparent',
                color: filterMode === 'bulan' ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📅</span>
              <span>Bulanan</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('tahun')}
              style={{
                background: filterMode === 'tahun' ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'transparent',
                color: filterMode === 'tahun' ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📅</span>
              <span>Tahunan</span>
            </button>
          </div>

          {/* Input / Selector sesuai mode */}
          {filterMode === 'bulan' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="month"
                value={selectedPeriode}
                onChange={e => setSelectedPeriode(e.target.value)}
                style={{
                  background: '#1e2433',
                  border: `1px solid ${selectedPeriode ? '#f97316' : '#2d3748'}`,
                  borderRadius: 8, padding: '7px 14px',
                  color: selectedPeriode ? '#f97316' : '#94a3b8',
                  fontSize: 13, cursor: 'pointer',
                  outline: 'none', colorScheme: 'dark',
                }}
              />
              {selectedPeriode && (
                <button
                  type="button"
                  onClick={() => setSelectedPeriode('')}
                  title="Hapus filter bulan"
                  style={{
                    background: '#1e2433', border: '1px solid #2d3748',
                    borderRadius: 6, width: 28, height: 28,
                    color: '#94a3b8', cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={selectedTahun}
                onChange={e => setSelectedTahun(e.target.value)}
                style={{
                  background: '#1e2433',
                  border: `1px solid ${selectedTahun ? '#f97316' : '#2d3748'}`,
                  borderRadius: 8, padding: '7px 14px',
                  color: selectedTahun ? '#f97316' : '#94a3b8',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  outline: 'none', minWidth: 140,
                }}
              >
                <option value="">📅 Semua Tahun</option>
                {tahunOptions.map(th => (
                  <option key={th} value={th}>Tahun {th}</option>
                ))}
              </select>
              {selectedTahun && (
                <button
                  type="button"
                  onClick={() => setSelectedTahun('')}
                  title="Hapus filter tahun"
                  style={{
                    background: '#1e2433', border: '1px solid #2d3748',
                    borderRadius: 6, width: 28, height: 28,
                    color: '#94a3b8', cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Reset filter jika ada yang aktif */}
          {(selectedKurir || (filterMode === 'bulan' ? selectedPeriode : selectedTahun)) && (
            <button
              onClick={() => { setSelectedKurir(''); setSelectedPeriode(''); setSelectedTahun('') }}
              style={{
                background: '#1e2433', border: '1px solid #2d3748', borderRadius: 8,
                padding: '7px 14px', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
              }}
            >
              ✕ Reset
            </button>
          )}

          <div style={{ fontSize: 12, color: '#475569', background: '#1e2433', padding: '6px 14px', borderRadius: 8 }}>
            {filteredGrandTotal.length} transaksi
          </div>
        </div>
      </div>

      {/* Banner Filter Aktif */}
      {(selectedKurir || (filterMode === 'bulan' ? selectedPeriode : selectedTahun)) && (
        <div style={{
          background: selectedKurirInfo ? `${selectedKurirInfo.warna}15` : '#f9731615',
          border: `1px solid ${selectedKurirInfo ? selectedKurirInfo.warna : '#f97316'}40`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {selectedKurir && selectedKurirInfo && (
            <span style={{
              background: `${selectedKurirInfo.warna}25`, color: selectedKurirInfo.warna,
              border: `1px solid ${selectedKurirInfo.warna}50`,
              padding: '3px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            }}>🚚 {selectedKurirInfo.nama} ({selectedKurirInfo.kode})</span>
          )}
          {filterMode === 'bulan' && selectedPeriode && (
            <span style={{
              background: '#f9731625', color: '#f97316',
              border: '1px solid #f9731650',
              padding: '3px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            }}>📅 Bulan {selectedPeriode}</span>
          )}
          {filterMode === 'tahun' && selectedTahun && (
            <span style={{
              background: '#f9731625', color: '#f97316',
              border: '1px solid #f9731650',
              padding: '3px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            }}>📅 Tahun {selectedTahun}</span>
          )}
          <span style={{ fontSize: 12, color: '#64748b' }}>
            — Menyaring {filteredGrandTotal.length} transaksi ({nonCNX.length} aktif, excl. CNX)
          </span>
        </div>
      )}

      {/* KPI Baris 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
        <KpiCard label="Total Omzet" value={formatCurrencyShort(stats.totalOmzet)} sub={`Diskon: ${formatCurrencyShort(stats.totalDiskon)}`} icon="💰" color="#f97316" />
        <KpiCard label="Total Kiriman" value={`${filteredGrandTotal.length} paket`} sub={`${stats.totalKoli} koli`} icon="📦" color="#3b82f6" />
        <KpiCard label="POD Rate" value={`${stats.podRate}%`} sub={`${stats.podCount} berhasil terkirim`} icon="✅" color="#22c55e" />
        <KpiCard label="Total Diskon" value={formatCurrencyShort(stats.totalDiskon)} sub={`Rata ${formatCurrencyShort(filteredGrandTotal.length > 0 ? Math.round(stats.totalDiskon / filteredGrandTotal.length) : 0)}/paket`} icon="🏷️" color="#a855f7" />
      </div>

      {/* KPI Baris 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Net Profit */}
        <KpiCard
          label="Net Profit"
          value={formatCurrencyShort(stats.netProfit)}
          sub={stats.totalPenalty > 0
            ? `Komisi Franchise − Penalty ${formatCurrencyShort(stats.totalPenalty)}`
            : "Komisi Franchise (Booking + Asuransi + Fwd Rate, excl. CNX)"}
          icon="💹"
          color={stats.totalPenalty > 0 ? "#ef4444" : "#22c55e"}
        />

        {/* Total Penalty */}
        <KpiCard
          label="Total Penalty"
          value={formatCurrencyShort(stats.totalPenalty)}
          sub={stats.penaltyCount > 0
            ? `${stats.penaltyCount} bulan × Rp 500rb — Lion Parcel omzet < 3jt (aktif s/d Apr 2024)`
            : "Tidak ada penalty aktif (semua bulan ≥ 3jt)"}
          icon="⚠️"
          color={stats.totalPenalty > 0 ? "#ef4444" : "#22c55e"}
        />

        {/* Produk Terpopuler */}
        <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#f59e0b', borderRadius: '14px 0 0 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Produk Terpopuler</div>
              {stats.produkTerpopuler ? (
                <>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stats.produkTerpopuler[0]}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    {stats.produkTerpopuler[1]} pengiriman · excl. CNX
                  </div>
                </>
              ) : <div style={{ fontSize: 14, color: '#475569' }}>—</div>}
            </div>
            <div style={{ fontSize: 26 }}>📦</div>
          </div>
        </div>

        {/* Top 3 Kota */}
        <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#06b6d4', borderRadius: '14px 0 0 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top 3 Kota Tujuan</div>
            <div style={{ fontSize: 20 }}>🗺️</div>
          </div>
          {stats.top3Kota.length === 0 ? (
            <div style={{ fontSize: 13, color: '#475569' }}>—</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stats.top3Kota.map(([kota, count], i) => (
                <div key={kota} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: i === 0 ? '#f9731630' : i === 1 ? '#64748b30' : '#cd7f3230',
                      color: i === 0 ? '#f97316' : i === 1 ? '#94a3b8' : '#cd7f32',
                      width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{kota}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#06b6d4', fontWeight: 700 }}>{count} paket</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigasi Terpadu */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: activeTab === t.key ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#1e2433',
              color: activeTab === t.key ? '#fff' : '#64748b',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Overview (Ringkasan) ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>🚚 Distribusi per Kurir</div>
            {stats.kurirSummary.length === 0 ? (
              <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Belum ada data.</div>
            ) : stats.kurirSummary.map((k: any) => (
              <div key={k.nama} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: k.warna || '#64748b' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{k.nama}</span>
                  </div>
                  <span style={{ fontSize: 13, color: k.warna || '#94a3b8', fontWeight: 700 }}>{num(k.paket)} paket · {formatCurrencyShort(k.omzet)}</span>
                </div>
                <MiniBar value={k.omzet} max={maxKurirOmzet} color={k.warna || '#64748b'} />
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>📊 Status Pengiriman</div>
            {(['POD', 'CNX', 'PENDING', 'TRANSIT'] as const).map(status => {
              const count = filteredGrandTotal.filter(d => d.status === status).length
              const omzet = filteredGrandTotal.filter(d => d.status === status).reduce((s, d) => s + num(d.total_biaya), 0)
              const pct = filteredGrandTotal.length > 0 ? ((count / filteredGrandTotal.length) * 100).toFixed(1) : '0'
              return (
                <div key={status} style={{ background: '#0d111c', borderRadius: 10, padding: '12px 16px', marginBottom: 10, border: `1px solid ${STATUS_COLOR[status]}30` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status] }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[status] }}>{status}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{count} paket ({pct}%)</span>
                  </div>
                  <MiniBar value={count} max={filteredGrandTotal.length} color={STATUS_COLOR[status]} />
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Omzet: {formatCurrencyShort(omzet)}</div>
                </div>
              )
            })}
          </div>

          <div className="card" style={{ padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>🕐 Transaksi Terbaru</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0d111c' }}>
                    {['No Resi', 'Kurir', 'Pengirim', 'Penerima', 'Tujuan', 'Status', 'Biaya'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecentTx.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '32px 0', textAlign: 'center', color: '#475569' }}>Belum ada data.</td></tr>
                  ) : filteredRecentTx.slice(0, 10).map((t: any) => (
                    <tr key={t.id || t.no_resi} style={{ borderBottom: '1px solid #1e2433' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{t.no_resi}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: `${t.kurir?.warna || '#64748b'}20`, color: t.kurir?.warna || '#94a3b8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {t.kurir?.kode || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{t.nama_pengirim || '—'}</td>
                      <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{t.nama_penerima || '—'}</td>
                      <td style={{ padding: '10px 16px', color: '#64748b', fontSize: 12 }}>{t.kota_tujuan || '—'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ color: STATUS_COLOR[t.status] || '#64748b', fontWeight: 700, fontSize: 12 }}>{t.status}</span>
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f1f5f9' }}>{formatCurrencyShort(num(t.total_biaya))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Tren Harian ── */}
      {activeTab === 'tren' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📈 Tren Omzet Harian</div>
            {stats.dailyTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>Belum ada data tren.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.dailyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => formatCurrencyShort(v)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatCurrencyShort(v), 'Omzet']}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="omzet" fill={selectedKurirInfo?.warna || '#f97316'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📦 Tren Volume Paket Harian</div>
            {stats.dailyTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>Belum ada data tren.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.dailyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [v, 'Paket']}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line type="monotone" dataKey="count" stroke={selectedKurirInfo?.warna || '#22c55e'} strokeWidth={2} dot={{ fill: selectedKurirInfo?.warna || '#22c55e', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 3: Per Kurir ── */}
      {activeTab === 'kurir' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {filteredSummary.length === 0 ? (
            <div className="card" style={{ padding: 32, gridColumn: '1/-1', textAlign: 'center', color: '#475569' }}>
              Tidak ada data summary kurir untuk filter yang dipilih.
            </div>
          ) : (
            filteredSummary.map((row: any) => {
              const kInfo = kurirOptions.find(k => k.nama === row.kurir)
              const warna = row.kurir_warna || kInfo?.warna || '#f97316'
              const omzet = num(row.total_omzet)
              const diskon = num(row.total_diskon)
              const penalty = num(row.penalty)
              const netProfit = diskon - penalty
              const paket = num(row.total_paket)

              return (
                <div key={`${row.kurir}-${row.periode}`} className="card" style={{ padding: 22, borderTop: `3px solid ${warna}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: warna }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{row.kurir}</span>
                    </div>
                    {row.periode && (
                      <span style={{ fontSize: 11, color: '#64748b', background: '#0d111c', padding: '3px 8px', borderRadius: 4 }}>
                        {row.periode}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: penalty > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { l: 'Paket', v: paket.toLocaleString('id-ID'), c: '#3b82f6' },
                      { l: 'Omzet', v: formatCurrencyShort(omzet), c: '#f97316' },
                      ...(penalty > 0 ? [{ l: 'Penalty', v: formatCurrencyShort(penalty), c: '#ef4444' }] : []),
                      { l: 'Net Profit', v: formatCurrencyShort(netProfit), c: netProfit < 0 ? '#ef4444' : '#22c55e' },
                    ].map(item => (
                      <div key={item.l} style={{ background: '#0d111c', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>{item.l}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: item.c }}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Tab 4: Komparasi Periode (Analitik) ── */}
      {activeTab === 'periode' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>📋 Ringkasan per Periode Bulanan</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0d111c' }}>
                    {['Periode', 'Total Paket', 'Omzet', 'Diskon', 'Penalty', 'Net Profit', 'POD Rate'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodeData.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '32px 0', textAlign: 'center', color: '#475569' }}>Belum ada data periode.</td></tr>
                  ) : periodeData.map(d => (
                    <tr key={d.periode} style={{ borderBottom: '1px solid #1e2433' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f1f5f9' }}>{d.periode}</td>
                      <td style={{ padding: '10px 16px', color: '#3b82f6', fontWeight: 700 }}>{d.paket}</td>
                      <td style={{ padding: '10px 16px', color: '#f97316', fontWeight: 700 }}>{formatCurrency(d.omzet)}</td>
                      <td style={{ padding: '10px 16px', color: '#22c55e', fontWeight: 700 }}>{formatCurrency(d.diskon)}</td>
                      <td style={{ padding: '10px 16px', color: d.penalty > 0 ? '#ef4444' : '#64748b', fontWeight: 700 }}>
                        {d.penalty > 0 ? formatCurrency(-d.penalty) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: d.netProfit < 0 ? '#ef4444' : d.penalty > 0 ? '#f97316' : '#22c55e', fontWeight: 700 }} title={`Komisi ${formatCurrency(d.diskon)}${d.penalty > 0 ? ` − Penalty ${formatCurrency(d.penalty)}` : ''}`}>
                        {formatCurrency(d.netProfit)}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, background: '#1e2433', borderRadius: 4, height: 6, overflow: 'hidden', minWidth: 80 }}>
                            <div style={{ width: `${d.podRate}%`, height: '100%', background: d.podRate >= 80 ? '#22c55e' : d.podRate >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: d.podRate >= 80 ? '#22c55e' : d.podRate >= 50 ? '#f59e0b' : '#ef4444', minWidth: 40 }}>
                            {d.podRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📈 Omzet per Periode</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={periodeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                  <XAxis dataKey="periode" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => formatCurrencyShort(v)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatCurrencyShort(v), 'Omzet']} labelStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="omzet" fill={accentColor} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📦 Volume Paket per Periode</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={periodeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                  <XAxis dataKey="periode" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [v, 'Paket']} labelStyle={{ color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="paket" stroke={accentColor} strokeWidth={2} dot={{ fill: accentColor, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 5: Top Kota (Analitik) ── */}
      {activeTab === 'kota' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📊 Top 10 Kota — Volume Paket</div>
            {kotaData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>Belum ada data kota tujuan.</div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={kotaData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="kota" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [v, 'Paket']} labelStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="jumlah" radius={[0, 4, 4, 0]}>
                    {kotaData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#f97316' : i === 1 ? '#ef4444' : i === 2 ? '#f59e0b' : accentColor + '90'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>🏆 Ranking Kota Tujuan</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {kotaData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569' }}>Belum ada data.</div>
              ) : kotaData.map((k, i) => (
                <div key={k.kota} style={{
                  background: '#0d111c', borderRadius: 8, padding: '10px 14px',
                  border: `1px solid ${i < 3 ? accentColor + '30' : '#1e2433'}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{
                    background: i === 0 ? '#f9731630' : i === 1 ? '#94a3b830' : i === 2 ? '#f59e0b30' : '#1e2433',
                    color: i === 0 ? '#f97316' : i === 1 ? '#94a3b8' : i === 2 ? '#f59e0b' : '#475569',
                    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.kota}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Omzet: {formatCurrencyShort(k.omzet)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: accentColor }}>{k.jumlah}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>paket</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 6: Analisis Berat (Analitik) ── */}
      {activeTab === 'berat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📊 Distribusi Berat Kiriman</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={beratData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v} paket`, 'Jumlah']} labelStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="jumlah" fill={accentColor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>⚖️ Detail per Kelompok Berat</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {beratData.map(b => (
                <div key={b.label} style={{ background: '#0d111c', borderRadius: 8, padding: '12px 14px', border: '1px solid #1e2433' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{b.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{b.jumlah} paket</span>
                  </div>
                  <div style={{ background: '#1e2433', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${b.pct}%`, height: '100%', background: accentColor, borderRadius: 4, transition: 'width 0.6s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>{b.pct}% dari total</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Omzet: {formatCurrencyShort(b.omzet)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 7: Heatmap Hari (Analitik) ── */}
      {activeTab === 'heatmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>
              🗓️ Volume Kiriman per Hari dalam Seminggu
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
              {heatmapData.map((h, i) => {
                const intensity = maxHari > 0 ? h.jumlah / maxHari : 0
                const isWeekend = i === 0 || i === 6
                const bgOpacity = Math.round(intensity * 80 + 10).toString(16).padStart(2, '0')
                return (
                  <div key={h.hari} style={{
                    background: `${accentColor}${bgOpacity}`,
                    border: `1px solid ${accentColor}${intensity > 0.5 ? '60' : '20'}`,
                    borderRadius: 12, padding: '20px 8px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: isWeekend ? '#f59e0b' : '#94a3b8', marginBottom: 8, fontWeight: 600 }}>{h.hari}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: intensity > 0.3 ? '#f1f5f9' : accentColor, marginBottom: 4 }}>{h.jumlah}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>paket</div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{formatCurrencyShort(h.omzet)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📊 Omzet per Hari</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={heatmapData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                <XAxis dataKey="hari" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatCurrencyShort(v)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatCurrencyShort(v), 'Omzet']} labelStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="omzet" radius={[4, 4, 0, 0]}>
                  {heatmapData.map((_, i) => (
                    <Cell key={i} fill={i === 0 || i === 6 ? '#f59e0b' : accentColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insight Otomatis */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>💡 Insight Otomatis</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {(() => {
                const sorted = [...heatmapData].sort((a, b) => b.jumlah - a.jumlah)
                const busiest = sorted[0]
                const slowest = sorted[sorted.length - 1]
                const weekdays = heatmapData.filter((_, i) => i > 0 && i < 6)
                const avgWeekday = weekdays.length > 0
                  ? Math.round(weekdays.reduce((s, h) => s + h.jumlah, 0) / weekdays.length) : 0
                return [
                  { label: 'Hari Tersibuk', value: busiest?.jumlah > 0 ? busiest.hari : '—', sub: `${busiest?.jumlah || 0} paket`, color: '#f97316' },
                  { label: 'Hari Paling Sepi', value: slowest?.jumlah === 0 ? '—' : slowest?.hari || '—', sub: `${slowest?.jumlah || 0} paket`, color: '#64748b' },
                  { label: 'Rata-rata Weekday', value: `${avgWeekday}`, sub: 'paket/hari', color: '#22c55e' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#0d111c', borderRadius: 10, padding: '14px 16px', border: '1px solid #1e2433', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{item.sub}</div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}