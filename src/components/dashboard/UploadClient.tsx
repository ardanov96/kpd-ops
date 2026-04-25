'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Ekspedisi = {
  id: string; nama: string; kode: string
  warna?: string; telepon?: string; portal_url?: string; keterangan?: string; aktif: boolean
}

const PRESET_WARNA = [
  '#f97316', '#ef4444', '#22c55e', '#3b82f6', '#a855f7',
  '#ec4899', '#14b8a6', '#f59e0b', '#64748b', '#06b6d4',
]

const DEFAULT_EKSPEDISI = [
  { nama: 'Lion Parcel', kode: 'LION', warna: '#f97316' },
  { nama: 'JNE', kode: 'JNE', warna: '#ef4444' },
  { nama: 'J&T Express', kode: 'JNT', warna: '#22c55e' },
  { nama: 'Wahana Express', kode: 'WAHANA', warna: '#3b82f6' },
  { nama: 'Choir Express', kode: 'CHOIR', warna: '#a855f7' },
]

export default function UploadClient({ logs }: { logs: any[] }) {
  const [ekspedisiList, setEkspedisiList] = useState<Ekspedisi[]>([])
  const [loadingEkspedisi, setLoadingEkspedisi] = useState(true)

  const [file, setFile] = useState<File | null>(null)
  const [kurirId, setKurirId] = useState('')
  const [periode, setPeriode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Ekspedisi | null>(null)
  const [form, setForm] = useState({
    nama: '', kode: '', warna: '#f97316', telepon: '', portal_url: '', keterangan: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const router = useRouter()

  async function fetchEkspedisi() {
    setLoadingEkspedisi(true)
    try {
      const res = await fetch('/api/ekspedisi')
      const data = await res.json()
      setEkspedisiList(Array.isArray(data) ? data : [])
    } catch {
      setEkspedisiList([])
    } finally {
      setLoadingEkspedisi(false)
    }
  }

  useEffect(() => { fetchEkspedisi() }, [])

  function openAdd() {
    setEditTarget(null)
    setForm({ nama: '', kode: '', warna: '#f97316', telepon: '', portal_url: '', keterangan: '' })
    setFormError('')
    setShowForm(true)
  }

  function openEdit(e: Ekspedisi) {
    setEditTarget(e)
    setForm({
      nama: e.nama, kode: e.kode, warna: e.warna || '#64748b',
      telepon: e.telepon || '', portal_url: e.portal_url || '', keterangan: e.keterangan || '',
    })
    setFormError('')
    setShowForm(true)
  }

  function fillPreset(p: typeof DEFAULT_EKSPEDISI[0]) {
    setForm(f => ({ ...f, nama: p.nama, kode: p.kode, warna: p.warna }))
  }

  async function saveEkspedisi() {
    if (!form.nama || !form.kode) { setFormError('Nama dan kode wajib diisi'); return }
    setSaving(true); setFormError('')
    const url = editTarget ? `/api/ekspedisi/${editTarget.id}` : '/api/ekspedisi'
    const method = editTarget ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setFormError(data.error || 'Gagal menyimpan'); setSaving(false); return }
    await fetchEkspedisi()
    setShowForm(false)
    setSaving(false)
  }

  async function deleteEkspedisi(id: string, nama: string) {
    if (!confirm(`Nonaktifkan ekspedisi "${nama}"?`)) return
    await fetch(`/api/ekspedisi/${id}`, { method: 'DELETE' })
    await fetchEkspedisi()
    if (kurirId === id) setKurirId('')
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !kurirId) { setError('Lengkapi semua field'); return }
    setLoading(true); setError(''); setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kurir_id', kurirId)
    fd.append('periode', periode)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Upload gagal'); return }
      setResult(data); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (err) { setError(String(err)) }
    finally { setLoading(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: '#0d111c', border: '1px solid #1e2433',
    borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 13,
    boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }
  const selectedEkspedisi = ekspedisiList.find(e => e.id === kurirId)

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Import Laporan</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>Upload file XLSX laporan bulanan dari masing-masing ekspedisi</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Kolom kiri ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Form Upload */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 20 }}>📤 Upload File XLSX</div>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Ekspedisi *</label>
                <select className="input-base" value={kurirId} onChange={e => setKurirId(e.target.value)} required>
                  <option value="">-- Pilih Ekspedisi --</option>
                  {ekspedisiList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama} ({k.kode})</option>
                  ))}
                </select>
                {selectedEkspedisi && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: `${selectedEkspedisi.warna}25`, color: selectedEkspedisi.warna,
                      border: `1px solid ${selectedEkspedisi.warna}40`,
                      padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    }}>{selectedEkspedisi.kode}</span>
                    {selectedEkspedisi.portal_url && (
                      <a href={selectedEkspedisi.portal_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none' }}>
                        🔗 Buka Portal
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={lbl}>Periode (Bulan)</label>
                <input type="month" className="input-base" value={periode} onChange={e => setPeriode(e.target.value)} />
              </div>

              <div>
                <label style={lbl}>File XLSX *</label>
                <div onClick={() => fileRef.current?.click()} style={{
                  border: `2px dashed ${file ? '#f97316' : '#1e2433'}`,
                  borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
                  background: file ? '#f9731608' : 'transparent',
                }}>
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
                  <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>✅ Import Berhasil!</div>
                  <div style={{ color: '#94a3b8' }}>
                    Total: <b>{result.totalRows}</b> · Sukses: <b style={{ color: '#22c55e' }}>{result.successRows}</b>
                    {result.errorRows > 0 && <> · Error: <b style={{ color: '#f59e0b' }}>{result.errorRows}</b></>}
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={loading || !file || !kurirId}>
                {loading ? '⏳ Mengimport...' : '📤 Import Sekarang'}
              </button>
            </form>
          </div>

          {/* Kelola Ekspedisi — list saja, tanpa form inline */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>🚚 Kelola Ekspedisi</div>
              <button onClick={openAdd} style={{
                background: '#f97316', border: 'none', borderRadius: 6, padding: '6px 14px',
                color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>+ Tambah</button>
            </div>

            {loadingEkspedisi ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#475569', fontSize: 13 }}>Memuat...</div>
            ) : ekspedisiList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#475569', fontSize: 13 }}>Belum ada ekspedisi.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ekspedisiList.map(k => (
                  <div key={k.id} style={{
                    background: '#0d111c', borderRadius: 8, padding: '10px 14px',
                    border: `1px solid ${k.id === kurirId ? (k.warna || '#64748b') + '60' : '#1e2433'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        background: `${k.warna || '#64748b'}25`, color: k.warna || '#64748b',
                        border: `1px solid ${k.warna || '#64748b'}50`,
                        padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                        minWidth: 48, textAlign: 'center',
                      }}>{k.kode}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{k.nama}</div>
                        {(k.telepon || k.keterangan) && (
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
                            {[k.telepon, k.keterangan].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => openEdit(k)} style={{
                        background: '#1e2433', border: 'none', borderRadius: 5,
                        padding: '4px 8px', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
                      }}>✏️</button>
                      <button onClick={() => deleteEkspedisi(k.id, k.nama)} style={{
                        background: '#ef444415', border: 'none', borderRadius: 5,
                        padding: '4px 8px', color: '#ef4444', fontSize: 11, cursor: 'pointer',
                      }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Riwayat Import ── */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 16 }}>🕐 Riwayat Import</div>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              Belum ada riwayat import
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {logs.map((log: any) => {
                const warna = ekspedisiList.find(e => e.kode === log.kurir?.kode)?.warna || '#64748b'
                return (
                  <div key={log.id} style={{ background: '#0d111c', borderRadius: 10, padding: '14px 16px', border: '1px solid #1e2433' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{
                            background: `${warna}25`, color: warna, border: `1px solid ${warna}40`,
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                          }}>{log.kurir?.kode || '—'}</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{log.filename}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {log.kurir?.nama} · {log.periode || '—'} · {new Date(log.created_at).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700 }}>{log.success_rows} ✓</div>
                        {log.error_rows > 0 && <div style={{ fontSize: 11, color: '#ef4444' }}>{log.error_rows} ✗</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ flex: 1, background: '#1e2433', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(log.success_rows / Math.max(log.total_rows, 1)) * 100}%`, height: '100%', background: '#22c55e' }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
                        {((log.success_rows / Math.max(log.total_rows, 1)) * 100).toFixed(0)}% sukses
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Tambah/Edit Ekspedisi ── */}
      {showForm && (
        <>
          {/* Overlay */}
          <div onClick={() => setShowForm(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 50, backdropFilter: 'blur(3px)',
          }} />

          {/* Modal */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 51, width: 500, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
            background: '#111827', borderRadius: 14,
            border: '1px solid #1e2433', padding: 28,
            boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                {editTarget ? '✏️ Edit Ekspedisi' : '➕ Ekspedisi Baru'}
              </div>
              <button onClick={() => setShowForm(false)} style={{
                background: '#1e2433', border: 'none', borderRadius: 7,
                width: 30, height: 30, color: '#64748b', fontSize: 16,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            {/* Preset cepat */}
            {!editTarget && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>Pilih preset atau isi manual:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DEFAULT_EKSPEDISI.map(p => (
                    <button key={p.kode} onClick={() => fillPreset(p)} style={{
                      background: `${p.warna}20`, border: `1px solid ${p.warna}50`,
                      color: p.warna, borderRadius: 6, padding: '5px 12px',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}>{p.kode}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Nama + Kode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12 }}>
                <div>
                  <label style={lbl}>Nama Ekspedisi *</label>
                  <input style={inp} value={form.nama}
                    onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                    placeholder="cth: Lion Parcel" />
                </div>
                <div>
                  <label style={lbl}>Kode *</label>
                  <input style={{ ...inp, textTransform: 'uppercase' }} value={form.kode}
                    onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))}
                    placeholder="LION" maxLength={8} />
                </div>
              </div>

              {/* Warna */}
              <div>
                <label style={lbl}>Warna Badge</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {PRESET_WARNA.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, warna: c }))} style={{
                      width: 26, height: 26, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer', flexShrink: 0,
                      outline: form.warna === c ? '2px solid #fff' : '2px solid transparent',
                      outlineOffset: 2,
                    }} />
                  ))}
                  <input type="color" value={form.warna}
                    onChange={e => setForm(f => ({ ...f, warna: e.target.value }))}
                    title="Warna custom"
                    style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #1e2433', cursor: 'pointer', padding: 0, background: 'none' }} />
                </div>
                {/* Preview */}
                <div style={{ marginTop: 10 }}>
                  <span style={{
                    background: `${form.warna}25`, color: form.warna,
                    border: `1px solid ${form.warna}60`,
                    padding: '4px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                  }}>{form.kode || 'KODE'}</span>
                  <span style={{ fontSize: 11, color: '#475569', marginLeft: 10 }}>{form.warna}</span>
                </div>
              </div>

              {/* Telepon + Portal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Telepon / CS</label>
                  <input style={inp} value={form.telepon}
                    onChange={e => setForm(f => ({ ...f, telepon: e.target.value }))}
                    placeholder="08xx..." />
                </div>
                <div>
                  <label style={lbl}>URL Portal Laporan</label>
                  <input style={inp} value={form.portal_url}
                    onChange={e => setForm(f => ({ ...f, portal_url: e.target.value }))}
                    placeholder="https://..." />
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label style={lbl}>Keterangan</label>
                <input style={inp} value={form.keterangan}
                  onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
                  placeholder="Catatan tambahan..." />
              </div>

              {formError && (
                <div style={{ fontSize: 12, color: '#ef4444', background: '#ef444415', padding: '8px 12px', borderRadius: 6 }}>
                  ⚠️ {formError}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={{
                  background: 'transparent', border: '1px solid #1e2433', borderRadius: 7,
                  padding: '9px 20px', color: '#64748b', fontSize: 13, cursor: 'pointer',
                }}>Batal</button>
                <button onClick={saveEkspedisi} disabled={saving} style={{
                  background: '#f97316', border: 'none', borderRadius: 7,
                  padding: '9px 20px', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                }}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}