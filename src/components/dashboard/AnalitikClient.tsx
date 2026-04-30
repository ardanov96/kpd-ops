'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Cell,
} from 'recharts'

const fmt = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000   ? `Rp ${(n / 1_000).toFixed(0)}rb`
  : `Rp ${n}`

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const BERAT_BUCKET = [
  { label: '< 1 kg',  min: 0,  max: 1 },
  { label: '1–3 kg',  min: 1,  max: 3 },
  { label: '3–5 kg',  min: 3,  max: 5 },
  { label: '5–10 kg', min: 5,  max: 10 },
  { label: '> 10 kg', min: 10, max: Infinity },
]

const TABS = [
  { key: 'periode', label: '📅 Perbandingan Periode' },
  { key: 'kota',    label: '🗺️ Top Kota Tujuan' },
  { key: 'berat',   label: '⚖️ Analisis Berat' },
  { key: 'heatmap', label: '🗓️ Heatmap Hari' },
]

export default function AnalitikClient({
  transaksi, kurirList,
}: {
  transaksi: any[]
  kurirList: any[]
}) {
  const [activeTab, setActiveTab] = useState('periode')
  const [selectedPeriode, setSelectedPeriode] = useState('')
  const [selectedKurir, setSelectedKurir] = useState('')

  const filtered = useMemo(() => {
    let data = selectedKurir ? transaksi.filter(t => t.kurir?.kode === selectedKurir) : transaksi
        if (selectedPeriode) {
            data = data.filter(t => t.tanggal?.slice(0, 7) === selectedPeriode)
        }
        return data
    }, [transaksi, selectedKurir, selectedPeriode])

  const nonCNX = useMemo(() => filtered.filter(t => t.status !== 'CNX'), [filtered])

  const selectedKurirInfo = kurirList.find(k => k.kode === selectedKurir)
  const accentColor = selectedKurirInfo?.warna || '#f97316'

  // ── Tab 1: Perbandingan Periode ──
  const periodeData = useMemo(() => {
    const map: Record<string, { periode: string; omzet: number; paket: number; pod: number; total: number; diskon: number }> = {}
    filtered.forEach(t => {
      const p = t.tanggal?.slice(0, 7) || ''
      if (!p) return
      if (!map[p]) map[p] = { periode: p, omzet: 0, paket: 0, pod: 0, total: 0, diskon: 0 }
      map[p].omzet += t.total_biaya || 0
      map[p].paket++
      map[p].total++
      map[p].diskon += (t.diskon_booking || 0) + (t.diskon_asuransi || 0) + (t.diskon_forward_rate || 0)
      if (t.status === 'POD') map[p].pod++
    })
    return Object.values(map)
      .sort((a, b) => a.periode.localeCompare(b.periode))
      .map(d => ({ ...d, podRate: d.total > 0 ? +((d.pod / d.total) * 100).toFixed(1) : 0 }))
  }, [filtered])

  // ── Tab 2: Top Kota ──
  const kotaData = useMemo(() => {
    const map: Record<string, { kota: string; jumlah: number; omzet: number }> = {}
    nonCNX.forEach(t => {
      const kota = t.kota_tujuan?.split('-')[1]?.trim() || t.kota_tujuan || '—'
      if (!map[kota]) map[kota] = { kota, jumlah: 0, omzet: 0 }
      map[kota].jumlah++
      map[kota].omzet += t.total_biaya || 0
    })
    return Object.values(map).sort((a, b) => b.jumlah - a.jumlah).slice(0, 10)
  }, [nonCNX])

  // ── Tab 3: Analisis Berat ──
  const beratData = useMemo(() =>
    BERAT_BUCKET.map(b => {
      const rows = nonCNX.filter(t => {
        const berat = t.berat_kena_biaya || 0
        return berat >= b.min && berat < b.max
      })
      return {
        label: b.label,
        jumlah: rows.length,
        omzet: rows.reduce((s, t) => s + (t.total_biaya || 0), 0),
        pct: nonCNX.length > 0 ? +((rows.length / nonCNX.length) * 100).toFixed(1) : 0,
      }
    }),
    [nonCNX]
  )

  // ── Tab 4: Heatmap Hari ──
  const heatmapData = useMemo(() => {
    const map: Record<number, { hari: string; jumlah: number; omzet: number }> = {}
    for (let i = 0; i < 7; i++) map[i] = { hari: HARI[i], jumlah: 0, omzet: 0 }
    nonCNX.forEach(t => {
      if (!t.tanggal) return
      const day = new Date(t.tanggal).getDay()
      map[day].jumlah++
      map[day].omzet += t.total_biaya || 0
    })
    return Object.values(map)
  }, [nonCNX])

  const maxHari = Math.max(...heatmapData.map(h => h.jumlah), 1)

  return (
    <div style={{ padding: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>Analitik</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
            {selectedKurir && selectedPeriode
                ? `${selectedKurirInfo?.nama} · ${selectedPeriode}`
                : selectedKurir
                ? `Data ekspedisi ${selectedKurirInfo?.nama}`
                : selectedPeriode
                ? `Semua ekspedisi · ${selectedPeriode}`
                : 'Analisis mendalam lintas ekspedisi'}
            </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Filter Ekspedisi */}
            <select
            value={selectedKurir}
            onChange={e => setSelectedKurir(e.target.value)}
            style={{
                background: '#1e2433',
                border: `1px solid ${selectedKurirInfo ? accentColor : '#2d3748'}`,
                borderRadius: 8, padding: '7px 14px',
                color: selectedKurirInfo ? accentColor : '#94a3b8',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                outline: 'none', minWidth: 180,
            }}
            >
            <option value="">🚚 Semua Ekspedisi</option>
            {kurirList.map(k => (
                <option key={k.kode} value={k.kode}>{k.nama} ({k.kode})</option>
            ))}
            </select>

            {/* ✅ Filter Periode */}
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

            {/* ✅ Reset filter */}
            {(selectedKurir || selectedPeriode) && (
            <button
                onClick={() => { setSelectedKurir(''); setSelectedPeriode('') }}
                style={{
                background: '#1e2433', border: '1px solid #2d3748', borderRadius: 8,
                padding: '7px 14px', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
                }}
            >✕ Reset</button>
            )}

            <div style={{ fontSize: 12, color: '#475569', background: '#1e2433', padding: '6px 14px', borderRadius: 8 }}>
            {filtered.length} transaksi
            </div>
        </div>
        </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            background: activeTab === t.key ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#1e2433',
            color: activeTab === t.key ? '#fff' : '#64748b',
            transition: 'all 0.2s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab: Perbandingan Periode ── */}
      {activeTab === 'periode' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>📋 Ringkasan per Periode</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0d111c' }}>
                    {['Periode', 'Total Paket', 'Omzet', 'Net Profit', 'POD Rate'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodeData.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '32px 0', textAlign: 'center', color: '#475569' }}>Belum ada data.</td></tr>
                  ) : periodeData.map(d => (
                    <tr key={d.periode} style={{ borderBottom: '1px solid #1e2433' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f1f5f9' }}>{d.periode}</td>
                      <td style={{ padding: '10px 16px', color: '#3b82f6', fontWeight: 700 }}>{d.paket}</td>
                      <td style={{ padding: '10px 16px', color: '#f97316', fontWeight: 700 }}>{fmt(d.omzet)}</td>
                      <td style={{ padding: '10px 16px', color: '#22c55e', fontWeight: 700 }}>{fmt(d.diskon)}</td>
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
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={periodeData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                  <XAxis dataKey="periode" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmt(v), 'Omzet']} labelStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="omzet" fill={accentColor} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📦 Volume Paket per Periode</div>
              <ResponsiveContainer width="100%" height={200}>
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

      {/* ── Tab: Top Kota ── */}
      {activeTab === 'kota' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📊 Top 10 Kota — Volume Paket</div>
            {kotaData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>Belum ada data.</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
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
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Omzet: {fmt(k.omzet)}</div>
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

      {/* ── Tab: Analisis Berat ── */}
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
                    <span style={{ fontSize: 11, color: '#64748b' }}>Omzet: {fmt(b.omzet)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Heatmap Hari ── */}
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
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{fmt(h.omzet)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📊 Omzet per Hari</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={heatmapData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2433" />
                <XAxis dataKey="hari" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmt(v)} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [fmt(v), 'Omzet']} labelStyle={{ color: '#94a3b8' }} />
                <Bar dataKey="omzet" radius={[4, 4, 0, 0]}>
                  {heatmapData.map((_, i) => (
                    <Cell key={i} fill={i === 0 || i === 6 ? '#f59e0b' : accentColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insight */}
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