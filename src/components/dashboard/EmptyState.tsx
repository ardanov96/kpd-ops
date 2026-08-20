'use client'

/**
 * Komponen Sprint 5 — Polish UX #5.10 Empty state
 * Tampilkan ilustrasi + pesan ajakan input saat list kosong.
 */

import React from 'react'
import Link from 'next/link'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  secondaryLabel?: string
  secondaryHref?: string
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  ctaLabel,
  ctaHref,
  secondaryLabel,
  secondaryHref,
}: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 20px',
      color: '#94a3b8',
    }}>
      <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {(ctaLabel && ctaHref) && (
        <Link
          href={ctaHref}
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #f97316, #ef4444)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {ctaLabel}
        </Link>
      )}
      {(secondaryLabel && secondaryHref) && (
        <Link
          href={secondaryHref}
          style={{
            display: 'inline-block',
            marginLeft: ctaHref ? 8 : 0,
            background: '#1e2433',
            border: '1px solid #2d3748',
            color: '#94a3b8',
            padding: '8px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {secondaryLabel}
        </Link>
      )}
    </div>
  )
}
