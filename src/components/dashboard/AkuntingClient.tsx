'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, ReferenceLine, Brush,
} from 'recharts'
import type { LabaRugi } from '@/types'
import { formatCurrencyShort, formatCurrency, formatCurrencyAccounting } from '@/lib/format/currency'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

const TIPE_COLOR: Record<string, string> = {
  MASUK: '#22c55e',
  KELUAR: '#ef4444',
  TRANSFER: '#3b82f6',
}

const SUMBER_LABEL: Record<string, string> = {
  MANUAL: '✍️ Manual',
  INVENTARIS: '📦 Inventaris',
  KURIR: '🚚 Kurir',
  JNE: '📦 JNE',
  RECURRING: '🔁 Recurring',
  CLOSING: '🔒 Closing',
  PRIVE: '💸 Prive',
}

export default function AkuntingClient({
  outlet, currentPeriode, periodes, labaRugiHistory,
  breakdown, recent, kpi, closingBulanIni,
}: {
  outlet: { id: string; kode: string; nama: string }
  currentPeriode: string
  periodes: string[]
  labaRugiHistory: any[]
  breakdown: any[]
  recent: any[]
  kpi: { totalIncome: number; totalExpense: number; labaKotor: number }
  closingBulanIni: any
}) {
  const router = useRouter()

  // Controls state
  const [rangePreset, setRangePreset] = useState<'6M' | '12M' | 'YTD' | 'ALL' | 'YEAR'>('6M')
  const [selectedYear, setSelectedYear] = useState<string>(() => currentPeriode.slice(0, 4))
  const [aggregation, setAggregation] = useState<'MONTHLY' | 'QUARTERLY'>('MONTHLY')
  const [showSlider, setShowSlider] = useState<boolean>(false)

  // Distinct available years from history
  const availableYears = useMemo(() => {
    const set = new Set<string>()
    labaRugiHistory.forEach((r: any) => {
      if (r.periode && typeof r.periode === 'string') {
        set.add(r.periode.slice(0, 4))
      }
    })
    return Array.from(set).sort().reverse()
  }, [labaRugiHistory])

  // Filtered continuous monthly periods based on active preset / year
  const activePeriods = useMemo(() => {
    const [cy, cm] = currentPeriode.split('-').map(Number)
    const firstPeriode = labaRugiHistory[0]?.periode || '2023-09'

    if (rangePreset === '6M') {
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(cy, cm - 6 + i, 1)
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      })
    }

    if (rangePreset === '12M') {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(cy, cm - 12 + i, 1)
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      })
    }

    if (rangePreset === 'YTD') {
      return Array.from({ length: cm }, (_, i) => {
        return cy + '-' + String(i + 1).padStart(2, '0')
      })
    }

    if (rangePreset === 'YEAR' && selectedYear) {
      return Array.from({ length: 12 }, (_, i) => {
        return selectedYear + '-' + String(i + 1).padStart(2, '0')
      })
    }

    if (rangePreset === 'ALL') {
      const [fy, fm] = firstPeriode.split('-').map(Number)
      const res: string[] = []
      let cur = new Date(fy, fm - 1, 1)
      const end = new Date(cy, cm - 1, 1)
      while (cur <= end) {
        res.push(cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0'))
        cur.setMonth(cur.getMonth() + 1)
      }
      return res
    }

    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(cy, cm - 6 + i, 1)
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    })
  }, [rangePreset, selectedYear, currentPeriode, labaRugiHistory])

  // Map history untuk bulanan
  const monthlyChartData = useMemo(() => {
    const map = new Map(labaRugiHistory.map((r: any) => [r.periode, r]))
    return activePeriods.map((p) => {
      const r: any = map.get(p) || {}
      return {
        periode: p.slice(5) + '/' + p.slice(2, 4),
        full: p,
        income: Number(r.total_income || 0),
        expense: Number(r.total_expense || 0),
        laba: Number(r.laba_kotor || 0),
      }
    })
  }, [labaRugiHistory, activePeriods])

  // Final chart data (Monthly or Quarterly aggregation)
  const chartData = useMemo(() => {
    if (aggregation === 'QUARTERLY') {
      const qMap = new Map<string, { periode: string; full: string; income: number; expense: number; laba: number; count: number }>()
      for (const m of monthlyChartData) {
        const [y, mm] = m.full.split('-')
        const qNum = Math.ceil(Number(mm) / 3)
        const qKey = y + '-Q' + qNum
        const qLabel = 'Q' + qNum + ' \'' + y.slice(2)
        if (!qMap.has(qKey)) {
          qMap.set(qKey, { periode: qLabel, full: qKey, income: 0, expense: 0, laba: 0, count: 0 })
        }
        const item = qMap.get(qKey)!
        item.income += m.income
        item.expense += m.expense
        item.laba += m.laba
        item.count += 1
      }
      return Array.from(qMap.values())
    }
    return monthlyChartData
  }, [monthlyChartData, aggregation])

  // Summary statistics of viewed range
  const summaryStats = useMemo(() => {
    let totalIncome = 0
    let totalExpense = 0
    for (const item of monthlyChartData) {
      totalIncome += item.income
      totalExpense += item.expense
    }
    const netLaba = totalIncome - totalExpense
    const margin = totalIncome > 0 ? (netLaba / totalIncome) * 100 : 0
    return { totalIncome, totalExpense, netLaba, margin }
  }, [monthlyChartData])

  // Dynamic titles & subtitles
  const dynamicTitle = useMemo(() => {
    if (rangePreset === '6M') return 'Trend 6 Bulan Terakhir'
    if (rangePreset === '12M') return 'Trend 12 Bulan Terakhir'
    if (rangePreset === 'YTD') return 'Trend Year-to-Date (' + currentPeriode.slice(0, 4) + ')'
    if (rangePreset === 'YEAR') return 'Trend Tahun ' + selectedYear
    if (rangePreset === 'ALL') {
      const startYear = activePeriods[0]?.slice(0, 4) || '2023'
      const endYear = currentPeriode.slice(0, 4)
      return 'Trend Keseluruhan (' + startYear + ' – ' + endYear + ')'
    }
    return 'Trend Keuangan'
  }, [rangePreset, selectedYear, currentPeriode, activePeriods])

  const dateRangeLabel = useMemo(() => {
    if (activePeriods.length === 0) return ''
    const first = activePeriods[0]
    const last = activePeriods[activePeriods.length - 1]
    return first + ' s/d ' + last + ' (' + activePeriods.length + ' Bulan)'
  }, [activePeriods])

  // Top 5 expense categories bulan ini
  const topExpense = (breakdown || [])
    .filter((b: any) => Number(b.nominal_expense) > 0)
    .slice(0, 5)

  // Top income (harusnya cuma 1 = kurir, tapi kalau ada 4900 berarti ada manual)
  const totalIncomeByCat = (breakdown || [])
    .filter((b: any) => Number(b.nominal_income) > 0)

  const isClosed = !!closingBulanIni?.is_locked

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>💰 Akunting</h1>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            {outlet.nama} ({outlet.kode}) · Periode {currentPeriode}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/dashboard/akunting/expense')}
            style={btnPrimary('#22c55e')}>
            ➕ Input Transaksi
          </button>
          <button onClick={() => router.push('/dashboard/akunting/recurring')}
            style={btnSecondary()}>
            🔁 Recurring
          </button>
          <button onClick={() => router.push('/dashboard/akunting/closing')}
            style={btnSecondary()}>
            🔒 Closing
          </button>
          <button onClick={() => router.push('/dashboard/akunting/laba-rugi')}
            style={btnSecondary()}>
            📊 Laporan
          </button>
        </div>
      </div>

      {/* Status closing alert */}
      {isClosed ? (
        <div style={{
          background: '#3b82f620', border: '1px solid #3b82f6',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <strong style={{ color: '#3b82f6' }}>🔒 Periode {currentPeriode} sudah di-closing.</strong>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Laba: {formatCurrencyAccounting(Number(closingBulanIni.laba))} · Income: {formatCurrencyAccounting(Number(closingBulanIni.total_income))} · Expense: {formatCurrencyAccounting(Number(closingBulanIni.total_expense))}
          </div>
        </div>
      ) : (
        <div style={{
          background: '#f59e0b20', border: '1px solid #f59e0b',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <strong style={{ color: '#f59e0b' }}>⚠️ Periode {currentPeriode} belum di-closing.</strong>
          <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 4 }}>
            Tutup buku akhir bulan via menu <strong>🔒 Closing</strong> di atas untuk kunci periode & simpan laba ditahan.
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard label="Income (bulan ini)" value={kpi.totalIncome} color="#22c55e" icon="⬆️" />
        <KpiCard label="Expense (bulan ini)" value={kpi.totalExpense} color="#ef4444" icon="⬇️" />
        <KpiCard label="Laba Kotor" value={kpi.labaKotor} color={kpi.labaKotor >= 0 ? '#3b82f6' : '#ef4444'} icon="💵" />
        <KpiCard
          label="Margin"
          value={kpi.totalIncome > 0 ? ((kpi.labaKotor / kpi.totalIncome) * 100).toFixed(1) + '%' : '—'}
          color="#f97316" icon="📐"
          isText
        />
      </div>

      {/* Chart: 6 bulan terakhir */}
      {/* Chart: Card Trend Keuangan Kombinasi */}
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 18, marginBottom: 24 }}>
        {/* Header bar: Title + Presets + Filter Tahun + Agregasi + Slider */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#f8fafc' }}>📈 {dynamicTitle}</h2>
              {aggregation === 'QUARTERLY' && (
                <span style={{ fontSize: 10, background: '#818cf825', color: '#a5b4fc', border: '1px solid #818cf850', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                  Mode Kuartalan
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
              {dateRangeLabel} • {chartData.length} data point{chartData.length > 1 ? 's' : ''}
            </div>
          </div>

          {/* Controls toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Range Presets Pills */}
            <div style={{ display: 'flex', background: '#0d111c', border: '1px solid #1e2433', borderRadius: 8, padding: 2, gap: 2 }}>
              <button
                type='button'
                onClick={() => { setRangePreset('6M'); setSelectedYear(''); }}
                style={{
                  background: rangePreset === '6M' ? '#38bdf8' : 'transparent',
                  color: rangePreset === '6M' ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 9px',
                  fontSize: 12,
                  fontWeight: rangePreset === '6M' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                6B
              </button>
              <button
                type='button'
                onClick={() => { setRangePreset('12M'); setSelectedYear(''); }}
                style={{
                  background: rangePreset === '12M' ? '#38bdf8' : 'transparent',
                  color: rangePreset === '12M' ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 9px',
                  fontSize: 12,
                  fontWeight: rangePreset === '12M' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                12B
              </button>
              <button
                type='button'
                onClick={() => { setRangePreset('YTD'); setSelectedYear(''); }}
                style={{
                  background: rangePreset === 'YTD' ? '#38bdf8' : 'transparent',
                  color: rangePreset === 'YTD' ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 9px',
                  fontSize: 12,
                  fontWeight: rangePreset === 'YTD' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                YTD
              </button>
              <button
                type='button'
                onClick={() => {
                  setRangePreset('ALL');
                  setSelectedYear('');
                  if (activePeriods.length > 12) setShowSlider(true);
                }}
                style={{
                  background: rangePreset === 'ALL' ? '#38bdf8' : 'transparent',
                  color: rangePreset === 'ALL' ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 9px',
                  fontSize: 12,
                  fontWeight: rangePreset === 'ALL' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Semua
              </button>
            </div>

            {/* Dropdown Tahun */}
            <select
              value={rangePreset === 'YEAR' ? selectedYear : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setSelectedYear(val);
                  setRangePreset('YEAR');
                } else {
                  setRangePreset('6M');
                }
              }}
              style={{
                background: rangePreset === 'YEAR' ? '#38bdf818' : '#0d111c',
                color: rangePreset === 'YEAR' ? '#38bdf8' : '#94a3b8',
                border: rangePreset === 'YEAR' ? '1px solid #38bdf8' : '1px solid #1e2433',
                borderRadius: 8,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
                fontWeight: rangePreset === 'YEAR' ? 700 : 500,
              }}
            >
              <option value='' disabled={rangePreset === 'YEAR'}>📅 Filter Tahun...</option>
              {availableYears.map((y) => (
                <option key={y} value={y} style={{ background: '#0d111c', color: '#f1f5f9' }}>
                  Tahun {y}
                </option>
              ))}
            </select>

            {/* Aggregation Toggle (Bulan vs Kuartal) */}
            <div style={{ display: 'flex', background: '#0d111c', border: '1px solid #1e2433', borderRadius: 8, padding: 2, gap: 2 }}>
              <button
                type='button'
                onClick={() => setAggregation('MONTHLY')}
                style={{
                  background: aggregation === 'MONTHLY' ? '#818cf825' : 'transparent',
                  color: aggregation === 'MONTHLY' ? '#a5b4fc' : '#64748b',
                  border: aggregation === 'MONTHLY' ? '1px solid #818cf850' : '1px solid transparent',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: aggregation === 'MONTHLY' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title='Tampilkan per Bulan'
              >
                Bulan
              </button>
              <button
                type='button'
                onClick={() => setAggregation('QUARTERLY')}
                style={{
                  background: aggregation === 'QUARTERLY' ? '#818cf825' : 'transparent',
                  color: aggregation === 'QUARTERLY' ? '#a5b4fc' : '#64748b',
                  border: aggregation === 'QUARTERLY' ? '1px solid #818cf850' : '1px solid transparent',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: aggregation === 'QUARTERLY' ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title='Tampilkan per Kuartal (3 Bulan)'
              >
                Kuartal
              </button>
            </div>

            {/* Slider / Brush Toggle */}
            <button
                type='button'
                onClick={() => setShowSlider(!showSlider)}
                style={{
                  background: showSlider ? '#38bdf820' : '#0d111c',
                  color: showSlider ? '#38bdf8' : '#64748b',
                  border: showSlider ? '1px solid #38bdf8' : '1px solid #1e2433',
                  borderRadius: 8,
                  padding: '4px 9px',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: showSlider ? 700 : 500,
                  transition: 'all 0.15s ease',
                }}
                title='Aktifkan mini-slider timeline di bawah chart'
              >
              <span>🔍 Slider</span>
            </button>
          </div>
        </div>

        {/* Mini KPI Summary of Selected Range */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
          padding: '10px 14px',
          background: '#0d111c',
          border: '1px solid #1e2433',
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Total Income ({dynamicTitle.replace('Trend ', '')})</div>
            <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>{formatCurrencyAccounting(summaryStats.totalIncome)}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Total Expense</div>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>{formatCurrencyAccounting(summaryStats.totalExpense)}</div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Net Laba / Rugi</div>
            <div style={{ color: summaryStats.netLaba >= 0 ? '#38bdf8' : '#ef4444', fontWeight: 700, fontSize: 13 }}>
              {formatCurrencyAccounting(summaryStats.netLaba)}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 2 }}>Margin Bersih</div>
            <div style={{ color: summaryStats.netLaba >= 0 ? '#f59e0b' : '#ef4444', fontWeight: 700, fontSize: 13 }}>
              {summaryStats.totalIncome > 0 ? summaryStats.margin.toFixed(1) + '%' : '0.0%'}
            </div>
          </div>
        </div>

        {/* Recharts LineChart */}
        <ResponsiveContainer width='100%' height={showSlider ? 320 : 285}>
          <LineChart data={chartData} margin={{ top: 12, right: 24, left: 16, bottom: 8 }}>
            <CartesianGrid stroke='#1e2433' strokeDasharray='3 3' vertical={false} />
            <XAxis
              dataKey='periode'
              stroke='#64748b'
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#1e2433' }}
              padding={{ left: 24, right: 24 }}
              dy={4}
            />
            <YAxis
              stroke='#64748b'
              fontSize={12}
              width={75}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrencyShort}
            />
            <ReferenceLine y={0} stroke='#334155' strokeDasharray='3 3' />
            <Tooltip
              contentStyle={{ background: '#0d111c', border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: any) => formatCurrencyAccounting(Number(v))}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
            <Line type='monotone' dataKey='income' name='Income' stroke='#22c55e' strokeWidth={2} dot={{ r: 3 }} />
            <Line type='monotone' dataKey='expense' name='Expense' stroke='#ef4444' strokeWidth={2} dot={{ r: 3 }} />
            <Line type='monotone' dataKey='laba' name='Laba' stroke='#3b82f6' strokeWidth={2} dot={{ r: 3 }} />
            {showSlider && (
              <Brush
                dataKey='periode'
                height={26}
                stroke='#38bdf8'
                fill='#0b0f19'
                travellerWidth={8}
                tickFormatter={(v: any) => v}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 2 kolom: Top expense + Recent transactions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top expense bulan ini */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>🔥 Top 5 Expense ({currentPeriode})</h2>
          {topExpense.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: 24, fontSize: 13 }}>
              Belum ada expense bulan ini.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topExpense.map((b: any) => ({ name: b.kategori_kode, value: Number(b.nominal_expense) }))}
                margin={{ top: 8, right: 16, left: 12, bottom: 4 }}
              >
                <CartesianGrid stroke="#1e2433" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e2433' }} />
                <YAxis stroke="#64748b" fontSize={11} width={65} tickLine={false} axisLine={false} tickFormatter={formatCurrencyShort} />
                <Tooltip
                  contentStyle={{ background: '#0d111c', border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v: any) => formatCurrencyAccounting(Number(v))}
                />
                <Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent 10 transaksi */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>📝 10 Transaksi Terakhir</h2>
          {recent.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: 24, fontSize: 13 }}>
              Belum ada transaksi keuangan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map((t: any) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 10, background: '#0d111c', borderRadius: 8, fontSize: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ color: TIPE_COLOR[t.tipe], fontWeight: 700 }}>
                        {t.tipe === 'MASUK' ? '+' : '−'}{formatCurrencyAccounting(Number(t.nominal))}
                      </span>
                      <span style={{ color: '#64748b', fontSize: 11 }}>
                        {SUMBER_LABEL[t.sumber] || t.sumber}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.kategori?.kode} · {t.keterangan || '—'}
                    </div>
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11, marginLeft: 8 }}>
                    {t.tanggal}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick info card */}
      <div style={{ marginTop: 24, padding: 16, background: '#1e243340', borderRadius: 10, fontSize: 12, color: '#94a3b8' }}>
        ℹ️ Income otomatis ter-aggregate dari <code>fn_aggregate_income</code> (dipanggil setelah upload XLSX atau cron harian). Expense otomatis dari trigger saat stok keluar.
        Lihat <a href="/dashboard/akunting/laba-rugi" style={{ color: '#f97316' }}>Laporan Laba-Rugi</a> untuk drill-down per kategori.
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, icon, isText }:
  { label: string; value: number | string; color: string; icon: string; isText?: boolean }) {
  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2433', borderRadius: 12,
      padding: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: isText ? 22 : 16, fontWeight: 800, color }}>
        {typeof value === 'number' ? formatCurrencyAccounting(value) : value}
      </div>
    </div>
  )
}

function btnPrimary(color: string): React.CSSProperties {
  return {
    background: color, border: 'none', color: '#fff',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
  }
}
function btnSecondary(): React.CSSProperties {
  return {
    background: '#1e2433', border: '1px solid #2d3748', color: '#94a3b8',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  }
}
