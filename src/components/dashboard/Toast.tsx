'use client'

/**
 * Toast global component — Sprint 5 Polish UX #5.12
 *
 * API:
 *   import { ToastProvider, useToast } from './Toast'
 *
 *   // Di layout/page yang membungkus client components:
 *   <ToastProvider>
 *     <MyClient />
 *   </ToastProvider>
 *
 *   // Di client component:
 *   const { showToast } = useToast()
 *   showToast('Berhasil disimpan', 'ok')
 *   showToast('Gagal: NPWP invalid', 'err', 5000)  // custom duration
 */

import React, { createContext, useCallback, useContext, useState, useRef, useEffect } from 'react'

export type ToastKind = 'ok' | 'err' | 'info' | 'warn'

export interface ToastItem {
  id: string
  msg: string
  kind: ToastKind
  duration: number
}

interface ToastContextValue {
  showToast: (msg: string, kind?: ToastKind, duration?: number) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast harus dipanggil di dalam <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const showToast = useCallback(
    (msg: string, kind: ToastKind = 'info', duration = 3500) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((cur) => [...cur, { id, msg, kind, duration }])
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss]
  )

  useEffect(() => {
    // Cleanup semua timer saat unmount
    return () => {
      timers.current.forEach((t) => clearTimeout(t))
      timers.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      {/* Render portal-like container di bottom-right */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 9999,
        maxWidth: 400,
      }}
    >
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

const KIND_STYLES: Record<ToastKind, { bg: string; color: string; icon: string }> = {
  ok: { bg: '#22c55e', color: '#fff', icon: '✅' },
  err: { bg: '#ef4444', color: '#fff', icon: '⚠️' },
  info: { bg: '#3b82f6', color: '#fff', icon: 'ℹ️' },
  warn: { bg: '#f59e0b', color: '#fff', icon: '⚠️' },
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const style = KIND_STYLES[toast.kind]

  return (
    <div
      role="alert"
      style={{
        background: style.bg,
        color: style.color,
        padding: '12px 16px',
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 13,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
        animation: 'toastSlideIn 0.25s ease-out',
        maxWidth: 400,
        wordBreak: 'break-word',
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{style.icon}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.msg}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Tutup"
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: style.color,
          width: 20,
          height: 20,
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
          padding: 0,
        }}
      >
        ✕
      </button>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}