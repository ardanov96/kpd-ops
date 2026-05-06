'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import JnePackingListTable from './JnePackingListTable'

export default function JneTransaksiWrapper({
  data, totalCount, page, pageSize, kurirList, filters, kurirInfo,
}: {
  data: any[]
  totalCount: number
  page: number
  pageSize: number
  kurirList: any[]
  filters: any
  kurirInfo: any
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

      <JnePackingListTable
        data={data}
        totalCount={totalCount}
        page={page}
        totalPages={totalPages}
        onPage={goPage}
      />
    </div>
  )
}