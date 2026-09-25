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
  jneList = [],
  kurirList = [],
  initialTab = 'overview',
}: {
  summary: any[]
  recentTx: any[]
  grandTotal: any[]
  jneList?: any[]
  kurirList?: any[]
  initialTab?: string
}) {
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'overview')
  const [selectedKurir, setSelectedKurir] = useState<string>('')
  const [filterMode, setFilterMode] = useState<'bulan' | 'tahun'>('bulan')
  const [selectedPeriode, setSelectedPeriode] = useState('')
  const [selectedTahun, setSelectedTahun] = useState('')
  const [overviewTableTab, setOverviewTableTab] = useState<'semua' | 'lion' | 'jne'>('semua')

  const isJneMode = selectedKurir === 'JNE'
  const isLionMode = selectedKurir === 'LION'
  const isAllKurir = !selectedKurir

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
    jneList.forEach(d => {
      if (d.kurir?.kode && !map[d.kurir.kode]) {
        map[d.kurir.kode] = { kode: d.kurir.kode, nama: d.kurir.nama, warna: d.kurir.warna || '#ef4444' }
      }
    })
    return Object.values(map)
  }, [grandTotal, jneList, kurirList])

  const selectedKurirInfo = kurirOptions.find(k => k.kode === selectedKurir)
  const accentColor = selectedKurirInfo?.warna || '#f97316'

  // Daftar tahun unik dari data transaksi & JNE
  const tahunOptions = useMemo(() => {
    const set = new Set<string>()
    grandTotal.forEach(d => {
      const yr = toDateStr(d.tanggal).slice(0, 4)
      if (yr && /^\d{4}$/.test(yr)) set.add(yr)
    })
    jneList.forEach(d => {
      const yr = toDateStr(d.tanggal).slice(0, 4)
      if (yr && /^\d{4}$/.test(yr)) set.add(yr)
    })
    summary.forEach(s => {
      const yr = String(s.periode || '').slice(0, 4)
      if (yr && /^\d{4}$/.test(yr)) set.add(yr)
    })
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [grandTotal, jneList, summary])

  // Filter JNE Packing List berdasarkan kurir & periode / tahun
  const filteredJne = useMemo(() => {
    if (selectedKurir && selectedKurir !== 'JNE') return []
    let data = jneList
    if (filterMode === 'bulan' && selectedPeriode) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 7) === selectedPeriode)
    } else if (filterMode === 'tahun' && selectedTahun) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 4) === selectedTahun)
    }
    return data
  }, [jneList, selectedKurir, filterMode, selectedPeriode, selectedTahun])

  // Filter grandTotal (Lion Parcel / resi STT) berdasarkan kurir & periode / tahun
  const filteredGrandTotal = useMemo(() => {
    if (selectedKurir && selectedKurir === 'JNE') return []
    let data = selectedKurir ? grandTotal.filter(d => d.kurir?.kode === selectedKurir) : grandTotal
    if (filterMode === 'bulan' && selectedPeriode) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 7) === selectedPeriode)
    } else if (filterMode === 'tahun' && selectedTahun) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 4) === selectedTahun)
    }
    return data
  }, [grandTotal, selectedKurir, filterMode, selectedPeriode, selectedTahun])

  const filteredRecentTx = useMemo(() => {
    if (selectedKurir && selectedKurir === 'JNE') return []
    let data = selectedKurir ? recentTx.filter(d => d.kurir?.kode === selectedKurir) : recentTx
    if (filterMode === 'bulan' && selectedPeriode) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 7) === selectedPeriode)
    } else if (filterMode === 'tahun' && selectedTahun) {
      data = data.filter(d => toDateStr(d.tanggal).slice(0, 4) === selectedTahun)
    }
    return data
  }, [recentTx, selectedKurir, filterMode, selectedPeriode, selectedTahun])

  // Gabungan transaksi & dokumen terkini (Lion STT + JNE Packing List)
  const recentCombined = useMemo(() => {
    const list: Array<{
      id: string
      kurir_kode: 'LION' | 'JNE'
      kurir_nama: string
      kurir_warna: string
      nomor_dokumen: string
      tanggal: string
      detail: string
      koli: number
      berat: number
      status: string
      is_lunas?: boolean
      total_biaya: number
      diskon: number
    }> = []

    filteredRecentTx.slice(0, 50).forEach((t: any) => {
      list.push({
        id: `lion-${t.id || t.nomor_stt || Math.random()}`,
        kurir_kode: 'LION',
        kurir_nama: 'Lion Parcel',
        kurir_warna: '#f97316',
        nomor_dokumen: t.nomor_stt || t.no_resi || '—',
        tanggal: toDateStr(t.tanggal),
        detail: [t.nama_produk, t.kota_tujuan].filter(Boolean).join(' · ') || '—',
        koli: num(t.koli) || 1,
        berat: num(t.berat_kena_biaya) || 0,
        status: t.status || '—',
        total_biaya: num(t.total_biaya),
        diskon: num(t.diskon_booking),
      })
    })

    filteredJne.slice(0, 50).forEach((j: any) => {
      const isLunas = num(j.outstanding) <= 0
      list.push({
        id: `jne-${j.id || j.nomor_pl || Math.random()}`,
        kurir_kode: 'JNE',
        kurir_nama: 'JNE Express',
        kurir_warna: '#ef4444',
        nomor_dokumen: j.nomor_pl || '—',
        tanggal: toDateStr(j.tanggal),
        detail: `${j.cnote_count || 1} conote`,
        koli: num(j.koli) || 1,
        berat: num(j.berat_kena_biaya) || 0,
        status: isLunas ? 'LUNAS' : `OUTSTANDING (${formatCurrencyShort(num(j.outstanding))})`,
        is_lunas: isLunas,
        total_biaya: num(j.total_biaya),
        diskon: num(j.diskon_booking) + num(j.disc_others),
      })
    })

    return list.sort((a, b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 25)
  }, [filteredRecentTx, filteredJne])

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

    // Perhitungan Lion Parcel
    const lionOmzet = filteredGrandTotal.reduce((s, d) => s + num(d.total_biaya), 0)
    const lionDiskon = filteredGrandTotal.reduce((s, d) => s + num(d.diskon_booking), 0)
    const lionKoli = filteredGrandTotal.reduce((s, d) => s + num(d.koli), 0)
    const lionWeight = filteredGrandTotal.reduce((s, d) => s + num(d.berat_kena_biaya), 0)
    const podCount = filteredGrandTotal.filter(d => d.status === 'POD').length
    const podRate = filteredGrandTotal.length > 0 ? ((podCount / filteredGrandTotal.length) * 100).toFixed(1) : '0'
    const lionNetProfit = nonCNX.reduce((s, d) =>
      s + num(d.diskon_booking) + num(d.diskon_asuransi) + num(d.diskon_forward_rate), 0) - totalPenalty

    // Perhitungan JNE Express (dari Packing List Rekapitulasi)
    const jneOmzet = filteredJne.reduce((s, d) => s + num(d.total_biaya), 0)
    const jneDiskon = filteredJne.reduce((s, d) => s + num(d.diskon_booking) + num(d.disc_others), 0)
    const jneNetProfit = jneDiskon
    const jneTotalNet = filteredJne.reduce((s, d) => s + num(d.net_profit), 0)
    const jneTotalCnote = filteredJne.reduce((s, d) => s + num(d.cnote_count), 0)
    const jneTotalKoli = filteredJne.reduce((s, d) => s + num(d.koli), 0)
    const jneTotalWeight = filteredJne.reduce((s, d) => s + num(d.berat_kena_biaya), 0)
    const jneTotalPL = filteredJne.length
    const jneLunasCount = filteredJne.filter(d => num(d.outstanding) <= 0).length
    const jneBelumLunasCount = filteredJne.filter(d => num(d.outstanding) > 0).length
    const jneTotalOutstanding = filteredJne.reduce((s, d) => s + num(d.outstanding), 0)

    // Agregasi Gabungan (Semua Kurir)
    const totalOmzet = lionOmzet + jneOmzet
    const totalDiskon = lionDiskon + jneDiskon
    const totalKoli = lionKoli + jneTotalKoli
    const totalPaket = filteredGrandTotal.length + jneTotalCnote
    const netProfit = lionNetProfit + jneNetProfit
    const totalWeight = lionWeight + jneTotalWeight
    const profitMargin = totalOmzet > 0 ? ((netProfit / totalOmzet) * 100).toFixed(1) : '0'
    const avgOmzetPerPaket = totalPaket > 0 ? Math.round(totalOmzet / totalPaket) : 0
    const avgDiskonPerPaket = totalPaket > 0 ? Math.round(totalDiskon / totalPaket) : 0
    const avgWeightPerPaket = totalPaket > 0 ? (totalWeight / totalPaket).toFixed(1) : '0'
    const avgKoliPerPaket = totalPaket > 0 ? (totalKoli / totalPaket).toFixed(1) : '0'

    // Tren Harian (gabungan Lion STT dan JNE PL)
    const byDate: Record<string, { count: number; omzet: number }> = {}
    filteredRecentTx.forEach(d => {
      const dt = toDateStr(d.tanggal).slice(0, 10) || ''
      if (!dt) return
      if (!byDate[dt]) byDate[dt] = { count: 0, omzet: 0 }
      byDate[dt].count++
      byDate[dt].omzet += num(d.total_biaya)
    })
    filteredJne.forEach(d => {
      const dt = toDateStr(d.tanggal).slice(0, 10) || ''
      if (!dt) return
      if (!byDate[dt]) byDate[dt] = { count: 0, omzet: 0 }
      byDate[dt].count += num(d.cnote_count) || 1
      byDate[dt].omzet += num(d.total_biaya)
    })
    const dailyTrend = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({ date: date.slice(5), count: d.count, omzet: d.omzet }))

    let kurirSummaryList: any[] = []
    if (selectedKurir === 'JNE') {
      kurirSummaryList = [{
        nama: 'JNE Express',
        warna: '#ef4444',
        paket: jneTotalCnote,
        omzet: jneOmzet,
        diskon: jneDiskon,
        penalty: 0,
        plCount: jneTotalPL,
        totalNet: jneTotalNet,
      }]
    } else if (selectedKurir === 'LION') {
      kurirSummaryList = [{
        nama: 'Lion Parcel',
        warna: '#f97316',
        paket: filteredGrandTotal.length,
        omzet: lionOmzet,
        diskon: lionDiskon,
        penalty: totalPenalty,
      }]
    } else {
      kurirSummaryList = [
        {
          nama: 'Lion Parcel',
          warna: '#f97316',
          paket: filteredGrandTotal.length,
          omzet: lionOmzet,
          diskon: lionDiskon,
          penalty: totalPenalty,
        },
        {
          nama: 'JNE Express',
          warna: '#ef4444',
          paket: jneTotalCnote,
          omzet: jneOmzet,
          diskon: jneDiskon,
          penalty: 0,
          plCount: jneTotalPL,
          totalNet: jneTotalNet,
        },
      ].filter(k => k.paket > 0 || k.omzet > 0)
    }

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

    return {
      totalOmzet, totalDiskon, totalKoli, totalPaket, netProfit,
      lionOmzet, lionDiskon, lionKoli, lionWeight, lionNetProfit, podRate, podCount, totalPenalty, penaltyCount,
      jneOmzet, jneDiskon, jneNetProfit, jneTotalNet, jneTotalCnote, jneTotalKoli, jneTotalWeight,
      jneTotalPL, jneLunasCount, jneBelumLunasCount, jneTotalOutstanding,
      totalWeight, profitMargin, avgOmzetPerPaket, avgDiskonPerPaket, avgWeightPerPaket, avgKoliPerPaket,
      dailyTrend, kurirSummary: kurirSummaryList, produkTerpopuler, top3Kota
    }
  }, [filteredGrandTotal, filteredJne, filteredRecentTx, filteredSummary, nonCNX, selectedKurir])

  const maxKurirOmzet = Math.max(...stats.kurirSummary.map((k: any) => k.omzet), 1)

  // ── Tab 4: Komparasi Periode (Analitik) ──
  const periodeData = useMemo(() => {
    const map: Record<string, {
      periode: string; omzet: number; paket: number; pod: number; total: number;
      diskon: number; lionOmzet: number; jneOmzet: number; jnePL: number; jneNet: number; jneOutstanding: number;
    }> = {}

    filteredGrandTotal.forEach(t => {
      const p = String(t.tanggal || '').slice(0, 7)
      if (!p) return
      if (!map[p]) map[p] = { periode: p, omzet: 0, paket: 0, pod: 0, total: 0, diskon: 0, lionOmzet: 0, jneOmzet: 0, jnePL: 0, jneNet: 0, jneOutstanding: 0 }
      map[p].omzet += num(t.total_biaya)
      map[p].paket++
      map[p].total++
      map[p].diskon += num(t.diskon_booking) + num(t.diskon_asuransi) + num(t.diskon_forward_rate)
      if (t.status === 'POD') map[p].pod++
      if (t.kurir?.kode === 'LION') {
        map[p].lionOmzet += num(t.total_biaya)
      }
    })

    filteredJne.forEach(j => {
      const p = String(j.tanggal || '').slice(0, 7)
      if (!p) return
      if (!map[p]) map[p] = { periode: p, omzet: 0, paket: 0, pod: 0, total: 0, diskon: 0, lionOmzet: 0, jneOmzet: 0, jnePL: 0, jneNet: 0, jneOutstanding: 0 }
      map[p].omzet += num(j.total_biaya)
      map[p].paket += num(j.cnote_count) || 1
      map[p].diskon += num(j.diskon_booking) + num(j.disc_others)
      map[p].jneOmzet += num(j.total_biaya)
      map[p].jnePL++
      map[p].jneNet += num(j.net_profit)
      map[p].jneOutstanding += num(j.outstanding)
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
  }, [filteredGrandTotal, filteredJne])

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
  const beratData = useMemo(() => {
    const allRows: { weight: number; omzet: number }[] = [
      ...nonCNX.map(t => ({ weight: num(t.berat_kena_biaya), omzet: num(t.total_biaya) })),
      ...filteredJne.map(j => ({ weight: num(j.berat_kena_biaya), omzet: num(j.total_biaya) })),
    ]
    const total = allRows.length || 1
    return BERAT_BUCKET.map(b => {
      const rows = allRows.filter(t => {
        const berat = t.weight
        return berat >= b.min && (b.max === Infinity ? true : berat < b.max)
      })
      return {
        label: b.label,
        jumlah: rows.length,
        omzet: rows.reduce((s, t) => s + t.omzet, 0),
        pct: allRows.length > 0 ? +((rows.length / allRows.length) * 100).toFixed(1) : 0,
      }
    })
  }, [nonCNX, filteredJne])

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
    filteredJne.forEach(j => {
      const d = new Date(j.tanggal)
      const day = isNaN(d.getDay()) ? 0 : d.getDay()
      map[day].jumlah += num(j.cnote_count) || 1
      map[day].omzet += num(j.total_biaya)
    })
    return Object.values(map)
  }, [nonCNX, filteredJne])

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
            {isJneMode
              ? `${stats.jneTotalPL} packing list (${stats.jneTotalCnote} conote)`
              : isLionMode
              ? `${filteredGrandTotal.length} resi (${stats.lionKoli} koli)`
              : `${stats.totalPaket.toLocaleString('id-ID')} kiriman (${filteredGrandTotal.length} resi Lion, ${stats.jneTotalCnote} conote JNE)`}
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
            {isJneMode
              ? `— Menyaring ${stats.jneTotalPL} packing list (${stats.jneTotalCnote} conote, ${stats.jneTotalKoli} koli, ${stats.jneTotalWeight.toLocaleString('id-ID')} kg)`
              : isLionMode
              ? `— Menyaring ${filteredGrandTotal.length} transaksi (${nonCNX.length} aktif, excl. CNX)`
              : `— Menyaring ${stats.totalPaket.toLocaleString('id-ID')} total kiriman (${filteredGrandTotal.length} resi Lion, ${stats.jneTotalCnote} conote JNE)`}
          </span>
        </div>
      )}

      {/* KPI Cards — Kondisional: Semua Ekspedisi (General) vs JNE Express vs Lion Parcel */}
      {isAllKurir ? (
        <>
          {/* KPI Baris 1: Metrik Universal Lintas Ekspedisi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            <KpiCard
              label="Total Omzet (Gross)"
              value={formatCurrencyShort(stats.totalOmzet)}
              sub={`Lion: ${formatCurrencyShort(stats.lionOmzet)} · JNE: ${formatCurrencyShort(stats.jneOmzet)}`}
              icon="💰"
              color="#f97316"
            />
            <KpiCard
              label="Total Kiriman"
              value={`${stats.totalPaket.toLocaleString('id-ID')} kiriman`}
              sub={`Lion: ${filteredGrandTotal.length.toLocaleString('id-ID')} resi · JNE: ${stats.jneTotalCnote.toLocaleString('id-ID')} conote`}
              icon="📦"
              color="#3b82f6"
            />
            <KpiCard
              label="Total Koli"
              value={`${stats.totalKoli.toLocaleString('id-ID')} koli`}
              sub={`Lion: ${stats.lionKoli.toLocaleString('id-ID')} · JNE: ${stats.jneTotalKoli.toLocaleString('id-ID')} koli`}
              icon="🧰"
              color="#06b6d4"
            />
            <KpiCard
              label="Total Komisi / Diskon"
              value={formatCurrencyShort(stats.totalDiskon)}
              sub={`Lion: ${formatCurrencyShort(stats.lionDiskon)} · JNE: ${formatCurrencyShort(stats.jneDiskon)}`}
              icon="🏷️"
              color="#a855f7"
            />
          </div>

          {/* KPI Baris 2: Keuangan & Operasional Lintas Ekspedisi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KpiCard
              label="Net Profit Bersih"
              value={formatCurrencyShort(stats.netProfit)}
              sub={`Lion: ${formatCurrencyShort(stats.lionNetProfit)} · JNE: ${formatCurrencyShort(stats.jneNetProfit)}`}
              icon="💹"
              color={stats.netProfit >= 0 ? "#22c55e" : "#ef4444"}
            />
            <KpiCard
              label="Margin Profit Bersih"
              value={`${stats.profitMargin}%`}
              sub="Rasio laba bersih terhadap omzet bruto gabungan"
              icon="📊"
              color="#10b981"
            />
            <KpiCard
              label="Total Tonase (Berat)"
              value={`${stats.totalWeight.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg`}
              sub={`Rata-rata ${stats.avgWeightPerPaket} kg/kiriman lintas ekspedisi`}
              icon="⚖️"
              color="#f59e0b"
            />
            <KpiCard
              label="Rata-rata Nilai Kiriman"
              value={formatCurrencyShort(stats.avgOmzetPerPaket)}
              sub={`Rata komisi: ${formatCurrencyShort(stats.avgDiskonPerPaket)}/kiriman`}
              icon="🎯"
              color="#6366f1"
            />
          </div>
        </>
      ) : isJneMode ? (
        <>
          {/* KPI Baris 1: Khusus JNE Express */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            <KpiCard
              label="Total Omzet (Gross)"
              value={formatCurrencyShort(stats.jneOmzet)}
              sub={`Diskon & Insentif: ${formatCurrencyShort(stats.jneDiskon)}`}
              icon="💰"
              color="#ef4444"
            />
            <KpiCard
              label="Total Conote & Koli"
              value={`${stats.jneTotalCnote.toLocaleString('id-ID')} conote`}
              sub={`${stats.jneTotalPL} Packing List · ${stats.jneTotalKoli} koli`}
              icon="📦"
              color="#3b82f6"
            />
            <KpiCard
              label="Status Pelunasan PL"
              value={`${stats.jneTotalPL > 0 ? ((stats.jneLunasCount / stats.jneTotalPL) * 100).toFixed(1) : 0}% Lunas`}
              sub={`${stats.jneLunasCount} dari ${stats.jneTotalPL} PL lunas`}
              icon="🧾"
              color="#22c55e"
            />
            <KpiCard
              label="Komisi Agen (Diskon)"
              value={formatCurrencyShort(stats.jneDiskon)}
              sub={`Rata ${formatCurrencyShort(stats.jneTotalCnote > 0 ? Math.round(stats.jneDiskon / stats.jneTotalCnote) : 0)}/conote`}
              icon="🏷️"
              color="#a855f7"
            />
          </div>

          {/* KPI Baris 2: Khusus JNE Express */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KpiCard
              label="Net Profit Agen"
              value={formatCurrencyShort(stats.jneNetProfit)}
              sub="Komisi agen JNE dari potongan diskon & insentif"
              icon="💹"
              color="#22c55e"
            />
            <KpiCard
              label="Total Tagihan Net"
              value={formatCurrencyShort(stats.jneTotalNet)}
              sub="Kewajiban bayar ke JNE Pusat (setelah diskon)"
              icon="💳"
              color="#3b82f6"
            />
            <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#f59e0b', borderRadius: '14px 0 0 14px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Berat & Koli</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stats.jneTotalWeight.toLocaleString('id-ID')} kg
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    {stats.jneTotalKoli} koli · Rata {stats.jneTotalCnote > 0 ? (stats.jneTotalWeight / stats.jneTotalCnote).toFixed(1) : '0'} kg/conote
                  </div>
                </div>
                <div style={{ fontSize: 26 }}>⚖️</div>
              </div>
            </div>
            <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: stats.jneTotalOutstanding > 0 ? '#ef4444' : '#22c55e', borderRadius: '14px 0 0 14px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status Tagihan Outstanding</div>
                <div style={{ fontSize: 20 }}>{stats.jneTotalOutstanding > 0 ? '⚠️' : '✅'}</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: stats.jneTotalOutstanding > 0 ? '#ef4444' : '#22c55e' }}>
                  {formatCurrencyShort(stats.jneTotalOutstanding)}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  {stats.jneBelumLunasCount > 0 ? `${stats.jneBelumLunasCount} PL belum lunas` : 'Semua PL telah lunas'}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* KPI Baris 1: Khusus Lion Parcel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            <KpiCard
              label="Total Omzet Lion Parcel"
              value={formatCurrencyShort(stats.lionOmzet)}
              sub={`Diskon Booking: ${formatCurrencyShort(stats.lionDiskon)}`}
              icon="💰"
              color="#f97316"
            />
            <KpiCard
              label="Total Resi (STT)"
              value={`${filteredGrandTotal.length.toLocaleString('id-ID')} resi`}
              sub={`${stats.lionKoli} koli · ${stats.lionWeight.toLocaleString('id-ID')} kg`}
              icon="📦"
              color="#3b82f6"
            />
            <KpiCard
              label="POD Rate"
              value={`${stats.podRate}%`}
              sub={`${stats.podCount} dari ${filteredGrandTotal.length} berhasil terkirim`}
              icon="✅"
              color="#22c55e"
            />
            <KpiCard
              label="Total Diskon Booking"
              value={formatCurrencyShort(stats.lionDiskon)}
              sub={`Rata ${formatCurrencyShort(filteredGrandTotal.length > 0 ? Math.round(stats.lionDiskon / filteredGrandTotal.length) : 0)}/resi`}
              icon="🏷️"
              color="#a855f7"
            />
          </div>

          {/* KPI Baris 2: Khusus Lion Parcel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <KpiCard
              label="Net Profit Franchise"
              value={formatCurrencyShort(stats.lionNetProfit)}
              sub={stats.totalPenalty > 0
                ? `Komisi Franchise − Penalty ${formatCurrencyShort(stats.totalPenalty)}`
                : "Komisi Franchise (Booking + Asuransi + Fwd Rate, excl. CNX)"}
              icon="💹"
              color={stats.totalPenalty > 0 ? "#ef4444" : "#22c55e"}
            />
            <KpiCard
              label="Total Penalty"
              value={formatCurrencyShort(stats.totalPenalty)}
              sub={stats.penaltyCount > 0
                ? `${stats.penaltyCount} bulan × Rp 500rb — Lion Parcel omzet < 3jt (aktif s/d Apr 2024)`
                : "Tidak ada penalty aktif (semua bulan ≥ 3jt)"}
              icon="⚠️"
              color={stats.totalPenalty > 0 ? "#ef4444" : "#22c55e"}
            />
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
        </>
      )}

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
          {/* Distribusi per Kurir */}
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
                  <span style={{ fontSize: 13, color: k.warna || '#94a3b8', fontWeight: 700 }}>
                    {num(k.paket).toLocaleString('id-ID')} {k.nama.includes('JNE') ? 'conote' : 'paket'} · {formatCurrencyShort(k.omzet)}
                  </span>
                </div>
                <MiniBar value={k.omzet} max={maxKurirOmzet} color={k.warna || '#64748b'} />
              </div>
            ))}
          </div>

          {/* Status Pengiriman / Pelunasan */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>
              {isAllKurir
                ? '🌐 Status Operasional Ekspedisi'
                : isJneMode
                ? '🧾 Status Pembayaran Packing List JNE'
                : '📊 Status Pengiriman Lion Parcel'}
            </div>

            {isAllKurir ? (
              <div>
                {/* Section Lion Parcel */}
                <div style={{ background: '#0d111c', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '1px solid #f9731630' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#f97316' }}>Lion Parcel</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>({filteredGrandTotal.length.toLocaleString('id-ID')} resi)</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
                      POD Rate: {stats.podRate}%
                    </span>
                  </div>
                  <MiniBar value={stats.podCount} max={filteredGrandTotal.length || 1} color="#f97316" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: '#94a3b8', flexWrap: 'wrap', gap: 6 }}>
                    <span>✅ POD: <strong style={{ color: '#22c55e' }}>{stats.podCount}</strong> ({stats.podRate}%)</span>
                    <span>❌ CNX: <strong style={{ color: '#ef4444' }}>{filteredGrandTotal.filter(d => d.status === 'CNX').length}</strong></span>
                    <span>⚠️ Penalty: <strong style={{ color: stats.totalPenalty > 0 ? '#ef4444' : '#22c55e' }}>{stats.totalPenalty > 0 ? formatCurrencyShort(stats.totalPenalty) : 'Rp 0'}</strong></span>
                  </div>
                </div>

                {/* Section JNE Express */}
                <div style={{ background: '#0d111c', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '1px solid #ef444430' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>JNE Express</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>({stats.jneTotalCnote.toLocaleString('id-ID')} conote · {stats.jneTotalPL} PL)</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
                      Pelunasan: {stats.jneTotalPL > 0 ? ((stats.jneLunasCount / stats.jneTotalPL) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <MiniBar value={stats.jneLunasCount} max={stats.jneTotalPL || 1} color="#ef4444" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 11, color: '#94a3b8', flexWrap: 'wrap', gap: 6 }}>
                    <span>🧾 Lunas: <strong style={{ color: '#22c55e' }}>{stats.jneLunasCount}</strong> PL</span>
                    <span>⏳ Belum Lunas: <strong style={{ color: stats.jneBelumLunasCount > 0 ? '#ef4444' : '#22c55e' }}>{stats.jneBelumLunasCount}</strong> PL</span>
                    <span>💳 Sisa: <strong style={{ color: stats.jneTotalOutstanding > 0 ? '#ef4444' : '#22c55e' }}>{stats.jneTotalOutstanding > 0 ? formatCurrencyShort(stats.jneTotalOutstanding) : 'Lunas'}</strong></span>
                  </div>
                </div>

                {/* Summary Lintas Ekspedisi */}
                <div style={{ padding: '10px 14px', background: '#0d111c', borderRadius: 8, border: '1px solid #1e2433', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                  <span>📦 Total: <strong style={{ color: '#f1f5f9' }}>{stats.totalPaket.toLocaleString('id-ID')}</strong> kiriman ({stats.totalKoli} koli)</span>
                  <span>⚖️ Tonase: <strong style={{ color: '#f59e0b' }}>{stats.totalWeight.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kg</strong></span>
                </div>
              </div>
            ) : isJneMode ? (
              <div>
                {/* Lunas */}
                <div style={{ background: '#0d111c', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '1px solid #22c55e30' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>LUNAS</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {stats.jneLunasCount} PL ({stats.jneTotalPL > 0 ? ((stats.jneLunasCount / stats.jneTotalPL) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <MiniBar value={stats.jneLunasCount} max={stats.jneTotalPL || 1} color="#22c55e" />
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    Terbayar: {formatCurrencyShort(stats.jneTotalNet - stats.jneTotalOutstanding)}
                  </div>
                </div>

                {/* Belum Lunas */}
                <div style={{ background: '#0d111c', borderRadius: 10, padding: '14px 16px', marginBottom: 12, border: '1px solid #ef444430' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>BELUM LUNAS (OUTSTANDING)</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {stats.jneBelumLunasCount} PL ({stats.jneTotalPL > 0 ? ((stats.jneBelumLunasCount / stats.jneTotalPL) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <MiniBar value={stats.jneBelumLunasCount} max={stats.jneTotalPL || 1} color="#ef4444" />
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    Sisa Tagihan: {formatCurrencyShort(stats.jneTotalOutstanding)}
                  </div>
                </div>
              </div>
            ) : (
              <div>
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
                      <MiniBar value={count} max={filteredGrandTotal.length || 1} color={STATUS_COLOR[status]} />
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Omzet: {formatCurrencyShort(omzet)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Transaksi / Packing List Terkini */}
          <div className="card" style={{ padding: 20, gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                {isJneMode
                  ? '📋 Rekapitulasi Packing List JNE Terkini'
                  : isLionMode
                  ? '🦁 Resi Lion Parcel Terkini'
                  : '🕐 Transaksi & Dokumen Terbaru'}
              </div>
              {!selectedKurir && (filteredJne.length > 0 || filteredRecentTx.length > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setOverviewTableTab('semua')}
                    style={{
                      background: overviewTableTab === 'semua' ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : '#1e2433',
                      color: overviewTableTab === 'semua' ? '#fff' : '#94a3b8',
                      border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🌐 Semua ({recentCombined.length})
                  </button>
                  <button
                    onClick={() => setOverviewTableTab('lion')}
                    style={{
                      background: overviewTableTab === 'lion' ? '#f97316' : '#1e2433',
                      color: overviewTableTab === 'lion' ? '#fff' : '#94a3b8',
                      border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🦁 Resi Lion ({filteredRecentTx.length})
                  </button>
                  <button
                    onClick={() => setOverviewTableTab('jne')}
                    style={{
                      background: overviewTableTab === 'jne' ? '#ef4444' : '#1e2433',
                      color: overviewTableTab === 'jne' ? '#fff' : '#94a3b8',
                      border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📋 Packing List JNE ({filteredJne.length})
                  </button>
                </div>
              )}
            </div>

            {/* Render Table: JNE PL vs Lion STT vs Combined */}
            {(isJneMode || (!selectedKurir && overviewTableTab === 'jne')) ? (
              /* TABEL PACKING LIST JNE */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0d111c' }}>
                      {['No. Packing List (PL JNE)', 'Tanggal', 'Conote', 'Koli', 'Berat', 'Total Tagihan (Gross)', 'Diskon Agen', 'Net Bayar', 'Status Pelunasan'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJne.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: '32px 0', textAlign: 'center', color: '#475569' }}>Belum ada data Packing List JNE.</td></tr>
                    ) : filteredJne.slice(0, 15).map((j: any) => {
                      const isLunas = num(j.outstanding) <= 0
                      return (
                        <tr key={j.id || j.nomor_pl} style={{ borderBottom: '1px solid #1e2433' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                background: '#ef444420', color: '#ef4444', border: '1px solid #ef444450',
                                padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800,
                              }}>PL JNE</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{j.nomor_pl}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{toDateStr(j.tanggal)}</td>
                          <td style={{ padding: '10px 16px', color: '#3b82f6', fontWeight: 700 }}>{j.cnote_count} conote</td>
                          <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{j.koli} koli</td>
                          <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{num(j.berat_kena_biaya).toLocaleString('id-ID')} kg</td>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f1f5f9' }}>{formatCurrencyShort(num(j.total_biaya))}</td>
                          <td style={{ padding: '10px 16px', color: '#a855f7', fontWeight: 700 }}>{formatCurrencyShort(num(j.diskon_booking) + num(j.disc_others))}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: '#22c55e' }}>{formatCurrencyShort(num(j.net_profit))}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{
                              background: isLunas ? '#22c55e20' : '#ef444420',
                              color: isLunas ? '#22c55e' : '#ef4444',
                              border: `1px solid ${isLunas ? '#22c55e50' : '#ef444450'}`,
                              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                            }}>
                              {isLunas ? '✓ LUNAS' : `⚠️ OUTSTANDING (${formatCurrencyShort(num(j.outstanding))})`}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (isLionMode || (!selectedKurir && overviewTableTab === 'lion')) ? (
              /* TABEL RESI LION PARCEL */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0d111c' }}>
                      {['No. Resi (STT Lion)', 'Tanggal', 'Produk', 'Kota Tujuan', 'Koli & Berat', 'Status', 'Total Biaya', 'Diskon Booking'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecentTx.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '32px 0', textAlign: 'center', color: '#475569' }}>Belum ada data resi Lion Parcel.</td></tr>
                    ) : filteredRecentTx.slice(0, 15).map((t: any) => (
                      <tr key={t.id || t.nomor_stt || t.no_resi} style={{ borderBottom: '1px solid #1e2433' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              background: '#f9731620', color: '#f97316', border: '1px solid #f9731650',
                              padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800,
                            }}>STT LION</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{t.nomor_stt || t.no_resi || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{toDateStr(t.tanggal)}</td>
                        <td style={{ padding: '10px 16px', color: '#f97316', fontWeight: 600 }}>{t.nama_produk || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#64748b', fontSize: 12 }}>{t.kota_tujuan || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{t.koli || 1} koli · {num(t.berat_kena_biaya).toLocaleString('id-ID')} kg</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ color: STATUS_COLOR[t.status] || '#64748b', fontWeight: 700, fontSize: 12 }}>{t.status}</span>
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f1f5f9' }}>{formatCurrencyShort(num(t.total_biaya))}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#a855f7' }}>{formatCurrencyShort(num(t.diskon_booking))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* TABEL GABUNGAN SEMUA EKSPEDISI */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#0d111c' }}>
                      {['No. Resi / Dokumen', 'Tanggal', 'Ekspedisi', 'Detail / Rincian', 'Koli & Berat', 'Status', 'Total Biaya', 'Komisi Agen'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentCombined.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '32px 0', textAlign: 'center', color: '#475569' }}>Belum ada data transaksi atau dokumen.</td></tr>
                    ) : recentCombined.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #1e2433' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              background: r.kurir_kode === 'LION' ? '#f9731620' : '#ef444420',
                              color: r.kurir_kode === 'LION' ? '#f97316' : '#ef4444',
                              border: `1px solid ${r.kurir_kode === 'LION' ? '#f9731640' : '#ef444440'}`,
                              padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap'
                            }}>
                              {r.kurir_kode === 'LION' ? 'STT LION' : 'PL JNE'}
                            </span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f1f5f9' }}>{r.nomor_dokumen}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{r.tanggal}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{
                            background: `${r.kurir_warna}20`, color: r.kurir_warna,
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700
                          }}>
                            {r.kurir_nama}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>{r.detail}</td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{r.koli} koli · {r.berat.toLocaleString('id-ID')} kg</td>
                        <td style={{ padding: '10px 16px' }}>
                          {r.kurir_kode === 'LION' ? (
                            <span style={{ color: STATUS_COLOR[r.status] || '#64748b', fontWeight: 700, fontSize: 12 }}>{r.status}</span>
                          ) : (
                            <span style={{
                              background: r.is_lunas ? '#22c55e20' : '#ef444420',
                              color: r.is_lunas ? '#22c55e' : '#ef4444',
                              border: `1px solid ${r.is_lunas ? '#22c55e50' : '#ef444450'}`,
                              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                            }}>
                              {r.is_lunas ? '✓ LUNAS' : r.status}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f1f5f9' }}>{formatCurrencyShort(r.total_biaya)}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700, color: '#a855f7' }}>{formatCurrencyShort(r.diskon)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              const isJneRow = row.kurir?.includes('JNE') || row.kurir_kode === 'JNE'

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

                  <div style={{ display: 'grid', gridTemplateColumns: isJneRow ? 'repeat(4, 1fr)' : (penalty > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)'), gap: 8 }}>
                    {[
                      { l: isJneRow ? 'Conote' : 'Paket', v: paket.toLocaleString('id-ID'), c: '#3b82f6' },
                      { l: 'Omzet Gross', v: formatCurrencyShort(omzet), c: '#f97316' },
                      ...(isJneRow
                        ? [{ l: 'Net Tagihan', v: formatCurrencyShort(num(row.net_omzet)), c: '#3b82f6' }]
                        : (penalty > 0 ? [{ l: 'Penalty', v: formatCurrencyShort(penalty), c: '#ef4444' }] : [])
                      ),
                      { l: 'Komisi (Net)', v: formatCurrencyShort(netProfit), c: netProfit < 0 ? '#ef4444' : '#22c55e' },
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
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>
              {isJneMode ? '📋 Ringkasan Packing List JNE per Periode' : '📋 Ringkasan per Periode Bulanan'}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0d111c' }}>
                    {(isJneMode
                      ? ['Periode', 'Packing List', 'Total Conote', 'Omzet Gross', 'Komisi Diskon', 'Net Tagihan', 'Outstanding', 'Status Bayar']
                      : ['Periode', 'Total Paket', 'Omzet', 'Diskon', 'Penalty', 'Net Profit', 'POD Rate']
                    ).map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodeData.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '32px 0', textAlign: 'center', color: '#475569' }}>Belum ada data periode.</td></tr>
                  ) : periodeData.map(d => {
                    if (isJneMode) {
                      const lunasPct = d.jneNet > 0 ? Math.max(0, Math.min(100, Math.round(((d.jneNet - d.jneOutstanding) / d.jneNet) * 100))) : 100
                      return (
                        <tr key={d.periode} style={{ borderBottom: '1px solid #1e2433' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: '#f1f5f9' }}>{d.periode}</td>
                          <td style={{ padding: '10px 16px', color: '#a855f7', fontWeight: 700 }}>{d.jnePL} PL</td>
                          <td style={{ padding: '10px 16px', color: '#3b82f6', fontWeight: 700 }}>{d.paket} conote</td>
                          <td style={{ padding: '10px 16px', color: '#f97316', fontWeight: 700 }}>{formatCurrency(d.omzet)}</td>
                          <td style={{ padding: '10px 16px', color: '#22c55e', fontWeight: 700 }}>{formatCurrency(d.diskon)}</td>
                          <td style={{ padding: '10px 16px', color: '#3b82f6', fontWeight: 700 }}>{formatCurrency(d.jneNet)}</td>
                          <td style={{ padding: '10px 16px', color: d.jneOutstanding > 0 ? '#ef4444' : '#64748b', fontWeight: 700 }}>
                            {d.jneOutstanding > 0 ? formatCurrency(d.jneOutstanding) : '0 (Lunas)'}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1, background: '#1e2433', borderRadius: 4, height: 6, overflow: 'hidden', minWidth: 70 }}>
                                <div style={{ width: `${lunasPct}%`, height: '100%', background: lunasPct === 100 ? '#22c55e' : '#f59e0b', borderRadius: 4 }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: lunasPct === 100 ? '#22c55e' : '#f59e0b', minWidth: 40 }}>
                                {lunasPct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
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
                    )
                  })}
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
        isJneMode ? (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>ℹ️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>
              Karakteristik Data Wilayah & Kota JNE Express
            </div>
            <p style={{ color: '#94a3b8', fontSize: 13, maxWidth: 640, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Laporan berkala JNE Express diimpor dari dokumen <strong>Rekapitulasi Packing List Agen</strong>, yang merangkum data pada tingkat nota manifest per kiriman (Nomor PL, Cnote, Koli, Berat, dan Keuangan). Rincian kota tujuan spesifik per nomor resi hanya tersedia pada laporan per STT (seperti Lion Parcel).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 840, margin: '0 auto', textAlign: 'left' }}>
              <div style={{ background: '#0d111c', padding: '16px 20px', borderRadius: 10, border: '1px solid #1e2433' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Packing List</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6', marginTop: 4 }}>{stats.jneTotalPL} PL</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{stats.jneTotalCnote} total conote terkirim</div>
              </div>
              <div style={{ background: '#0d111c', padding: '16px 20px', borderRadius: 10, border: '1px solid #1e2433' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rata-rata per PL</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f97316', marginTop: 4 }}>
                  {stats.jneTotalPL > 0 ? (stats.jneTotalCnote / stats.jneTotalPL).toFixed(1) : 0} conote
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {stats.jneTotalPL > 0 ? (stats.jneTotalWeight / stats.jneTotalPL).toFixed(1) : 0} kg per nota PL
                </div>
              </div>
              <div style={{ background: '#0d111c', padding: '16px 20px', borderRadius: 10, border: '1px solid #1e2433' }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rasio Pelunasan Tagihan</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>
                  {stats.jneTotalPL > 0 ? ((stats.jneLunasCount / stats.jneTotalPL) * 100).toFixed(1) : 0}%
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {stats.jneLunasCount} lunas · {stats.jneBelumLunasCount} outstanding
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>
                📊 Top 10 Kota — Volume Paket {!selectedKurir && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>(Lion Parcel)</span>}
              </div>
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
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>
                🏆 Ranking Kota Tujuan {!selectedKurir && <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>(Lion Parcel)</span>}
              </div>
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
        )
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
                  formatter={(v: number) => [`${v} ${isJneMode ? 'conote' : 'kiriman'}`, 'Jumlah']} labelStyle={{ color: '#94a3b8' }} />
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
                    <span style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{b.jumlah} {isJneMode ? 'conote' : 'kiriman'}</span>
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
                    <div style={{ fontSize: 10, color: '#64748b' }}>{isJneMode ? 'conote' : 'paket'}</div>
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
                  { label: 'Hari Tersibuk', value: busiest?.jumlah > 0 ? busiest.hari : '—', sub: `${busiest?.jumlah || 0} ${isJneMode ? 'conote' : 'paket'}`, color: '#f97316' },
                  { label: 'Hari Paling Sepi', value: slowest?.jumlah === 0 ? '—' : slowest?.hari || '—', sub: `${slowest?.jumlah || 0} ${isJneMode ? 'conote' : 'paket'}`, color: '#64748b' },
                  { label: 'Rata-rata Weekday', value: `${avgWeekday}`, sub: isJneMode ? 'conote/hari' : 'paket/hari', color: '#22c55e' },
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