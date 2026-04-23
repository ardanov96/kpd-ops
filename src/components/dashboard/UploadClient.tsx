'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadClient({
  kurirList, outletList, logs,
}: {
  kurirList: any[]; outletList: any[]; logs: any[]
}) {
  const [file, setFile] = useState<File | null>(null)
  const [kurir, setKurir] = useState('')
  const [outletId, setOutletId] = useState(outletList[0]?.id || '')
  const [periode, setPeriode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !kurir || !outletId) { setError('Lengkapi semua field'); return }
    setLoading(true); setError(''); setResult(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('kurir', kurir)
    fd.append('outlet_id', outletId)
    fd.append('periode', periode)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Upload gagal'); return }
      setResult(data)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Import Laporan</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Upload file XLSX laporan bulanan dari masing-masing kurir</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Form */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📤 Upload File XLSX</div>
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Kurir *</label>
              <select className="input-base" value={kurir} onChange={e => setKurir(e.target.value)} required>
                <option value="">-- Pilih Kurir --</option>
                {kurirList.map((k: any) => (
                  <option key={k.kode} value={k.kode}>{k.nama} ({k.kode})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Outlet *</label>
              <select className="input-base" value={outletId} onChange={e => setOutletId(e.target.value)} required>
                {outletList.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.nama}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Periode (Bulan)</label>
              <input type="month" className="input-base" value={periode} onChange={e => setPeriode(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>File XLSX *</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${file ? '#f97316' : '#1e2433'}`,
                  borderRadius: 10, padding: '20px 16px', textAlign: 'center',
                  cursor: 'pointer', transition: 'border-color 0.2s',
                  background: file ? '#f9731608' : 'transparent',
                }}
              >
                {file ? (
                  <div>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f97316' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>Klik untuk pilih file</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Format: .xlsx, .xls</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>

            {error && (
              <div style={{ background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
                ⚠️ {error}
              </div>
            )}

            {result && (
              <div style={{ background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: 8, padding: '12px 14px', fontSize: 13 }}>
                <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 6 }}>✅ Import Berhasil!</div>
                <div style={{ color: '#94a3b8' }}>Total baris: <b>{result.totalRows}</b></div>
                <div style={{ color: '#94a3b8' }}>Berhasil import: <b style={{ color: '#22c55e' }}>{result.successRows}</b></div>
                {result.errorRows > 0 && <div style={{ color: '#f59e0b' }}>Error: <b>{result.errorRows}</b> baris</div>}
                {result.errors?.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#64748b' }}>Lihat error detail</summary>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#f59e0b' }}>
                      {result.errors.map((e: any) => <div key={e.index}>Baris {e.index}: {e.message}</div>)}
                    </div>
                  </details>
                )}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading || !file || !kurir}>
              {loading ? '⏳ Mengimport...' : '📤 Import Sekarang'}
            </button>
          </form>

          {/* Panduan kurir */}
          <div style={{ marginTop: 20, padding: '14px', background: '#0d111c', borderRadius: 10, border: '1px solid #1e2433' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>ℹ️ Panduan Format File</div>
            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
              <b style={{ color: '#f97316' }}>LION:</b> Export dari portal LP → stt_report.xlsx<br/>
              <b style={{ color: '#ef4444' }}>JNE:</b> Laporan bulanan dari myconsignee JNE<br/>
              <b style={{ color: '#22c55e' }}>J&T:</b> Laporan dari portal J&T Express<br/>
              <b style={{ color: '#3b82f6' }}>WAHANA:</b> Laporan dari sistem Wahana
            </div>
          </div>
        </div>

        {/* Upload history */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>🕐 Riwayat Import</div>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              Belum ada riwayat import
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {logs.map((log: any) => (
                <div key={log.id} style={{ background: '#0d111c', borderRadius: 10, padding: '14px 16px', border: '1px solid #1e2433' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ background: '#f9731625', color: '#f97316', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {log.kurir?.kode || '—'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{log.filename}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {log.outlet?.nama} · {log.periode || '—'} · {new Date(log.created_at).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700 }}>{log.success_rows} ✓</div>
                      {log.error_rows > 0 && <div style={{ fontSize: 11, color: '#ef4444' }}>{log.error_rows} ✗</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1, background: '#1e2433', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(log.success_rows / Math.max(log.total_rows, 1)) * 100}%`, height: '100%', background: '#22c55e', transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
                      {((log.success_rows / Math.max(log.total_rows, 1)) * 100).toFixed(0)}% sukses
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
