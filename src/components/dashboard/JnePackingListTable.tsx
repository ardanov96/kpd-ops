'use client'

const fmt = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000   ? `Rp ${(n / 1_000).toFixed(0)}rb`
  : `Rp ${n}`

const fmtFull = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

export default function JnePackingListTable({
  data, totalCount, page, totalPages, onPage,
}: {
  data: any[]
  totalCount: number
  page: number
  totalPages: number
  onPage: (p: number) => void
}) {
  const totalAmount = data.reduce((s, r) => s + (r.amount || 0), 0)
  const totalPublishRate = data.reduce((s, r) => s + (r.publish_rate || 0), 0)
  const totalDiscount = data.reduce((s, r) => s + (r.discount || 0), 0)
  const totalNet = data.reduce((s, r) => s + (r.total_net || 0), 0)
  const totalOutstanding = data.reduce((s, r) => s + (r.outstanding || 0), 0)
  const totalCnote = data.reduce((s, r) => s + (r.cnote_count || 0), 0)
  const totalColy = data.reduce((s, r) => s + (r.coly || 0), 0)

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
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Tagihan', value: fmtFull(totalAmount), color: '#f97316' },
          { label: 'Net Bayar', value: fmtFull(totalNet), color: '#22c55e' },
          { label: 'Total Diskon', value: fmtFull(totalDiscount), color: '#a855f7' },
          { label: 'Outstanding', value: fmtFull(totalOutstanding), color: totalOutstanding > 0 ? '#ef4444' : '#64748b' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total PL', value: `${totalCount} dokumen`, color: '#3b82f6' },
          { label: 'Total Cnote', value: `${totalCnote} paket`, color: '#06b6d4' },
          { label: 'Total Koli', value: `${totalColy} koli`, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
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
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.tanggal?.slice(0, 10) || '—'}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: '#ef4444', whiteSpace: 'nowrap' }}>{row.nomor_pl}</td>
                  <td style={{ padding: '9px 14px', color: '#f97316', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(row.amount || 0)}</td>
                  <td style={{ padding: '9px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmt(row.publish_rate || 0)}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', textAlign: 'center' }}>{row.cnote_count || 0}</td>
                  <td style={{ padding: '9px 14px', color: '#06b6d4', whiteSpace: 'nowrap' }}>{row.insurance ? fmt(row.insurance) : '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.vat_amount ? fmt(row.vat_amount) : '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#a855f7', whiteSpace: 'nowrap' }}>{row.discount ? fmt(row.discount) : '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#22c55e', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(row.total_net || 0)}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', textAlign: 'center' }}>{row.coly || 0}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.weight ? `${row.weight} kg` : '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{row.date_paid?.slice(0, 10) || <span style={{ color: '#f59e0b' }}>Belum</span>}</td>
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      color: (row.outstanding || 0) > 0 ? '#ef4444' : '#22c55e',
                      fontWeight: 700,
                    }}>
                      {(row.outstanding || 0) > 0 ? fmt(row.outstanding) : '✓ Lunas'}
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