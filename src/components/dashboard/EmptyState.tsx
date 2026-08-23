'use client'

/**
 * Komponen Sprint 5 — Polish UX #5.10 Empty state
 * Tampilkan ilustrasi + pesan ajakan input saat list kosong.
 *
 * Bisa dipakai dengan CTA link ATAU callback button.
 *
 *   <EmptyState
 *     icon="📭"
 *     title="Belum ada data"
 *     description="Tambah data dulu untuk mulai"
 *     ctaLabel="Tambah Data"
 *     ctaHref="/dashboard/akunting/expense"
 *   />
 *
 *   <EmptyState
 *     icon="🔁"
 *     title="Belum ada template"
 *     ctaLabel="Tambah Template"
 *     onCta={() => setShowForm(true)}
 *   />
 */

import React from 'react'
import Link from 'next/link'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  /** Callback untuk button (alternatif dari ctaHref) */
  onCta?: () => void
  secondaryLabel?: string
  secondaryHref?: string
  onSecondary?: () => void
  /** Ukuran kompak (untuk inline di tabel) */
  compact?: boolean
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
  secondaryLabel,
  secondaryHref,
  onSecondary,
  compact = false,
}: EmptyStateProps) {
  const padding = compact ? '24px 16px' : '48px 20px'
  const iconSize = compact ? 40 : 56

  const ctaStyle: React.CSSProperties = {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #f97316, #ef4444)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
  }

  const secondaryStyle: React.CSSProperties = {
    display: 'inline-block',
    marginLeft: ctaHref || onCta ? 8 : 0,
    background: '#1e2433',
    border: '1px solid #2d3748',
    color: '#94a3b8',
    padding: '8px 16px',
    borderRadius: 8,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  }

  const renderCta = () => {
    if (!ctaLabel) return null
    if (ctaHref) {
      return (
        <Link href={ctaHref} style={ctaStyle}>
          {ctaLabel}
        </Link>
      )
    }
    if (onCta) {
      return (
        <button onClick={onCta} style={ctaStyle}>
          {ctaLabel}
        </button>
      )
    }
    return null
  }

  const renderSecondary = () => {
    if (!secondaryLabel) return null
    if (secondaryHref) {
      return (
        <Link href={secondaryHref} style={secondaryStyle}>
          {secondaryLabel}
        </Link>
      )
    }
    if (onSecondary) {
      return (
        <button onClick={onSecondary} style={secondaryStyle}>
          {secondaryLabel}
        </button>
      )
    }
    return null
  }

  return (
    <div style={{
      textAlign: 'center',
      padding,
      color: '#94a3b8',
    }}>
      <div style={{ fontSize: iconSize, marginBottom: 12, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{title}</div>
      {description && (
        <div style={{ fontSize: compact ? 12 : 13, maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
        {renderCta()}
        {renderSecondary()}
      </div>
    </div>
  )
}