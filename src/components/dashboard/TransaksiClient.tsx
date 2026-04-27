'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const fmt = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000   ? `Rp ${(n / 1_000).toFixed(0)}rb`
  : `Rp ${n}`

const fmtFull = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

const STATUS_COLOR: Record<string, string> = {
  POD: '#22c55e', CNX: '#ef4444', PENDING: '#f59e0b', TRANSIT: '#3b82f6', RETURN: '#a855f7'
}

export default function TransaksiClient({
  transaksi, totalCount, page, pageSize, kurirList, filters, summary,
}: {
  transaksi: any[]
  totalCount: number
  page: number
  pageSize: number
  kurirList: any[]
  filters: any
  summary: {
    subtotalBiaya: number
    subtotalDiskon: number
    subtotalDiskonAsuransi: number    
    subtotalDiskonFwdRate: number     
    subtotalNetProfit: number         
    produkTerpopuler: [string, number] | null
    komoditasTerpopuler: [string, number] | null  
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const totalPages = Math.ceil(totalCount / pageSize)

  const tableWrapRef = useRef<HTMLDivElement>(null)
  const topScrollRef = useRef<HTMLDivElement>(null)
  const [tableWidth, setTableWidth] = useState(0)

  useEffect(() => {
    const el = tableWrapRef.current
    if (!el) return
    const update = () => setTableWidth(el.scrollWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [transaksi])

  function onTopScroll() {
    if (tableWrapRef.current && topScrollRef.current)
      tableWrapRef.current.scrollLeft = topScrollRef.current.scrollLeft
  }
  function onTableScroll() {
    if (tableWrapRef.current && topScrollRef.current)
      topScrollRef.current.scrollLeft = tableWrapRef.current.scrollLeft
  }

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

  function pageRange() {
    const delta = 2
    const range: number[] = []
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
      range.push(i)
    }
    return range
  }

  const COLS = [
    { label: 'Tanggal', w: 90 },
    { label: 'No. STT', w: 160 },
    { label: 'Kurir', w: 70 },
    { label: 'Kota Tujuan', w: 130 },
    { label: 'Produk', w: 90 },
    { label: 'Komoditas', w: 150 },
    { label: 'Koli', w: 50 },
    { label: 'Berat', w: 70 },
    { label: 'Biaya Asuransi', w: 110 },   // ✅ tambah
    { label: 'Total Biaya', w: 100 },
    { label: 'Potongan', w: 90 },           // ✅ tambah
    { label: 'Diskon Booking', w: 110 },    // ✅ pecah diskon
    { label: 'Diskon Asuransi', w: 110 },   // ✅ pecah diskon
    { label: 'Diskon Fwd Rate', w: 110 },   // ✅ pecah diskon
    { label: 'Status', w: 90 },
  ]

  return (
    
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Transaksi</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>{totalCount.toLocaleString('id-ID')} total data</p>
      </div>

      {/* Filter */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input-base" style={{ width: 'auto', minWidth: 150 }}
          value={filters.kurir || ''} onChange={e => updateFilter('kurir', e.target.value)}>
          <option value="">Semua Kurir</option>
          {kurirList.map((k: any) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
        </select>

        <select className="input-base" style={{ width: 'auto', minWidth: 150 }}
          value={filters.status || ''} onChange={e => updateFilter('status', e.target.value)}>
          <option value="">Semua Status</option>
          {['POD', 'CNX', 'PENDING', 'TRANSIT', 'RETURN'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input className="input-base" style={{ width: 160, colorScheme: 'dark' }}
          type="month" value={filters.periode || ''}
          onChange={e => updateFilter('periode', e.target.value)} />

        {(filters.kurir || filters.status || filters.periode) && (
          <button onClick={() => router.push(pathname)} style={{
            background: '#1e2433', border: '1px solid #2d3748', borderRadius: 8,
            padding: '8px 14px', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
          }}>✕ Reset</button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
          Hal {page} dari {totalPages || 1} · {totalCount.toLocaleString('id-ID')} data
        </span>
      </div>

{/* ✅ Ringkasan bawah — baris 1 */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 20 }}>

  <div className="card" style={{ padding: '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ background: '#f9731620', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
      <div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Subtotal Biaya</div>
        <div style={{ fontSize: 10, color: '#475569' }}>Exclude CNX{filters.status ? ` · ${filters.status}` : ''}</div>
      </div>
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color: '#f97316' }}>{fmtFull(summary.subtotalBiaya)}</div>
  </div>

  <div className="card" style={{ padding: '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ background: '#a855f720', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏷️</div>
      <div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Subtotal Diskon Booking</div>
        <div style={{ fontSize: 10, color: '#475569' }}>Exclude CNX</div>
      </div>
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>{fmtFull(summary.subtotalDiskon)}</div>
  </div>

  <div className="card" style={{ padding: '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ background: '#06b6d420', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🛡️</div>
      <div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Subtotal Diskon Asuransi</div>
        <div style={{ fontSize: 10, color: '#475569' }}>Exclude CNX</div>
      </div>
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color: '#06b6d4' }}>{fmtFull(summary.subtotalDiskonAsuransi)}</div>
  </div>

</div>

{/* ✅ Ringkasan bawah — baris 2 */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16, marginBottom: 24 }}>

  <div className="card" style={{ padding: '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ background: '#22c55e20', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💹</div>
      <div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Subtotal Net Profit</div>
        <div style={{ fontSize: 10, color: '#475569' }}>Booking + Asuransi + Fwd Rate</div>
      </div>
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{fmtFull(summary.subtotalNetProfit)}</div>
  </div>

  <div className="card" style={{ padding: '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ background: '#22c55e20', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
      <div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Produk Terpopuler</div>
        <div style={{ fontSize: 10, color: '#475569' }}>Exclude CNX</div>
      </div>
    </div>
    {summary.produkTerpopuler ? (
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{summary.produkTerpopuler[0]}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{summary.produkTerpopuler[1].toLocaleString('id-ID')} pengiriman</div>
      </div>
    ) : <div style={{ fontSize: 14, color: '#475569' }}>—</div>}
  </div>

  <div className="card" style={{ padding: '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ background: '#f59e0b20', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏷️</div>
      <div>
        <div style={{ fontSize: 12, color: '#64748b' }}>Komoditas Terpopuler</div>
        <div style={{ fontSize: 10, color: '#475569' }}>Exclude CNX</div>
      </div>
    </div>
    {summary.komoditasTerpopuler ? (
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{summary.komoditasTerpopuler[0]}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{summary.komoditasTerpopuler[1].toLocaleString('id-ID')} pengiriman</div>
      </div>
    ) : <div style={{ fontSize: 14, color: '#475569' }}>—</div>}
  </div>

</div>

      {/* Table card */}
      <div className="card" style={{ overflow: 'hidden' }}>

        {/* ✅ Scrollbar mirror atas */}
        <div ref={topScrollRef} onScroll={onTopScroll}
          style={{ overflowX: 'auto', overflowY: 'hidden', height: 12, borderBottom: '1px solid #1e2433' }}>
          <div style={{ width: tableWidth, height: 1 }} />
        </div>

        {/* Tabel */}
        <div ref={tableWrapRef} onScroll={onTableScroll} style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#0d111c' }}>
                {COLS.map(h => (
                  <th key={h.label} style={{
                    padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600,
                    borderBottom: '1px solid #1e2433', whiteSpace: 'nowrap', minWidth: h.w,
                    position: 'sticky', top: 0, background: '#0d111c', zIndex: 1,
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transaksi.map((tx) => (
                <tr key={tx.id}
                  style={{ borderBottom: '1px solid #1e2433', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{tx.tanggal?.slice(0, 10)}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{tx.nomor_stt}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      background: `${tx.kurir?.warna || '#64748b'}25`, color: tx.kurir?.warna || '#94a3b8',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    }}>{tx.kurir?.kode || '—'}</span>
                  </td>
                  <td style={{ padding: '9px 14px', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.kota_tujuan?.split('-')[1]?.trim() || tx.kota_tujuan || '—'}
                  </td>
                  <td style={{ padding: '9px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{tx.nama_produk || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#94a3b8', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.komoditas || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', textAlign: 'center' }}>{tx.koli}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{tx.berat_kena_biaya} kg</td>

                  {/* ✅ Biaya Asuransi */}
                  <td style={{ padding: '9px 14px', color: '#06b6d4', whiteSpace: 'nowrap' }}>
                    {tx.biaya_asuransi ? fmt(tx.biaya_asuransi) : '—'}
                  </td>

                  <td style={{ padding: '9px 14px', fontWeight: 700, color: '#f97316', whiteSpace: 'nowrap' }}>{fmt(tx.total_biaya || 0)}</td>

                  {/* ✅ Potongan */}
                  <td style={{ padding: '9px 14px', color: '#ef4444', whiteSpace: 'nowrap' }}>
                    {tx.potongan ? fmt(tx.potongan) : '—'}
                  </td>

                  {/* ✅ Diskon Booking */}
                  <td style={{ padding: '9px 14px', color: '#a855f7', whiteSpace: 'nowrap' }}>
                    {tx.diskon_booking ? fmt(tx.diskon_booking) : '—'}
                  </td>

                  {/* ✅ Diskon Asuransi */}
                  <td style={{ padding: '9px 14px', color: '#a855f7', whiteSpace: 'nowrap' }}>
                    {tx.diskon_asuransi ? fmt(tx.diskon_asuransi) : '—'}
                  </td>

                  {/* ✅ Diskon Forward Rate */}
                  <td style={{ padding: '9px 14px', color: '#a855f7', whiteSpace: 'nowrap' }}>
                    {tx.diskon_forward_rate ? fmt(tx.diskon_forward_rate) : '—'}
                  </td>

                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      background: `${STATUS_COLOR[tx.status] || '#64748b'}25`,
                      color: STATUS_COLOR[tx.status] || '#64748b',
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>{tx.status || '—'}</span>
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
          <div style={{
            padding: '14px 16px', borderTop: '1px solid #1e2433',
            display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
          }}>
            <button onClick={() => goPage(1)} disabled={page <= 1} style={{
              background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 10px',
              color: page <= 1 ? '#2d3748' : '#94a3b8', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 12,
            }}>«</button>
            <button onClick={() => goPage(page - 1)} disabled={page <= 1} style={{
              background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 12px',
              color: page <= 1 ? '#2d3748' : '#94a3b8', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 12,
            }}>← Prev</button>

            {pageRange()[0] > 1 && <span style={{ color: '#475569', fontSize: 12 }}>…</span>}
            {pageRange().map(p => (
              <button key={p} onClick={() => goPage(p)} style={{
                background: p === page ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#1e2433',
                border: 'none', borderRadius: 6, padding: '6px 12px',
                color: p === page ? '#fff' : '#94a3b8', cursor: 'pointer',
                fontSize: 13, fontWeight: p === page ? 700 : 400, minWidth: 36,
              }}>{p}</button>
            ))}
            {pageRange()[pageRange().length - 1] < totalPages && <span style={{ color: '#475569', fontSize: 12 }}>…</span>}

            <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} style={{
              background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 12px',
              color: page >= totalPages ? '#2d3748' : '#94a3b8', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12,
            }}>Next →</button>
            <button onClick={() => goPage(totalPages)} disabled={page >= totalPages} style={{
              background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 10px',
              color: page >= totalPages ? '#2d3748' : '#94a3b8', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12,
            }}>»</button>
          </div>
        )}
      </div>

    </div>
  )
}