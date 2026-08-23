'use client'

/**
 * src/components/dashboard/MobileShell.tsx
 *
 * Wrapper untuk dashboard layout yang nambahkan:
 *   - Hamburger button di mobile (hilang di desktop)
 *   - Sidebar collapse/drawer behavior untuk layar kecil
 *   - Overlay backdrop saat sidebar terbuka di mobile
 *
 * Cara pakai di layout.tsx:
 *   <MobileShell>
 *     <Sidebar ... />
 *     <main>{children}</main>
 *   </MobileShell>
 */

import { useState, useEffect, ReactNode } from 'react'

interface MobileShellProps {
  children: ReactNode
}

export default function MobileShell({ children }: MobileShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect viewport width
  useEffect(() => {
    function checkViewport() {
      setIsMobile(window.innerWidth < 768)
      // Auto-close sidebar di desktop
      if (window.innerWidth >= 768) setSidebarOpen(false)
    }
    checkViewport()
    window.addEventListener('resize', checkViewport)
    return () => window.removeEventListener('resize', checkViewport)
  }, [])

  // Lock body scroll saat sidebar terbuka di mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, sidebarOpen])

  // Close sidebar on Escape
  useEffect(() => {
    if (!sidebarOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [sidebarOpen])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d111c' }}>
      {/* Hamburger button — fixed top-left, mobile only */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 100,
          width: 40,
          height: 40,
          borderRadius: 8,
          background: '#111827',
          border: '1px solid #1e2433',
          color: '#e2e8f0',
          fontSize: 20,
          cursor: 'pointer',
          display: isMobile ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Backdrop overlay saat sidebar terbuka di mobile */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 90,
          }}
        />
      )}

      {/* Mobile toggle context — child components baca via CSS data attr */}
      <div
        data-sidebar-open={sidebarOpen}
        data-is-mobile={isMobile}
        style={{ display: 'flex', width: '100%' }}
      >
        {children}
      </div>
    </div>
  )
}