'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const fmt = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000   ? `Rp ${(n / 1_000).toFixed(0)}rb`
  : `Rp ${n}`

const STATUS_COLOR: Record<string, string> = { POD: '#22c55e', CNX: '#ef4444', PENDING: '#f59e0b', TRANSIT: '#3b82f6' }

export default function TransaksiClient({
  transaksi, totalCount, page, pageSize, kurirList, filters,
}: {
  transaksi: any[]; totalCount: number; page: number; pageSize: number; kurirList: any[]; filters: any
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Transaksi</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>{totalCount.toLocaleString('id-ID')} total data</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="input-base"
          style={{ width: 'auto', minWidth: 140 }}
          value={filters.kurir || ''}
          onChange={e => updateFilter('kurir', e.target.value)}
        >
          <option value="">Semua Kurir</option>
          {kurirList.map((k: any) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
        </select>

        <select
          className="input-base"
          style={{ width: 'auto', minWidth: 140 }}
          value={filters.status || ''}
          onChange={e => updateFilter('status', e.target.value)}
        >
          <option value="">Semua Status</option>
          {['POD', 'CNX', 'PENDING', 'TRANSIT', 'RETURN'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          className="input-base"
          style={{ width: 160 }}
          type="month"
          value={filters.periode || ''}
          onChange={e => updateFilter('periode', e.target.value)}
          placeholder="Filter bulan"
        />

        {(filters.kurir || filters.status || filters.periode) && (
          <button
            onClick={() => router.push(pathname)}
            style={{ background: '#1e2433', border: '1px solid #2d3748', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
            ✕ Reset
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
          Halaman {page} dari {totalPages}
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#0d111c' }}>
                {['Tanggal', 'No. STT', 'Kurir', 'Kota Tujuan', 'Produk', 'Komoditas', 'Koli', 'Berat', 'Total Biaya', 'Diskon', 'Status'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e2433', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transaksi.map((tx, i) => (
                <tr key={tx.id}
                  style={{ borderBottom: '1px solid #1e2433', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{tx.tanggal?.slice(0, 10)}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#94a3b8' }}>{tx.nomor_stt}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ background: (tx.kurir?.warna || '#64748b') + '25', color: tx.kurir?.warna || '#94a3b8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                      {tx.kurir?.kode || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.kota_tujuan?.split('-')[1] || tx.kota_tujuan || '—'}
                  </td>
                  <td style={{ padding: '9px 14px', color: '#94a3b8' }}>{tx.nama_produk || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#94a3b8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.komoditas || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', textAlign: 'center' }}>{tx.koli}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b' }}>{tx.berat_kena_biaya} kg</td>
                  <td style={{ padding: '9px 14px', fontWeight: 700, color: '#f97316', whiteSpace: 'nowrap' }}>{fmt(tx.total_biaya || 0)}</td>
                  <td style={{ padding: '9px 14px', color: '#a855f7', whiteSpace: 'nowrap' }}>{fmt(tx.diskon_booking || 0)}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ background: (STATUS_COLOR[tx.status] || '#64748b') + '25', color: STATUS_COLOR[tx.status] || '#64748b', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                      {tx.status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {transaksi.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#475569' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div>Tidak ada transaksi ditemukan.</div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid #1e2433', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
            <button onClick={() => goPage(page - 1)} disabled={page <= 1}
              style={{ background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 14px', color: page <= 1 ? '#2d3748' : '#94a3b8', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}>
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = Math.max(1, page - 2) + i
              if (p > totalPages) return null
              return (
                <button key={p} onClick={() => goPage(p)}
                  style={{ background: p === page ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#1e2433', border: 'none', borderRadius: 6, padding: '6px 12px', color: p === page ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 700 : 400 }}>
                  {p}
                </button>
              )
            })}
            <button onClick={() => goPage(page + 1)} disabled={page >= totalPages}
              style={{ background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 14px', color: page >= totalPages ? '#2d3748' : '#94a3b8', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 13 }}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
