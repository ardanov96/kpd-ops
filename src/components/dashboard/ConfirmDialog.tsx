'use client'

/**
 * ConfirmDialog — Sprint 5 Polish UX #5.13
 *
 * Modal konfirmasi reusable dengan tema dark.
 * Bisa dipakai dengan promise-based atau callback biasa.
 *
 *   <ConfirmDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={async () => { await delete(); }}
 *     title="Hapus transaksi?"
 *     description="Tindakan ini tidak bisa dibatalkan."
 *     variant="danger"
 *   />
 *
 * Atau via hook:
 *   const { confirm } = useConfirm()
 *   if (await confirm({ title: 'Hapus?', description: '...' })) { ... }
 */

import React, { useEffect, useState } from 'react'

export type ConfirmVariant = 'danger' | 'warning' | 'info'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  /** Disabled saat proses async (loading state di button confirm) */
  busy?: boolean
}

const VARIANT_STYLES: Record<ConfirmVariant, { icon: string; accent: string }> = {
  danger: { icon: '🗑️', accent: '#ef4444' },
  warning: { icon: '⚠️', accent: '#f59e0b' },
  info: { icon: '❓', accent: '#3b82f6' },
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'danger',
  busy = false,
}: ConfirmDialogProps) {
  const [internalBusy, setInternalBusy] = useState(false)
  const isBusy = busy || internalBusy

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, isBusy, onClose])

  if (!open) return null

  const style = VARIANT_STYLES[variant]

  async function handleConfirm() {
    setInternalBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      // Caller yang handle error toast; jangan auto-close kalau throw
    } finally {
      setInternalBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => !isBusy && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'confirmFadeIn 0.18s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#111827',
          border: '1px solid #1e2433',
          borderRadius: 12,
          padding: 24,
          width: '90%',
          maxWidth: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: `${style.accent}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {style.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>{title}</h3>
            {description && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                {description}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            style={{
              background: '#1e2433',
              border: '1px solid #2d3748',
              color: '#94a3b8',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.5 : 1,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy}
            style={{
              background: style.accent,
              border: 'none',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: isBusy ? 'wait' : 'pointer',
              opacity: isBusy ? 0.7 : 1,
              minWidth: 100,
            }}
          >
            {isBusy ? '⏳ Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes confirmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/**
 * useConfirm — hook untuk pakai ConfirmDialog via promise
 *
 *   const { confirm, ConfirmNode } = useConfirm()
 *   const ok = await confirm({ title: 'Hapus?', variant: 'danger' })
 *   if (ok) { doDelete() }
 *   return <>{ConfirmNode}<OtherUI /></>
 */
type ConfirmOpts = Pick<ConfirmDialogProps, 'title' | 'description' | 'confirmLabel' | 'cancelLabel' | 'variant'>

interface ConfirmState {
  open: boolean
  opts: ConfirmOpts
  resolver: ((v: boolean) => void) | null
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    opts: { title: '' },
    resolver: null,
  })

  function confirm(
    dialogOpts: Omit<ConfirmDialogProps, 'open' | 'onClose' | 'onConfirm'>
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, opts: dialogOpts, resolver: resolve })
    })
  }

  function handleClose() {
    if (state.resolver) state.resolver(false)
    setState((s) => ({ ...s, open: false, resolver: null }))
  }

  function handleConfirm() {
    if (state.resolver) state.resolver(true)
    setState((s) => ({ ...s, open: false, resolver: null }))
  }

  const ConfirmNode = (
    <ConfirmDialog
      open={state.open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={state.opts.title || ''}
      description={state.opts.description}
      confirmLabel={state.opts.confirmLabel}
      cancelLabel={state.opts.cancelLabel}
      variant={state.opts.variant}
    />
  )

  return { confirm, ConfirmNode }
}