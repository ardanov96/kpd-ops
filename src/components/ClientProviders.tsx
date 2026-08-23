'use client'

/**
 * src/components/ClientProviders.tsx
 *
 * Client-side wrapper yang membungkus seluruh app dengan ToastProvider.
 * Dipakai di app/layout.tsx untuk inject toast context ke semua halaman.
 *
 * Layout design:
 *   app/layout.tsx (server component)
 *     └─ <body>
 *          └─ <ClientProviders>  ← komponen client ini
 *               └─ {children}     ← semua halaman (server + client components)
 *
 * Kenapa dipisah dari root layout?
 *   - Root layout adalah server component (tidak bisa pakai context)
 *   - ToastProvider butuh client side (useState, useEffect, useRef)
 *   - Dengan wrapper client component ini, kita bisa pasang ToastProvider di root
 */

import React from 'react'
import { ToastProvider } from './dashboard/Toast'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}