'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from 'recharts'
import type { LabaRugi } from '@/types'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

const fmtShort = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return Math.round(n).toString()
}

const TIPE_COLOR: Record<string, string> = {
  MASUK: '#22c55e',
  KELUAR: '#ef4444',
  TRANSFER: '#3b82f6',
}

const SUMBER_LABEL: Record<string, string> = {
  MANUAL: '✍️ Manual',
  INVENTARIS: '📦 Inventaris',
  KURIR: '🚚 Kurir',
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

  // Map history untuk recharts
  const chartData = useMemo(() => {
    const map = new Map(labaRugiHistory.map((r: any) => [r.periode, r]))
    return periodes.map((p) => {
      const r: any = map.get(p) || {}
      return {
        periode: p.slice(5) + '/' + p.slice(2, 4),
        full: p,
        income: Number(r.total_income || 0),
        expense: Number(r.total_expense || 0),
        laba: Number(r.laba_kotor || 0),
      }
    })
  }, [labaRugiHistory, periodes])

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
            Laba: {fmtRp(Number(closingBulanIni.laba))} · Income: {fmtRp(Number(closingBulanIni.total_income))} · Expense: {fmtRp(Number(closingBulanIni.total_expense))}
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
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>📈 Trend 6 Bulan Terakhir</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="#1e2433" strokeDasharray="3 3" />
            <XAxis dataKey="periode" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} tickFormatter={fmtShort} />
            <Tooltip
              contentStyle={{ background: '#0d111c', border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: any) => fmtRp(Number(v))}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="laba" name="Laba" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
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
              <BarChart data={topExpense.map((b: any) => ({ name: b.kategori_kode, value: Number(b.nominal_expense) }))}>
                <CartesianGrid stroke="#1e2433" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={fmtShort} />
                <Tooltip
                  contentStyle={{ background: '#0d111c', border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v: any) => fmtRp(Number(v))}
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
                        {t.tipe === 'MASUK' ? '+' : '−'}{fmtRp(Number(t.nominal))}
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
        {typeof value === 'number' ? fmtRp(value) : value}
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
