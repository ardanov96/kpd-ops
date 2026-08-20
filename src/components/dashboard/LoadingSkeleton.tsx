'use client'

/**
 * Komponen Sprint 5 — Polish UX #5.11 Loading skeleton
 * Tampilkan placeholder shimmering saat data dimuat.
 */

import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: number
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, className, style }: SkeletonProps) {
  return (
    <>
      <div
        className={className}
        style={{
          width,
          height,
          borderRadius,
          background: 'linear-gradient(90deg, #1e2433 0%, #2d3748 50%, #1e2433 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          display: 'inline-block',
          ...style,
        }}
      />
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  )
}

export function CardSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{
      background: '#111827',
      border: '1px solid #1e2433',
      borderRadius: 12,
      padding: 20,
    }}>
      {children || <><Skeleton width="60%" height={20} /><div style={{ height: 8 }} /><Skeleton width="40%" height={14} /></>}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2433' }}>
        <Skeleton width="30%" height={16} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1e2433',
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 16,
        }}>
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} width="80%" height={12} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default Skeleton
