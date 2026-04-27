'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

const fmt = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000   ? `Rp ${(n / 1_000).toFixed(0)}rb`
  : `Rp ${n}`

const fmtFull = (n: number) =>
  n >= 1_000_000_000 ? `Rp ${(n / 1_000_000_000).toFixed(2)}M`
  : n >= 1_000_000   ? `Rp ${(n / 1_000_000).toFixed(2)}jt`
  : n >= 1_000       ? `Rp ${(n / 1_000).toFixed(0)}rb`
  : `Rp ${n}`

const STATUS_COLOR: Record<string, string> = { POD: '#22c55e', CNX: '#ef4444', PENDING: '#f59e0b', TRANSIT: '#3b82f6' }

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

export default function OverviewClient({
  summary, recentTx, grandTotal,
}: {
  summary: any[]; recentTx: any[]; grandTotal: any[]
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tren' | 'kurir'>('overview')
  const [selectedKurir, setSelectedKurir] = useState<string>('') // ✅ filter ekspedisi

  // ✅ Daftar ekspedisi unik dari grandTotal
  const kurirOptions = useMemo(() => {
    const map: Record<string, { kode: string; nama: string; warna: string }> = {}
    grandTotal.forEach(d => {
      if (d.kurir?.kode && !map[d.kurir.kode]) {
        map[d.kurir.kode] = { kode: d.kurir.kode, nama: d.kurir.nama, warna: d.kurir.warna || '#64748b' }
      }
    })
    return Object.values(map)
  }, [grandTotal])

  // ✅ Filter semua data berdasarkan selectedKurir
  const filteredGrandTotal = useMemo(() =>
    selectedKurir ? grandTotal.filter(d => d.kurir?.kode === selectedKurir) : grandTotal,
    [grandTotal, selectedKurir]
  )
  const filteredRecentTx = useMemo(() =>
    selectedKurir ? recentTx.filter(d => d.kurir?.kode === selectedKurir) : recentTx,
    [recentTx, selectedKurir]
  )
  const filteredSummary = useMemo(() =>
    selectedKurir ? summary.filter(d => d.kurir === selectedKurir) : summary,
    [summary, selectedKurir]
  )

  const selectedKurirInfo = kurirOptions.find(k => k.kode === selectedKurir)

  const stats = useMemo(() => {
  const totalOmzet = filteredGrandTotal.reduce((s, d) => s + (d.total_biaya || 0), 0)
  const totalDiskon = filteredGrandTotal.reduce((s, d) => s + (d.diskon_booking || 0), 0)
  const totalKoli = filteredGrandTotal.reduce((s, d) => s + (d.koli || 0), 0)
  const podCount = filteredGrandTotal.filter(d => d.status === 'POD').length
  const podRate = filteredGrandTotal.length > 0 ? ((podCount / filteredGrandTotal.length) * 100).toFixed(1) : '0'

  const byDate: Record<string, { count: number; omzet: number }> = {}
  filteredRecentTx.forEach(d => {
    const dt = d.tanggal?.slice(0, 10) || ''
    if (!byDate[dt]) byDate[dt] = { count: 0, omzet: 0 }
    byDate[dt].count++
    byDate[dt].omzet += d.total_biaya || 0
  })
  const dailyTrend = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({ date: date.slice(5), count: d.count, omzet: d.omzet }))

  const kurirSummary = filteredSummary.reduce((acc: Record<string, any>, s) => {
    if (!acc[s.kurir]) acc[s.kurir] = { nama: s.kurir, warna: s.kurir_warna, paket: 0, omzet: 0, diskon: 0 }
    acc[s.kurir].paket += s.total_paket || 0
    acc[s.kurir].omzet += s.total_omzet || 0
    acc[s.kurir].diskon += s.total_diskon || 0
    return acc
  }, {})

  // ✅ Kalkulasi baru — harus di dalam useMemo
  const nonCNX = filteredGrandTotal.filter(d => d.status !== 'CNX')

  const netProfit = nonCNX.reduce((s, d) =>
    s + (d.diskon_booking || 0) + (d.diskon_asuransi || 0) + (d.diskon_forward_rate || 0), 0)

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

  return { totalOmzet, totalDiskon, totalKoli, podRate, podCount, dailyTrend, kurirSummary: Object.values(kurirSummary), netProfit, produkTerpopuler, top3Kota }
}, [filteredGrandTotal, filteredRecentTx, filteredSummary])

  const maxKurirOmzet = Math.max(...stats.kurirSummary.map((k: any) => k.omzet), 1)

  const tabs = [
    { key: 'overview', label: '📊 Ringkasan' },
    { key: 'tren',     label: '📈 Tren Harian' },
    { key: 'kurir',    label: '🚚 Per Kurir' },
  ]

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>Dashboard Overview</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
            {selectedKurir ? `Data ekspedisi ${selectedKurirInfo?.nama || selectedKurir}` : 'Semua data transaksi lintas ekspedisi'}
          </p>
        </div>

        {/* ✅ Filter Ekspedisi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={selectedKurir}
            onChange={e => setSelectedKurir(e.target.value)}
            style={{
              background: '#1e2433',
              border: `1px solid ${selectedKurirInfo ? selectedKurirInfo.warna : '#2d3748'}`,
              borderRadius: 8, padding: '7px 14px',
              color: selectedKurirInfo ? selectedKurirInfo.warna : '#94a3b8',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              outline: 'none', minWidth: 180,
            }}
          >
            <option value="">🚚 Semua Ekspedisi</option>
            {kurirOptions.map(k => (
              <option key={k.kode} value={k.kode}>
                {k.nama} ({k.kode})
              </option>
            ))}
          </select>

          <div style={{ fontSize: 12, color: '#475569', background: '#1e2433', padding: '6px 14px', borderRadius: 8 }}>
            {filteredGrandTotal.length} transaksi
          </div>
        </div>
      </div>

      {/* ✅ Banner ekspedisi terpilih */}
      {selectedKurir && selectedKurirInfo && (
        <div style={{
          background: `${selectedKurirInfo.warna}15`,
          border: `1px solid ${selectedKurirInfo.warna}40`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            background: `${selectedKurirInfo.warna}25`, color: selectedKurirInfo.warna,
            border: `1px solid ${selectedKurirInfo.warna}50`,
            padding: '3px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700,
          }}>{selectedKurirInfo.kode}</span>
          <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{selectedKurirInfo.nama}</span>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 4 }}>
            — Menampilkan data khusus ekspedisi ini
          </span>
          <button onClick={() => setSelectedKurir('')} style={{
            marginLeft: 'auto', background: 'transparent', border: 'none',
            color: '#64748b', cursor: 'pointer', fontSize: 13,
          }}>✕ Reset</button>
        </div>
      )}

      {/* KPI */}
      {/* KPI Baris 1 */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
  <KpiCard label="Total Omzet" value={fmt(stats.totalOmzet)} sub={`Diskon: ${fmt(stats.totalDiskon)}`} icon="💰" color="#f97316" />
  <KpiCard label="Total Kiriman" value={`${filteredGrandTotal.length} paket`} sub={`${stats.totalKoli} koli`} icon="📦" color="#3b82f6" />
  <KpiCard label="POD Rate" value={`${stats.podRate}%`} sub={`${stats.podCount} berhasil terkirim`} icon="✅" color="#22c55e" />
  <KpiCard label="Total Diskon" value={fmt(stats.totalDiskon)} sub={`Rata ${fmt(filteredGrandTotal.length > 0 ? Math.round(stats.totalDiskon / filteredGrandTotal.length) : 0)}/paket`} icon="🏷️" color="#a855f7" />
</div>

{/* KPI Baris 2 */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>

  {/* Net Profit */}
  <KpiCard
    label="Net Profit"
    value={fmt(stats.netProfit)}
    sub="Booking + Asuransi + Fwd Rate (excl. CNX)"
    icon="💹"
    color="#22c55e"
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: activeTab === t.key ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#1e2433',
              color: activeTab === t.key ? '#fff' : '#64748b', transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
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
                  <span style={{ fontSize: 13, color: k.warna || '#94a3b8', fontWeight: 700 }}>{k.paket} paket · {fmt(k.omzet)}</span>
                </div>
                <MiniBar value={k.omzet} max={maxKurirOmzet} color={k.warna || '#64748b'} />
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>📊 Status Pengiriman</div>
            {(['POD', 'CNX', 'PENDING', 'TRANSIT'] as const).map(status => {
              const count = filteredGrandTotal.filter(d => d.status === status).length
              const omzet = filteredGrandTotal.filter(d => d.status === status).reduce((s, d) => s + (d.total_biaya || 0), 0)
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
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Omzet: {fmt(omzet)}</div>
                </div>
              )
            })}
          </div>

          <div className="card" style={{ padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>🕐 Transaksi Terbaru</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0d111c' }}>
                    {['Tanggal', 'STT', 'Kurir', 'Tujuan', 'Produk', 'Berat', 'Total', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecentTx.slice(0, 15).map((tx, i) => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #1e2433', background: i % 2 === 0 ? 'transparent' : '#0d111c08' }}>
                      <td style={{ padding: '9px 12px', color: '#64748b' }}>{tx.tanggal?.slice(0, 10)}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{tx.nomor_stt?.slice(-10)}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: (tx.kurir?.warna || '#64748b') + '20', color: tx.kurir?.warna || '#94a3b8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {tx.kurir?.kode || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.kota_tujuan?.split('-')[1] || tx.kota_tujuan}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{tx.nama_produk || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b' }}>{tx.berat_kena_biaya} kg</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#f97316' }}>{fmt(tx.total_biaya || 0)}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: (STATUS_COLOR[tx.status] || '#64748b') + '20', color: STATUS_COLOR[tx.status] || '#64748b', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRecentTx.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>
                  {selectedKurir ? `Belum ada transaksi untuk ekspedisi ${selectedKurir}.` : 'Belum ada transaksi.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Tren */}
      {activeTab === 'tren' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>
              📈 Omzet Harian {selectedKurir ? `— ${selectedKurir}` : '(Semua Ekspedisi)'}
            </div>
            {stats.dailyTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>Belum ada data tren.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.dailyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmtFull(v), 'Omzet']}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="omzet" fill={selectedKurirInfo?.warna || 'url(#barGrad)'} radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ef444460" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>
              📦 Volume Paket Harian {selectedKurir ? `— ${selectedKurir}` : ''}
            </div>
            {stats.dailyTrend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>Belum ada data tren.</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
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

      {/* Tab: Per Kurir */}
      {activeTab === 'kurir' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {filteredSummary.length === 0 ? (
            <div className="card" style={{ padding: 32, gridColumn: '1/-1', textAlign: 'center', color: '#475569' }}>
              Belum ada data summary{selectedKurir ? ` untuk ${selectedKurir}` : ''}.
            </div>
          ) : (
            Object.entries(
              filteredSummary.reduce((acc: Record<string, any[]>, s) => {
                if (!acc[s.periode]) acc[s.periode] = []
                acc[s.periode].push(s)
                return acc
              }, {})
            ).slice(0, 6).map(([periode, rows]) => (
              <div key={periode} className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>📅 {periode}</div>
                {rows.map((row: any) => (
                  <div key={row.kurir} style={{ background: '#0d111c', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: `1px solid ${row.kurir_warna || '#1e2433'}30` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: row.kurir_warna || '#64748b' }} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{row.kurir}</span>
                      </div>
                      <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 700 }}>POD {row.pod_rate}%</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {[
                        { l: 'Paket', v: row.total_paket },
                        { l: 'Omzet', v: fmt(row.total_omzet) },
                        { l: 'Diskon', v: fmt(row.total_diskon) },
                      ].map(x => (
                        <div key={x.l} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: row.kurir_warna || '#f97316' }}>{x.v}</div>
                          <div style={{ fontSize: 10, color: '#475569' }}>{x.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}