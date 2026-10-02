'use client'

import { useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { formatCurrency, formatCurrencyShort, formatCurrencyAccounting } from '@/lib/format/currency'

// ============================================================
// TYPES
// ============================================================

export interface SummaryHarianRow {
  outlet: string
  kurir_kode: string
  kurir_nama: string
  kurir_warna: string
  tanggal: string
  total_paket: number | string
  total_koli: number | string
  total_omzet: number | string
  total_diskon: number | string
  net_omzet: number | string
  pod_count: number | string
  cnx_count: number | string
  cod_count: number | string
  noncod_count: number | string
}

export interface KurirOption {
  kode: string
  nama: string
  warna: string
}

// ============================================================
// HELPERS
// ============================================================

const DAYS_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

function formatPeriodeIndo(periodeStr: string): string {
  if (!periodeStr) return ''
  const parts = periodeStr.split('-')
  if (parts.length < 2) return periodeStr
  const year = parts[0]
  const mIndex = parseInt(parts[1], 10) - 1
  if (mIndex >= 0 && mIndex < 12) {
    return `${MONTHS_INDO[mIndex]} ${year}`
  }
  return periodeStr
}

function formatDateIndo(dateStr: string): { full: string; dayName: string; short: string } {
  if (!dateStr) return { full: '-', dayName: '-', short: '-' }
  const parts = String(dateStr).slice(0, 10).split('-')
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    const d = parseInt(parts[2], 10)
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const dt = new Date(y, m, d)
      if (!isNaN(dt.getTime())) {
        const dayName = DAYS_NAME[dt.getDay()] || '-'
        const dayNum = String(d).padStart(2, '0')
        const monthName = MONTHS_INDO[m]?.slice(0, 3) || ''
        const full = `${dayName}, ${dayNum} ${monthName} ${y}`
        const short = `${dayNum} ${monthName}`
        return { full, dayName, short }
      }
    }
  }
  return { full: String(dateStr), dayName: '-', short: String(dateStr) }
}

// ============================================================
// COMPONENT
// ============================================================

export default function HarianClient({
  summary,
  kurirList,
  selectedPeriode,
  availablePeriods,
  initialKurir,
}: {
  summary: SummaryHarianRow[]
  kurirList: KurirOption[]
  selectedPeriode: string
  availablePeriods: string[]
  initialKurir: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [selectedKurir, setSelectedKurir] = useState<string>(initialKurir)

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (key === 'periode') {
      params.set('periode', value)
      if (selectedKurir) params.set('kurir', selectedKurir)
    } else if (key === 'kurir') {
      if (value) params.set('kurir', value)
      params.set('periode', selectedPeriode)
      setSelectedKurir(value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  // Filter raw summary rows
  const filteredSummary = useMemo(() => {
    if (!selectedKurir) return summary
    return summary.filter(r => r.kurir_kode === selectedKurir)
  }, [summary, selectedKurir])

  // Aggregate per tanggal
  const dailyData = useMemo(() => {
    const mapByDate: Record<string, {
      tanggal: string
      dateLabel: string
      fullLabel: string
      dayName: string
      lion_paket: number
      lion_omzet: number
      jne_paket: number
      jne_omzet: number
      total_paket: number
      total_omzet: number
      total_diskon: number
      net_omzet: number
      pod_count: number
      cnx_count: number
    }> = {}

    filteredSummary.forEach(r => {
      const d = String(r.tanggal || '').slice(0, 10)
      if (!d) return

      if (!mapByDate[d]) {
        const { full, dayName, short } = formatDateIndo(d)
        mapByDate[d] = {
          tanggal: d,
          dateLabel: short,
          fullLabel: full,
          dayName,
          lion_paket: 0,
          lion_omzet: 0,
          jne_paket: 0,
          jne_omzet: 0,
          total_paket: 0,
          total_omzet: 0,
          total_diskon: 0,
          net_omzet: 0,
          pod_count: 0,
          cnx_count: 0,
        }
      }

      const pkt = Number(r.total_paket) || 0
      const omz = Number(r.total_omzet) || 0
      const dsk = Number(r.total_diskon) || 0
      const net = Number(r.net_omzet) || 0
      const pod = Number(r.pod_count) || 0
      const cnx = Number(r.cnx_count) || 0

      if (r.kurir_kode === 'LION') {
        mapByDate[d].lion_paket += pkt
        mapByDate[d].lion_omzet += omz
        mapByDate[d].pod_count += pod
        mapByDate[d].cnx_count += cnx
      } else if (r.kurir_kode === 'JNE') {
        mapByDate[d].jne_paket += pkt
        mapByDate[d].jne_omzet += omz
      }

      mapByDate[d].total_paket += pkt
      mapByDate[d].total_omzet += omz
      mapByDate[d].total_diskon += dsk
      mapByDate[d].net_omzet += net
    })

    return Object.values(mapByDate).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  }, [filteredSummary])

  // KPIs
  const stats = useMemo(() => {
    const totalOmzet = dailyData.reduce((acc, d) => acc + d.total_omzet, 0)
    const totalPaket = dailyData.reduce((acc, d) => acc + d.total_paket, 0)
    const totalNet = dailyData.reduce((acc, d) => acc + d.net_omzet, 0)
    const totalPod = dailyData.reduce((acc, d) => acc + d.pod_count, 0)
    const totalCnx = dailyData.reduce((acc, d) => acc + d.cnx_count, 0)

    const activeDays = dailyData.length || 1
    const avgOmzetPerDay = Math.round(totalOmzet / activeDays)
    const avgPaketPerDay = (totalPaket / activeDays).toFixed(1)

    // Peak day (hari tersibuk)
    const peakDay = dailyData.length > 0
      ? [...dailyData].sort((a, b) => b.total_omzet - a.total_omzet)[0]
      : null

    const podRate = (totalPod + totalCnx > 0)
      ? ((totalPod / (totalPod + totalCnx)) * 100).toFixed(1)
      : '100'

    return {
      totalOmzet,
      totalPaket,
      totalNet,
      activeDays,
      avgOmzetPerDay,
      avgPaketPerDay,
      peakDay,
      podRate,
      totalPod,
      totalCnx,
    }
  }, [dailyData])

  // Day of Week Distribution (Pola Mingguan: Senin s/d Minggu)
  const dayOfWeekDistribution = useMemo(() => {
    const list = [
      { name: 'Senin', paket: 0, omzet: 0, count: 0 },
      { name: 'Selasa', paket: 0, omzet: 0, count: 0 },
      { name: 'Rabu', paket: 0, omzet: 0, count: 0 },
      { name: 'Kamis', paket: 0, omzet: 0, count: 0 },
      { name: 'Jumat', paket: 0, omzet: 0, count: 0 },
      { name: 'Sabtu', paket: 0, omzet: 0, count: 0 },
      { name: 'Minggu', paket: 0, omzet: 0, count: 0 },
    ]

    dailyData.forEach(d => {
      const parts = String(d.tanggal || '').slice(0, 10).split('-')
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10) - 1
        const day = parseInt(parts[2], 10)
        if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
          const dt = new Date(y, m, day)
          if (!isNaN(dt.getTime())) {
            const rawDay = dt.getDay() // 0 = Minggu, 1 = Senin, ...
            const targetIndex = rawDay === 0 ? 6 : rawDay - 1
            list[targetIndex].paket += d.total_paket
            list[targetIndex].omzet += d.total_omzet
            list[targetIndex].count += 1
          }
        }
      }
    })

    const maxPaket = Math.max(...list.map(l => l.paket), 1)
    const busiestDay = [...list].sort((a, b) => b.paket - a.paket)[0]

    return { list, maxPaket, busiestDay }
  }, [dailyData])

  return (
    <div style={{ padding: '24px 32px', color: '#f1f5f9' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: 16, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📅 Analisis Performa Harian</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            Pola operasional kalender harian, hari tersibuk (peak day), dan distribusi kiriman outlet.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Periode selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Periode:</span>
            <select
              className="input-base"
              style={{
                width: 'auto', minWidth: 160, background: '#0d111c',
                border: '1px solid #1e2433', borderRadius: 8, padding: '8px 12px',
                color: '#f1f5f9', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
              value={selectedPeriode}
              onChange={(e) => updateFilter('periode', e.target.value)}
            >
              {availablePeriods.map(p => (
                <option key={p} value={p}>
                  {formatPeriodeIndo(p)} ({p})
                </option>
              ))}
            </select>
          </div>

          {/* Kurir Quick Switcher */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => updateFilter('kurir', '')}
              style={{
                background: !selectedKurir ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#111827',
                color: !selectedKurir ? '#fff' : '#94a3b8',
                border: `1px solid ${!selectedKurir ? '#f97316' : '#1e2433'}`,
                borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Semua Ekspedisi
            </button>
            <button
              onClick={() => updateFilter('kurir', 'LION')}
              style={{
                background: selectedKurir === 'LION' ? '#f97316' : '#111827',
                color: selectedKurir === 'LION' ? '#fff' : '#94a3b8',
                border: `1px solid ${selectedKurir === 'LION' ? '#f97316' : '#1e2433'}`,
                borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              📦 Lion Parcel
            </button>
            <button
              onClick={() => updateFilter('kurir', 'JNE')}
              style={{
                background: selectedKurir === 'JNE' ? '#ef4444' : '#111827',
                color: selectedKurir === 'JNE' ? '#fff' : '#94a3b8',
                border: `1px solid ${selectedKurir === 'JNE' ? '#ef4444' : '#1e2433'}`,
                borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              🔴 JNE Express
            </button>
          </div>
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        {/* Card 1: Total Paket */}
        <div className="card" style={{ padding: '16px 18px', background: '#111827', border: '1px solid #1e2433', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📦 Total Paket Bulan Ini
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {stats.totalPaket.toLocaleString('id-ID')} <span style={{ fontSize: 13, fontWeight: 500 }}>Paket</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {stats.activeDays} hari operasional aktif
          </div>
        </div>

        {/* Card 2: Total Omzet */}
        <div className="card" style={{ padding: '16px 18px', background: '#111827', border: '1px solid #1e2433', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            💰 Total Omzet Bruto
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f97316', marginTop: 4 }}>
            {formatCurrency(stats.totalOmzet)}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Periode {formatPeriodeIndo(selectedPeriode)}
          </div>
        </div>

        {/* Card 3: Rata-rata Harian */}
        <div className="card" style={{ padding: '16px 18px', background: '#111827', border: '1px solid #1e2433', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📊 Rata-Rata per Hari
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>
            {stats.avgPaketPerDay} <span style={{ fontSize: 13, fontWeight: 500 }}>Paket/hari</span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Omzet: {formatCurrencyShort(stats.avgOmzetPerDay)} / hari
          </div>
        </div>

        {/* Card 4: Peak Day */}
        <div className="card" style={{ padding: '16px 18px', background: '#111827', border: '1px solid #f59e0b40', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
            🔥 Hari Teramai (Peak Day)
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
            {stats.peakDay ? stats.peakDay.dateLabel : '-'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {stats.peakDay
              ? `${stats.peakDay.total_paket} Paket · ${formatCurrencyShort(stats.peakDay.total_omzet)}`
              : 'Belum ada transaksi'}
          </div>
        </div>

        {/* Card 5: POD Rate */}
        <div className="card" style={{ padding: '16px 18px', background: '#111827', border: '1px solid #1e2433', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🎯 Tingkat POD Sukses
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7', marginTop: 4 }}>
            {stats.podRate}%
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {stats.totalPod} POD · {stats.totalCnx} Cancel (CNX)
          </div>
        </div>
      </div>

      {/* Main Chart Section: Tren Harian Tanggal 1 - 31 */}
      <div className="card" style={{
        background: '#111827', border: '1px solid #1e2433', borderRadius: 12,
        padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              📈 Tren Omzet & Paket Harian ({formatPeriodeIndo(selectedPeriode)})
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Pergerakan transaksi harian tanggal 1 sampai akhir bulan.
            </p>
          </div>
          {stats.peakDay && (
            <div style={{
              background: '#f59e0b20', border: '1px solid #f59e0b50', borderRadius: 6,
              padding: '4px 10px', fontSize: 12, color: '#f59e0b', fontWeight: 600,
            }}>
              ⭐ Puncak: {stats.peakDay.fullLabel}
            </div>
          )}
        </div>

        {dailyData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
            Tidak ada transaksi tercatat pada periode ini.
          </div>
        ) : (
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left" width={65} axisLine={false}
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrencyShort(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#38bdf8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `${v} pkt`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null
                    const data = payload[0].payload
                    return (
                      <div style={{
                        background: '#0d111c', border: '1px solid #2d3748',
                        borderRadius: 8, padding: '10px 14px', fontSize: 12,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      }}>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>
                          {data.fullLabel}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#f97316' }}>
                          <span>Total Omzet:</span>
                          <span style={{ fontWeight: 700 }}>{formatCurrency(data.total_omzet)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#38bdf8', marginTop: 2 }}>
                          <span>Total Paket:</span>
                          <span style={{ fontWeight: 700 }}>{data.total_paket} Paket</span>
                        </div>
                        {data.lion_omzet > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#ea580c', fontSize: 11, marginTop: 4 }}>
                            <span>Lion Parcel:</span>
                            <span>{data.lion_paket} pkt ({formatCurrencyShort(data.lion_omzet)})</span>
                          </div>
                        )}
                        {data.jne_omzet > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#ef4444', fontSize: 11, marginTop: 2 }}>
                            <span>JNE Express:</span>
                            <span>{data.jne_paket} pkt ({formatCurrencyShort(data.jne_omzet)})</span>
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: 10, fontSize: 12 }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="total_paket"
                  name="Jumlah Paket"
                  fill="#38bdf8"
                  opacity={0.35}
                  radius={[4, 4, 0, 0]}
                  barSize={16}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total_omzet"
                  name="Total Omzet"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f97316' }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Day of Week Insights (Pola Mingguan) */}
      <div className="card" style={{
        background: '#111827', border: '1px solid #1e2433', borderRadius: 12,
        padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
              🗓️ Pola Distribusi Hari dalam Seminggu
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Akumulasi paket & omzet berdasarkan hari (Senin – Minggu) di bulan {formatPeriodeIndo(selectedPeriode)}.
            </p>
          </div>
          {dayOfWeekDistribution.busiestDay && (
            <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
              🔥 Hari Paling Ramai: {dayOfWeekDistribution.busiestDay.name.toUpperCase()} ({dayOfWeekDistribution.busiestDay.paket} Paket)
            </div>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
        }}>
          {dayOfWeekDistribution.list.map(d => {
            const isBusiest = dayOfWeekDistribution.busiestDay?.name === d.name
            const pct = (d.paket / dayOfWeekDistribution.maxPaket) * 100
            return (
              <div
                key={d.name}
                style={{
                  background: isBusiest ? '#f9731615' : '#0d111c',
                  border: isBusiest ? '1.5px solid #f97316' : '1px solid #1e2433',
                  borderRadius: 10, padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isBusiest ? '#f97316' : '#f1f5f9' }}>
                    {d.name}
                  </span>
                  {isBusiest && <span style={{ fontSize: 12 }}>🔥</span>}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: isBusiest ? '#f97316' : '#38bdf8' }}>
                  {d.paket} <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>pkt</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {formatCurrencyShort(d.omzet)}
                </div>
                {/* Visual bar */}
                <div style={{ background: '#1e2433', height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: isBusiest ? '#f97316' : '#38bdf8',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Daily Records Table */}
      <div className="card" style={{
        background: '#111827', border: '1px solid #1e2433', borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2433' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            📋 Rincian Transaksi Harian ({dailyData.length} Hari Operasional)
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0d111c', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433' }}>Tanggal</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433' }}>Hari</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433', textAlign: 'center' }}>Lion (Pkt)</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433', textAlign: 'center' }}>JNE (Pkt)</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433', textAlign: 'center' }}>Total Paket</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433', textAlign: 'right' }}>Omzet Lion</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433', textAlign: 'right' }}>Omzet JNE</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433', textAlign: 'right' }}>Total Omzet</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433', textAlign: 'right' }}>Komisi Agen</th>
                <th style={{ padding: '10px 16px', borderBottom: '1px solid #1e2433', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map((row) => {
                const isPeak = stats.peakDay?.tanggal === row.tanggal
                return (
                  <tr
                    key={row.tanggal}
                    style={{
                      borderBottom: '1px solid #1e2433',
                      background: isPeak ? '#f59e0b10' : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isPeak ? '#f59e0b20' : '#1e243330')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isPeak ? '#f59e0b10' : 'transparent')}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: isPeak ? '#f59e0b' : '#f1f5f9' }}>
                      {row.tanggal}
                      {isPeak && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, background: '#f59e0b', color: '#000',
                          padding: '1px 5px', borderRadius: 4, fontWeight: 700,
                        }}>
                          PEAK
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#94a3b8' }}>
                      {row.dayName}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#ea580c', fontWeight: 600 }}>
                      {row.lion_paket > 0 ? row.lion_paket : '-'}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>
                      {row.jne_paket > 0 ? row.jne_paket : '-'}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>
                      {row.total_paket}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#94a3b8' }}>
                      {row.lion_omzet > 0 ? formatCurrency(row.lion_omzet) : '-'}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#94a3b8' }}>
                      {row.jne_omzet > 0 ? formatCurrency(row.jne_omzet) : '-'}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#f97316' }}>
                      {formatCurrency(row.total_omzet)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#22c55e' }}>
                      {formatCurrency(row.total_diskon)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e40',
                      }}>
                        {row.cnx_count > 0 ? `${row.pod_count} POD / ${row.cnx_count} CNX` : 'LUNAS / POD'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
