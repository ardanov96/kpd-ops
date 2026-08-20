'use client'

/**
 * Komponen kecil untuk tombol "Lihat" file nota/SSP di list.
 * Klik → minta signed URL dari /api/storage/get-signed-url → buka FileViewerModal.
 *
 * Cara pakai:
 *   <ViewFileButton bucket="nota-expense" path={t.lampiran_url} filename="nota.jpg" />
 *
 * Kalau path null (tidak ada file), tombol tidak render.
 */

import { useState } from 'react'
import FileViewerModal from './FileViewerModal'

export type ViewBucket = 'nota-expense' | 'bukti-pajak'

export default function ViewFileButton({
  bucket,
  path,
  filename,
  mimeType,
  label = '📎 Lihat',
}: {
  bucket: ViewBucket
  path: string | null | undefined
  filename?: string
  mimeType?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!path) return null

  const fname = filename || path.split('/').pop() || 'file'

  async function handleClick() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/storage/get-signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, path, expiry: 3600 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal ambil URL')
      setUrl(json.url)
      setOpen(true)
    } catch (e: any) {
      setErr(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        title={path}
        style={{
          background: '#1e2433',
          border: '1px solid #2d3748',
          color: loading ? '#64748b' : '#3b82f6',
          padding: '3px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? '⏳ Loading...' : label}
      </button>
      {err && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#ef4444', color: '#fff', padding: '10px 16px',
          borderRadius: 8, fontSize: 13, maxWidth: 320,
        }}>
          ⚠ {err}
        </div>
      )}
      <FileViewerModal
        open={open}
        onClose={() => setOpen(false)}
        url={url}
        filename={fname}
        mimeType={mimeType}
      />
    </>
  )
}
