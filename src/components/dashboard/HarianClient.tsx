'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, Legend,
} from 'recharts'

// ─── Types ─────────────────────────────────────────────────────
type SummaryRow = {
  outlet: string
  kurir_kode: string
  kurir_nama: string
  kurir_warna: string
  tanggal: string
  total_paket: number
  total_koli: number
  total_omzet: number
  total_diskon: number
  net_omzet: number
  pod_count: number
  cnx_count: number
  cod_count: number
  noncod_count: number
}

type RecentTx = {
  id: string
  nomor_stt: string
  tanggal: string
  kota_tujuan: string
  total_biaya: number
  status: string
  jenis_kiriman: string
  kurir: { kode: string; nama: string; warna: string } | null
}

type Kurir = { kode: string; nama: string; warna: string }

// ─── Formatters ───────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000   ? `Rp ${(n / 1_000).toFixed(0)}rb`
  : `Rp ${n}`

const fmtFull = (n: number) =>
  n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

const STATUS_COLOR: Record<string, string> = {
  POD: '#22c55e',
  CNX: '#ef4444',
  PENDING: '#f59e0b',
  TRANSIT: '#3b82f6',
  DELIVERED: '#22c55e',
}

const RANGE_OPTIONS = [
  { value: '7',  label: '7 Hari' },
  { value: '14', label: '14 Hari' },
  { value: '30', label: '30 Hari' },
  { value: '90', label: '90 Hari' },
]

// ─── Sub Components ───────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, color, delta,
}: {
  label: string; value: string; sub: string; icon: string; color: string
  delta?: { value: number; positive: boolean }
}) {
  return (
    <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 4, height: '100%',
        background: color, borderRadius: '14px 0 0 14px',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 11, color: '#64748b', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
          <div style={{
            fontSize: 11, color: '#475569', marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{sub}</span>
            {delta && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: delta.positive ? '#22c55e' : '#ef4444',
                background: delta.positive ? '#22c55e15' : '#ef444415',
                padding: '2px 6px', borderRadius: 4,
              }}>
                {delta.positive ? '↑' : '↓'} {Math.abs(delta.value).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 26 }}>{icon}</div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] || '#64748b'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px',
      borderRadius: 4, color, background: color + '20',
      border: `1px solid ${color}40`,
    }}>{status}</span>
  )
}

// ─── Main Component ───────────────────────────────────────────
export default function HarianClient({
  summary, summary7d, recentTx, kurirList, todayStr,
}: {
  summary: SummaryRow[]
  summary7d: SummaryRow[]
  recentTx: RecentTx[]
  kurirList: Kurir[]
  todayStr: string
}) {
  // ─── State ────────────────────────────────────────────────
  const [range, setRange] = useState('30')
  const [selectedKurir, setSelectedKurir] = useState<string>('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // ─── Auto-refresh (refresh page every 5 minutes) ──────────
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => {
      setLastRefresh(new Date())
      // simple state bump → component re-renders with fresh server data via router.refresh()
      window.location.reload()
    }, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [autoRefresh])

  // ─── Filter Logic ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = summary
    if (selectedKurir) data = data.filter(d => d.kurir_kode === selectedKurir)
    return data
  }, [summary, selectedKurir])

  // Aggregate by tanggal (sum across outlets & kurir)
  const byDate = useMemo(() => {
    const map: Record<string, {
      tanggal: string
      total_paket: number
      total_omzet: number
      total_diskon: number
      net_omzet: number
      pod_count: number
      cnx_count: number
    }> = {}
    filtered.forEach(d => {
      const tgl = typeof d.tanggal === 'string' ? d.tanggal : (d.tanggal as any) instanceof Date ? (d.tanggal as any).toISOString().slice(0, 10) : String(d.tanggal || '')
      if (!map[tgl]) {
        map[tgl] = {
          tanggal: tgl,
          total_paket: 0, total_omzet: 0, total_diskon: 0,
          net_omzet: 0, pod_count: 0, cnx_count: 0,
        }
      }
      const m = map[tgl]
      m.total_paket += d.total_paket
      m.total_omzet += d.total_omzet
      m.total_diskon += d.total_diskon
      m.net_omzet += d.net_omzet
      m.pod_count += d.pod_count
      m.cnx_count += d.cnx_count
    })
    return Object.values(map).sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  }, [filtered])

  // ─── Today KPI (from full summary, not filtered by range) ──
  const todayData = useMemo(() => {
    const todayRows = summary.filter(d => d.tanggal === todayStr)
    let total_paket = 0, total_omzet = 0, total_diskon = 0,
        net_omzet = 0, pod_count = 0, cnx_count = 0
    todayRows.forEach(d => {
      total_paket += d.total_paket
      total_omzet += d.total_omzet
      total_diskon += d.total_diskon
      net_omzet += d.net_omzet
      pod_count += d.pod_count
      cnx_count += d.cnx_count
    })
    return { total_paket, total_omzet, total_diskon, net_omzet, pod_count, cnx_count }
  }, [summary, todayStr])

  // ─── Comparison vs same day last week ─────────────────────
  const lastWeek = useMemo(() => {
    const d = new Date(todayStr)
    d.setDate(d.getDate() - 7)
    const lastWeekStr = d.toISOString().slice(0, 10)
    const rows = summary.filter(r => r.tanggal === lastWeekStr)
    let total_paket = 0, total_omzet = 0
    rows.forEach(r => {
      total_paket += r.total_paket
      total_omzet += r.total_omzet
    })
    return { total_paket, total_omzet, str: lastWeekStr }
  }, [summary, todayStr])

  const calcDelta = (current: number, previous: number): { value: number; positive: boolean } | undefined => {
    if (!previous) return undefined
    const v = ((current - previous) / previous) * 100
    return { value: v, positive: v >= 0 }
  }

  // ─── Top 5 Kurir (aggregate 30d) ──────────────────────────
  const topKurir = useMemo(() => {
    const map: Record<string, {
      kode: string; nama: string; warna: string
      total_paket: number; total_omzet: number
    }> = {}
    filtered.forEach(d => {
      const k = d.kurir_kode
      if (!map[k]) {
        map[k] = {
          kode: k, nama: d.kurir_nama, warna: d.kurir_warna || '#64748b',
          total_paket: 0, total_omzet: 0,
        }
      }
      map[k].total_paket += d.total_paket
      map[k].total_omzet += d.total_omzet
    })
    return Object.values(map)
      .sort((a, b) => b.total_omzet - a.total_omzet)
      .slice(0, 5)
  }, [filtered])

  // ─── Recent Activity (with kurir filter) ──────────────────
  const filteredRecent = useMemo(() => {
    if (!selectedKurir) return recentTx
    return recentTx.filter(t => t.kurir?.kode === selectedKurir)
  }, [recentTx, selectedKurir])

  // ─── 7-day chart data ─────────────────────────────────────
  const chart7d = useMemo(() => {
    return [...byDate].slice(-7).map(d => ({
      tanggal: String(d.tanggal || '').slice(5), // MM-DD
      Omzet: d.total_omzet,
      'Net Omzet': d.net_omzet,
    }))
  }, [byDate])

  // ─── Pod Rate ─────────────────────────────────────────────
  const podRate = todayData.total_paket > 0
    ? (todayData.pod_count / todayData.total_paket) * 100
    : 0

  // ─── Render ───────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header + Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>📅 Dashboard Harian</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Monitoring real-time · Last update: {lastRefresh.toLocaleTimeString('id-ID')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Range filter */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 13,
              background: '#1e2433', color: '#f1f5f9', border: '1px solid #2d3748',
            }}
          >
            {RANGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Kurir filter */}
          <select
            value={selectedKurir}
            onChange={(e) => setSelectedKurir(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 13,
              background: '#1e2433', color: '#f1f5f9', border: '1px solid #2d3748',
            }}
          >
            <option value="">Semua Kurir</option>
            {kurirList.map(k => (
              <option key={k.kode} value={k.kode}>{k.nama}</option>
            ))}
          </select>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: autoRefresh ? '#22c55e20' : '#1e2433',
              color: autoRefresh ? '#22c55e' : '#94a3b8',
              border: `1px solid ${autoRefresh ? '#22c55e40' : '#2d3748'}`,
              fontWeight: 600,
            }}
          >
            {autoRefresh ? '🟢 Auto-refresh ON' : '⚫ Auto-refresh OFF'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}>
        <KpiCard
          label="Paket Hari Ini"
          value={todayData.total_paket.toLocaleString('id-ID')}
          sub={`vs ${lastWeek.total_paket} paket (7 hari lalu)`}
          icon="📦"
          color="#f97316"
          delta={calcDelta(todayData.total_paket, lastWeek.total_paket)}
        />
        <KpiCard
          label="Omzet Hari Ini"
          value={fmt(todayData.total_omzet)}
          sub={fmtFull(todayData.total_omzet)}
          icon="💰"
          color="#22c55e"
          delta={calcDelta(todayData.total_omzet, lastWeek.total_omzet)}
        />
        <KpiCard
          label="Net Omzet"
          value={fmt(todayData.net_omzet)}
          sub="Setelah potongan"
          icon="📊"
          color="#3b82f6"
        />
        <KpiCard
          label="POD Rate"
          value={`${podRate.toFixed(1)}%`}
          sub={`${todayData.pod_count} POD · ${todayData.cnx_count} CNX`}
          icon="🎯"
          color={podRate >= 90 ? '#22c55e' : podRate >= 70 ? '#f59e0b' : '#ef4444'}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }} className="charts-row">
        {/* Line Chart Tren */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Tren Omzet 7 Hari Terakhir</h3>
            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>Gross vs Net (setelah potongan)</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chart7d}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
              <XAxis dataKey="tanggal" stroke="#64748b" style={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" style={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a', border: '1px solid #2d3748',
                  borderRadius: 8, fontSize: 12,
                }}
                formatter={(v: number) => fmtFull(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Omzet" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Net Omzet" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart Top 5 Kurir */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Top 5 Kurir</h3>
            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>Berdasarkan omzet {range} hari</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topKurir} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
              <XAxis type="number" stroke="#64748b" style={{ fontSize: 11 }} tickFormatter={fmt} />
              <YAxis type="category" dataKey="kode" stroke="#64748b" style={{ fontSize: 11 }} width={50} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a', border: '1px solid #2d3748',
                  borderRadius: 8, fontSize: 12,
                }}
                formatter={(v: number) => fmtFull(v)}
              />
              <Bar dataKey="total_omzet" radius={[0, 6, 6, 0]}>
                {topKurir.map((k, i) => (
                  <Cell key={i} fill={k.warna || '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Aktivitas Terbaru</h3>
            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>10 transaksi terakhir {selectedKurir && `· ${selectedKurir}`}</p>
          </div>
          <span style={{
            fontSize: 11, color: '#94a3b8',
            padding: '4px 10px', borderRadius: 12,
            background: '#1e2433',
          }}>
            {filteredRecent.length} records
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2433' }}>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Nomor STT</th>
                <th style={thStyle}>Kurir</th>
                <th style={thStyle}>Tujuan</th>
                <th style={thStyle}>Jenis</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Biaya</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecent.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#475569' }}>
                    Belum ada transaksi
                  </td>
                </tr>
              ) : (
                filteredRecent.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #1e2433' }}>
                    <td style={tdStyle}>
                      {typeof tx.tanggal === 'string'
                        ? tx.tanggal
                        : (tx.tanggal as any) instanceof Date
                        ? (tx.tanggal as any).toISOString().slice(0, 10)
                        : String(tx.tanggal ?? '')}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#f97316' }}>{tx.nomor_stt}</td>
                    <td style={tdStyle}>
                      {tx.kurir ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: tx.kurir.warna || '#64748b',
                          }} />
                          {tx.kurir.kode}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={tdStyle}>{tx.kota_tujuan || '-'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        padding: '2px 6px', borderRadius: 4,
                        background: tx.jenis_kiriman === 'COD' ? '#ef444420' : '#3b82f620',
                        color: tx.jenis_kiriman === 'COD' ? '#ef4444' : '#3b82f6',
                      }}>{tx.jenis_kiriman}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(tx.total_biaya)}</td>
                    <td style={tdStyle}><StatusBadge status={tx.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSS for responsive grid */}
      <style jsx>{`
        .charts-row {
          @media (max-width: 768px) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', color: '#64748b',
  fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px',
}

const tdStyle: React.CSSProperties = {
  padding: '12px', color: '#cbd5e1', verticalAlign: 'middle',
}