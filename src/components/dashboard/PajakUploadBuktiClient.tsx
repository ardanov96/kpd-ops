'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useToast } from './Toast'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(Number(n || 0)).toLocaleString('id-ID') + ',-'

function fmtPeriode(p: string): string {
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  const [tahun, m] = p.split('-')
  return `${bulan[Number(m) - 1]} ${tahun}`
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']

type Rekap = {
  id: string
  periode: string
  dasar_pengenaan: number
  nilai_pajak: number
  status_bayar: 'BELUM' | 'LUNAS' | 'BEAS'
  tanggal_bayar?: string | null
  bukti_url?: string | null
  catatan?: string | null
}

export default function PajakUploadBuktiClient({
  outlet, rekapList, initialId, initialRekap,
}: {
  outlet: { id: string; kode: string; nama: string }
  rekapList: Rekap[]
  initialId: string
  initialRekap: Rekap | null
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string>(initialId)
  const [buktiUrl, setBuktiUrl] = useState<string>(initialRekap?.bukti_url || '')
  const [tanggalBayar, setTanggalBayar] = useState<string>(
    initialRekap?.tanggal_bayar || new Date().toISOString().slice(0, 10)
  )
  const [catatan, setCatatan] = useState<string>(initialRekap?.catatan || '')
  const [actionSetLunas, setActionSetLunas] = useState<boolean>(
    initialRekap?.status_bayar !== 'LUNAS'
  )
  const [fileName, setFileName] = useState<string>('')
  const [filePreview, setFilePreview] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { showToast } = useToast()

  const selected = useMemo(
    () => rekapList.find(r => r.id === selectedId) || null,
    [selectedId, rekapList]
  )

  function pickRekap(id: string) {
    setSelectedId(id)
    const r = rekapList.find(x => x.id === id)
    if (r) {
      setBuktiUrl(r.bukti_url || '')
      setTanggalBayar(r.tanggal_bayar || new Date().toISOString().slice(0, 10))
      setCatatan(r.catatan || '')
      setActionSetLunas(r.status_bayar !== 'LUNAS')
      setFileName('')
      setFilePreview('')
    }
  }

  // ============================================================
  // FILE HANDLING (Sprint 4 Task 4.13: drag-drop + upload nyata)
  // ============================================================

  async function handleFileSelect(file: File | null) {
    if (!file) {
      setFileName('')
      setFilePreview('')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File terlalu besar (${(file.size / 1024 / 1024).toFixed(2)} MB). Maks 5 MB.`, 'err')
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast(`Tipe file tidak didukung: ${file.type}. Hanya JPG/PNG/PDF.`, 'err')
      return
    }
    setFileName(file.name)
    // Preview image only (PDF: tampilkan nama saja)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setFilePreview(String(reader.result || ''))
      reader.readAsDataURL(file)
    } else {
      setFilePreview('')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function clearFile() {
    setFileName('')
    setFilePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ============================================================
  // SIMPAN: upload file → set LUNAS dengan bukti_url + path
  // ============================================================

  async function save() {
    if (!selected) return showToast('Pilih rekap dulu', 'err')
    setBusy(true)
    setUploadProgress(0)
    let uploadedPath: string | null = null  // hoisted ke outer scope agar bisa diakses di catch
    try {
      const fileObj = fileInputRef.current?.files?.[0]

      // Step 1: upload bukti SSP kalau ada file dipilih
      if (fileObj) {
        setUploadBusy(true)
        setUploadProgress(20)
        const fd = new FormData()
        fd.append('file', fileObj)
        fd.append('outletId', outlet.id)
        fd.append('refId', selected.id)
        fd.append('subfolder', selected.periode) // YYYY-MM
        const upRes = await fetch('/api/storage/upload-bukti', {
          method: 'POST',
          body: fd,
        })
        setUploadProgress(80)
        const upJson = await upRes.json()
        if (!upRes.ok) throw new Error(upJson.error || 'Upload bukti gagal')
        uploadedPath = upJson.path
      }

      // Step 2: update pajak_rekap (status + bukti_url + tanggal_bayar)
      const status_bayar = actionSetLunas ? 'LUNAS' : selected.status_bayar
      const payload: Record<string, unknown> = {
        id: selected.id,
        status_bayar,
        tanggal_bayar: actionSetLunas ? tanggalBayar : null,
        bukti_url: uploadedPath || buktiUrl || null,
        catatan: catatan || null,
      }
      const res = await fetch('/api/pajak/bayar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setUploadProgress(100)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal update')

      showToast(
        `✅ Bukti SSP ${uploadedPath ? 'terupload & ' : ''}tersimpan untuk ${fmtPeriode(selected.periode)} (${status_bayar})`
      )
      clearFile()
      router.refresh()
    } catch (e: any) {
      // ── Fix Bug #5: Cleanup orphan file di Storage kalau DB update gagal ──
      // Kalau upload berhasil tapi DB update gagal, hapus file dari Storage
      // agar tidak ada file orphan tanpa reference di database.
      if (uploadedPath && !fileInputRef.current?.files?.[0]) {
        try {
          // Tunggu sebentar untuk pastikan DB error bukan network glitch
          await new Promise(r => setTimeout(r, 500))
          // Coba sekali lagi ke /api/pajak/bayar dengan bukti_url yang sama
          const retryRes = await fetch('/api/pajak/bayar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: selected.id,
              status_bayar: 'LUNAS',
              tanggal_bayar: tanggalBayar,
              bukti_url: uploadedPath,
              catatan: catatan,
            }),
          })
          if (!retryRes.ok) {
            // Double confirm gagal → hapus file dari Storage
            console.warn('[PajakUploadBukti] DB update gagal setelah retry, hapus orphan file:', uploadedPath)
            // Extract path relatif dari URL
            const path = uploadedPath.includes('/storage/v1/object/')
              ? uploadedPath.split('/storage/v1/object/')[1]?.split('?')[0]
              : uploadedPath
            if (path) {
              await fetch('/api/storage/get-signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bucket: 'bukti-pajak', path, _delete: true }),
              })
            }
          }
        } catch (cleanupErr) {
          console.warn('[PajakUploadBukti] Gagal cleanup orphan file:', cleanupErr)
        }
      }
      showToast(`❌ Upload bukti gagal: ${e.message}. File sudah dibersihkan jika ada.`, 'err')
    } finally {
      setBusy(false)
      setUploadBusy(false)
      setUploadProgress(0)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: '#0d111c', border: '1px solid #1e2433',
    borderRadius: 8, padding: '10px 14px', color: '#f1f5f9', fontSize: 14,
    boxSizing: 'border-box', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }

  const belumList = rekapList.filter(r => r.status_bayar === 'BELUM')
  const lunasList = rekapList.filter(r => r.status_bayar === 'LUNAS')
  const bebasList = rekapList.filter(r => r.status_bayar === 'BEAS')

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      <button onClick={() => router.push('/dashboard/pajak')} style={{
        background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8,
      }}>← Kembali ke Pajak</button>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>📎 Upload Bukti SSP</h1>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
        {outlet.nama} ({outlet.kode}) · Set status LUNAS setelah bayar ke e-Billing DJP
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: 16, alignItems: 'flex-start' }}>
        {/* Sidebar: daftar rekap */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 12, maxHeight: '70vh', overflowY: 'auto' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#f1f5f9' }}>
            📋 Daftar Rekap · {rekapList.length}
          </h2>

          {belumList.length > 0 && (
            <div style={{ fontSize: 10, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '8px 0 6px' }}>
              ⏳ Belum Bayar ({belumList.length})
            </div>
          )}
          {belumList.map(r => (
            <button key={r.id} onClick={() => pickRekap(r.id)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4,
              borderRadius: 6, cursor: 'pointer',
              background: selectedId === r.id ? '#f59e0b15' : '#1a2030',
              border: selectedId === r.id ? '1px solid #f59e0b' : '1px solid #1e2433',
              color: '#e2e8f0', fontSize: 13,
            }}>
              <div style={{ fontWeight: 700 }}>{fmtPeriode(r.periode)}</div>
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>{fmtRp(r.nilai_pajak)}</div>
            </button>
          ))}

          {lunasList.length > 0 && (
            <div style={{ fontSize: 10, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 6px' }}>
              ✅ Sudah Lunas ({lunasList.length})
            </div>
          )}
          {lunasList.slice(0, 6).map(r => (
            <button key={r.id} onClick={() => pickRekap(r.id)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4,
              borderRadius: 6, cursor: 'pointer',
              background: selectedId === r.id ? '#22c55e15' : '#1a2030',
              border: selectedId === r.id ? '1px solid #22c55e' : '1px solid #1e2433',
              color: '#e2e8f0', fontSize: 13,
            }}>
              <div>{fmtPeriode(r.periode)}</div>
              <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>
                {fmtRp(r.nilai_pajak)} {r.bukti_url && '📎'}
              </div>
            </button>
          ))}

          {bebasList.length > 0 && (
            <div style={{ fontSize: 10, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 6px' }}>
              🆓 Bebas ({bebasList.length})
            </div>
          )}
          {bebasList.map(r => (
            <button key={r.id} onClick={() => pickRekap(r.id)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4,
              borderRadius: 6, cursor: 'pointer',
              background: selectedId === r.id ? '#3b82f615' : '#1a2030',
              border: selectedId === r.id ? '1px solid #3b82f6' : '1px solid #1e2433',
              color: '#e2e8f0', fontSize: 13,
            }}>
              <div>{fmtPeriode(r.periode)}</div>
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>{fmtRp(r.nilai_pajak)}</div>
            </button>
          ))}
        </div>

        {/* Form upload SSP */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 20 }}>
          {!selected ? (
            <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>
              Pilih rekap di sidebar kiri untuk upload bukti SSP.
            </div>
          ) : (
            <>
              <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>
                🧾 {fmtPeriode(selected.periode)}
              </h2>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>
                Nilai PPh: <strong style={{ color: '#f97316' }}>{fmtRp(selected.nilai_pajak)}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                Status saat ini:{' '}
                {selected.status_bayar === 'LUNAS' && <span style={{ color: '#22c55e', fontWeight: 700 }}>✅ LUNAS</span>}
                {selected.status_bayar === 'BELUM' && <span style={{ color: '#f59e0b', fontWeight: 700 }}>⏳ BELUM</span>}
                {selected.status_bayar === 'BEAS' && <span style={{ color: '#3b82f6', fontWeight: 700 }}>🆓 BEBAS</span>}
                {selected.tanggal_bayar && ` · ${new Date(selected.tanggal_bayar).toLocaleDateString('id-ID')}`}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* ========================================================
                    DRAG-DROP UPLOAD BUKTI SSP (Sprint 4)
                    ======================================================== */}
                <div>
                  <label style={lbl}>📎 Upload File Bukti SSP (JPG / PNG / PDF, ≤5 MB)</label>
                  {!fileName ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      style={{
                        border: `2px dashed ${isDragOver ? '#f97316' : '#1e2433'}`,
                        borderRadius: 8,
                        padding: '20px 12px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: isDragOver ? '#f9731610' : '#0d111c',
                        color: '#94a3b8',
                        fontSize: 12,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                      <div style={{ fontWeight: 600 }}>Drag-drop file SSP di sini</div>
                      <div style={{ marginTop: 2 }}>atau klik untuk pilih</div>
                      <div style={{ fontSize: 10, marginTop: 6, color: '#64748b' }}>
                        JPG / PNG / PDF · ≤5 MB
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      />
                    </div>
                  ) : (
                    <div style={{
                      background: '#0d111c',
                      border: '1px solid #22c55e40',
                      borderRadius: 8,
                      padding: 12,
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      {filePreview ? (
                        <img src={filePreview} alt="preview" style={{
                          width: 56, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0,
                        }} />
                      ) : (
                        <div style={{
                          width: 56, height: 56, borderRadius: 6, background: '#1e2433',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                        }}>📄</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600, color: '#22c55e',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {fileName}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          File siap di-upload
                        </div>
                      </div>
                      <button type="button" onClick={clearFile}
                        style={{
                          background: 'transparent', border: 'none', color: '#ef4444',
                          fontSize: 20, cursor: 'pointer', padding: 4,
                        }} title="Hapus">✕</button>
                    </div>
                  )}
                </div>

                {/* URL alternatif (paste manual) */}
                <div>
                  <label style={lbl}>🔗 Atau Paste URL bukti (mis. Google Drive, WA Web)</label>
                  <input style={inp} value={buktiUrl} onChange={(e) => setBuktiUrl(e.target.value)} placeholder="https://..." />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    File yang dipilih otomatis terupload ke bucket <code>bukti-pajak</code>. Paste URL hanya jika upload manual.
                  </div>
                </div>

                {/* Tanggal bayar */}
                <div>
                  <label style={lbl}>📅 Tanggal Bayar ke DJP</label>
                  <input type="date" style={inp} value={tanggalBayar} onChange={(e) => setTanggalBayar(e.target.value)} />
                </div>

                {/* Catatan */}
                <div>
                  <label style={lbl}>📝 Catatan (opsional)</label>
                  <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="cth: Kode billing 12345... dibayar via bank BCA" />
                </div>

                {/* Set LUNAS toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={actionSetLunas} onChange={(e) => setActionSetLunas(e.target.checked)} />
                  <span style={{ fontSize: 14 }}>Set status ke <strong>LUNAS</strong> setelah simpan</span>
                </label>

                {/* Bukti sebelumnya (read-only) */}
                {selected.bukti_url && !fileName && (
                  <div style={{ background: '#0d111c', border: '1px solid #1e2433', borderRadius: 8, padding: 12, fontSize: 12 }}>
                    <strong style={{ color: '#22c55e' }}>📎 Bukti tersimpan:</strong>{' '}
                    <span style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{selected.bukti_url}</span>
                  </div>
                )}

                {/* Progress bar saat upload */}
                {uploadBusy && (
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                      Uploading bukti SSP... {uploadProgress}%
                    </div>
                    <div style={{ background: '#1e2433', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{
                        background: '#22c55e', height: '100%', width: `${uploadProgress}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )}


                <button onClick={save} disabled={busy} style={{
                  background: 'linear-gradient(135deg, #f97316, #ef4444)', border: 'none',
                  color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
                }}>{busy ? '⏳ Menyimpan...' : '💾 Simpan Bukti & Status'}</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/dashboard/pajak/rekap" style={{ color: '#3b82f6', fontSize: 13 }}>← Lihat tabel rekap lengkap</Link>
      </div>
    </div>
  )
}
