'use client'

/**
 * FileViewerModal.tsx — Lightbox viewer untuk lihat file nota / SSP full-screen.
 *
 * Sprint 4 Task 4.14.
 *
 * Cara pakai:
 *   <FileViewerModal open={isOpen} onClose={() => setOpen(false)} url={signedUrl} filename="nota-wifi.jpg" mimeType="image/jpeg" />
 *
 * Behavior:
 *   - Image: render <img> dengan max-width layar
 *   - PDF: render <iframe> dengan src URL
 *   - Else: tampilkan link "Download file"
 *   - Esc / klik backdrop → tutup
 */

import { useEffect } from 'react'

export interface FileViewerModalProps {
  open: boolean
  onClose: () => void
  url: string
  filename: string
  mimeType?: string
}

export default function FileViewerModal({
  open,
  onClose,
  url,
  filename,
  mimeType,
}: FileViewerModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  // Lock body scroll
  if (typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden'
  }

  const isImage = mimeType?.startsWith('image/') ?? /\.(jpe?g|png|webp|gif|bmp)$/i.test(filename)
  const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(filename)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.92)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        title="Tutup (Esc)"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff',
          fontSize: 22,
          width: 40,
          height: 40,
          borderRadius: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {/* Filename */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 16,
        right: 80,
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }} title={filename}>
        📎 {filename}
      </div>

      {/* Content area */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '95vw',
          maxHeight: '88vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d111c',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={filename}
            style={{
              maxWidth: '95vw',
              maxHeight: '88vh',
              objectFit: 'contain',
            }}
          />
        ) : isPdf ? (
          <iframe
            src={url}
            title={filename}
            style={{
              width: '90vw',
              height: '85vh',
              border: 'none',
              background: '#fff',
            }}
          />
        ) : (
          <div style={{
            color: '#e2e8f0',
            fontSize: 14,
            padding: 32,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <div style={{ marginBottom: 8 }}>File tidak bisa di-preview</div>
            <a
              href={url}
              download={filename}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: '#f97316',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 6,
                textDecoration: 'none',
                marginTop: 8,
                fontWeight: 600,
              }}
            >
              ⬇ Download {filename}
            </a>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        color: '#94a3b8',
        fontSize: 12,
      }}>
        <a
          href={url}
          download={filename}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#1e2433',
            border: '1px solid #2d3748',
            color: '#94a3b8',
            padding: '6px 12px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 12,
          }}
        >
          ⬇ Download
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: '#1e2433',
            border: '1px solid #2d3748',
            color: '#94a3b8',
            padding: '6px 12px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 12,
          }}
        >
          🔗 Buka di tab baru
        </a>
        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>
          Tekan Esc atau klik di luar untuk tutup
        </span>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
