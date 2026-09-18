'use client'

import { formatCurrencyAccounting, formatCurrencyShort } from '@/lib/format/currency'

export default function JnePackingListTable({
  data, totalCount, page, totalPages, onPage, summary,
}: {
  data: any[]
  totalCount: number
  page: number
  totalPages: number
  onPage: (p: number) => void
  summary: {
    totalAmount: number
    totalPublishRate: number
    totalDiscount: number
    totalDiscOthers: number
    totalInsurance: number
    totalVat: number
    totalNet: number
    totalOutstanding: number
    totalCnote: number
    totalColy: number
    totalWeight: number
    belumLunasCount: number
  }
}) {
  const s = summary || {
    totalAmount: 0, totalPublishRate: 0, totalDiscount: 0, totalDiscOthers: 0,
    totalInsurance: 0, totalVat: 0, totalNet: 0, totalOutstanding: 0,
    totalCnote: 0, totalColy: 0, totalWeight: 0, belumLunasCount: 0,
  }

  const COLS = [
    { label: 'Tanggal', w: 100 },
    { label: 'No. Packing List', w: 180 },
    { label: 'Total Tagihan', w: 120 },
    { label: 'Publish Rate', w: 120 },
    { label: 'Cnote', w: 60 },
    { label: 'Asuransi', w: 100 },
    { label: 'PPN', w: 90 },
    { label: 'Diskon', w: 100 },
    { label: 'Net Bayar', w: 120 },
    { label: 'Koli', w: 60 },
    { label: 'Berat', w: 80 },
    { label: 'Tgl Bayar', w: 100 },
    { label: 'Outstanding', w: 110 },
  ]

  return (
    <div>
      {/* Summary cards - SEMUA total dihitung server-side dari SEMUA rows
          (bukan dari `data` yg paginated), supaya konsisten dgn summary
          cards di JneTransaksiWrapper. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Tagihan', value: formatCurrencyAccounting(s.totalAmount), sub: `${totalCount} PL`, color: '#f97316' },
          { label: 'Net Bayar', value: formatCurrencyAccounting(s.totalNet), sub: `Tagihan − Diskon`, color: '#22c55e' },
          { label: 'Total Diskon', value: formatCurrencyAccounting(s.totalDiscount + s.totalDiscOthers), sub: `Termasuk Lainnya ${formatCurrencyAccounting(s.totalDiscOthers)}`, color: '#a855f7' },
          { label: 'Outstanding', value: formatCurrencyAccounting(s.totalOutstanding), sub: `${s.belumLunasCount} PL belum lunas`, color: s.totalOutstanding > 0 ? '#ef4444' : '#64748b' },
        ].map(card => (
          <div key={card.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Cnote', value: `${s.totalCnote} paket`, color: '#06b6d4' },
          { label: 'Total Koli', value: `${s.totalColy} koli`, color: '#f59e0b' },
          { label: 'Total Berat', value: `${s.totalWeight.toLocaleString('id-ID')} kg`, color: '#3b82f6' },
          { label: 'Asuransi', value: formatCurrencyAccounting(s.totalInsurance), color: '#06b6d4' },
          { label: 'PPN', value: formatCurrencyAccounting(s.totalVat), color: '#94a3b8' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Tabel */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#0d111c' }}>
                {COLS.map(h => (
                  <th key={h.label} style={{
                    padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600,
                    borderBottom: '1px solid #1e2433', whiteSpace: 'nowrap', minWidth: h.w,
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #1e2433', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1e243330')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{String(row.tanggal || '').slice(0, 10) || '—'}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: '#ef4444', whiteSpace: 'nowrap' }}>{row.nomor_pl}</td>
                  <td style={{ padding: '9px 14px', color: '#f97316', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrencyShort(row.amount || 0)}</td>
                  <td style={{ padding: '9px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatCurrencyShort(row.publish_rate || 0)}</td>
                  <td style={{ padding: '9px 14px', color: '#06b6d4', whiteSpace: 'nowrap' }}>{row.insurance ? formatCurrencyShort(row.insurance) : '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.vat_amount ? formatCurrencyShort(row.vat_amount) : '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#a855f7', whiteSpace: 'nowrap' }}>{row.discount ? formatCurrencyShort(row.discount) : '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#22c55e', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrencyShort(row.total_net || 0)}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', textAlign: 'center' }}>{row.coly || 0}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.weight ? `${row.weight} kg` : '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.date_paid?.slice(0, 10) || <span style={{ color: '#f59e0b' }}>Belum</span>}</td>
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      color: (row.outstanding || 0) > 0 ? '#ef4444' : '#22c55e',
                      fontWeight: 700,
                    }}>
                      {(row.outstanding || 0) > 0 ? formatCurrencyShort(row.outstanding) : '✓ Lunas'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#475569' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <div>Belum ada data Packing List JNE.</div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid #1e2433', display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <button onClick={() => onPage(1)} disabled={page <= 1} style={{ background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 10px', color: page <= 1 ? '#2d3748' : '#94a3b8', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>«</button>
            <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={{ background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 12px', color: page <= 1 ? '#2d3748' : '#94a3b8', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>← Prev</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = Math.max(1, page - 2) + i
              if (p > totalPages) return null
              return (
                <button key={p} onClick={() => onPage(p)} style={{
                  background: p === page ? 'linear-gradient(135deg,#ef4444,#f97316)' : '#1e2433',
                  border: 'none', borderRadius: 6, padding: '6px 12px',
                  color: p === page ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 13,
                  fontWeight: p === page ? 700 : 400, minWidth: 36,
                }}>{p}</button>
              )
            })}
            <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={{ background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 12px', color: page >= totalPages ? '#2d3748' : '#94a3b8', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>Next →</button>
            <button onClick={() => onPage(totalPages)} disabled={page >= totalPages} style={{ background: '#1e2433', border: 'none', borderRadius: 6, padding: '6px 10px', color: page >= totalPages ? '#2d3748' : '#94a3b8', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>»</button>
          </div>
        )}
      </div>
    </div>
  )
}