'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import JnePackingListTable from './JnePackingListTable'
import { formatCurrencyAccounting, formatCurrencyShort } from '@/lib/format/currency'

export default function JneTransaksiWrapper({
  data, totalCount, page, pageSize, kurirList, filters, kurirInfo, summary,
}: {
  data: any[]
  totalCount: number
  page: number
  pageSize: number
  kurirList: any[]
  filters: any
  kurirInfo: any
  summary: {
    subtotal_biaya: number
    subtotal_diskon: number
    subtotal_discount: number
    subtotal_publish_rate: number
    subtotal_disc_others: number
    subtotal_asuransi: number
    subtotal_ppn: number
    subtotal_net_profit: number
    subtotal_outstanding: number
    total_cnote: number
    total_coly: number
    total_weight: number
    belum_lunas: number
  } | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const totalPages = Math.ceil(totalCount / pageSize)

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(filters)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  function goPage(p: number) {
    const params = new URLSearchParams(filters)
    params.set('page', String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  const s = summary || {
    subtotal_biaya: 0, subtotal_diskon: 0, subtotal_discount: 0,
    subtotal_publish_rate: 0, subtotal_disc_others: 0, subtotal_asuransi: 0,
    subtotal_ppn: 0, subtotal_net_profit: 0, subtotal_outstanding: 0,
    total_cnote: 0, total_coly: 0, total_weight: 0, belum_lunas: 0,
  }

  const tableSummary = {
    totalAmount: s.subtotal_biaya,
    totalPublishRate: s.subtotal_publish_rate,
    totalDiscount: s.subtotal_discount,
    totalDiscOthers: s.subtotal_disc_others,
    totalInsurance: s.subtotal_asuransi,
    totalVat: s.subtotal_ppn,
    totalNet: s.subtotal_net_profit,
    totalOutstanding: s.subtotal_outstanding,
    totalCnote: s.total_cnote,
    totalColy: s.total_coly,
    totalWeight: Number(s.total_weight) || 0,
    belumLunasCount: s.belum_lunas,
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Transaksi</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
          {totalCount.toLocaleString('id-ID')} total Packing List JNE
        </p>
      </div>

      {/* Filter */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input-base" style={{ width: 'auto', minWidth: 150 }}
          value={filters.kurir || ''} onChange={e => updateFilter('kurir', e.target.value)}>
          <option value="">Semua Kurir</option>
          {kurirList.map((k: any) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
        </select>

        <input className="input-base" style={{ width: 160, colorScheme: 'dark' }}
          type="month" value={filters.periode || ''}
          onChange={e => updateFilter('periode', e.target.value)} />

        {(filters.kurir || filters.periode) && (
          <button onClick={() => router.push(pathname)} style={{
            background: '#1e2433', border: '1px solid #2d3748', borderRadius: 8,
            padding: '8px 14px', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
          }}>✕ Reset</button>
        )}

        {/* Badge JNE */}
        <span style={{
          background: `${kurirInfo?.warna || '#ef4444'}20`,
          color: kurirInfo?.warna || '#ef4444',
          border: `1px solid ${kurirInfo?.warna || '#ef4444'}40`,
          padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
        }}>
          📋 Mode: Packing List JNE
        </span>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
          Hal {page} dari {totalPages || 1} · {totalCount} PL
        </span>
      </div>

      {/* Summary Cards - financial totals (JNE has no nama_produk/komoditas) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ background: '#f9731620', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Subtotal Biaya (Gross)</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f97316' }}>{formatCurrencyAccounting(Number(s.subtotal_biaya))}</div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ background: '#a855f720', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏷️</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Subtotal Diskon</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>{formatCurrencyAccounting(Number(s.subtotal_diskon))}</div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ background: '#22c55e20', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💹</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Komisi Franchise</div>
            <div style={{ fontSize: 10, color: '#475569' }}>(= Diskon)</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{formatCurrencyAccounting(Number(s.subtotal_net_profit))}</div>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ background: s.belum_lunas > 0 ? '#ef444420' : '#64748b20', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚠️</div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Outstanding</div>
              <div style={{ fontSize: 10, color: '#475569' }}>{s.belum_lunas} PL belum lunas</div>
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.belum_lunas > 0 ? '#ef4444' : '#64748b' }}>{formatCurrencyAccounting(Number(s.subtotal_outstanding))}</div>
        </div>
      </div>

      <JnePackingListTable
        data={data}
        totalCount={totalCount}
        page={page}
        totalPages={totalPages}
        onPage={goPage}
        summary={tableSummary}
      />
    </div>
  )
}