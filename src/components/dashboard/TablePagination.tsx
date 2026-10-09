'use client'

import React from 'react'

export interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  itemLabel?: string
}

export default function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'data',
}: TablePaginationProps) {
  if (totalItems <= 0) return null

  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  // Smart page range with ellipsis
  function getPageNumbers(): (number | string)[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | string)[] = []
    const delta = 1

    const left = Math.max(1, currentPage - delta)
    const right = Math.min(totalPages, currentPage + delta)

    if (left > 1) {
      pages.push(1)
      if (left > 2) pages.push('…')
    }

    for (let i = left; i <= right; i++) {
      pages.push(i)
    }

    if (right < totalPages) {
      if (right < totalPages - 1) pages.push('…')
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: '1px solid #1e2433',
        background: '#0d111c',
        borderRadius: '0 0 12px 12px',
        fontSize: 12,
        color: '#94a3b8',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      {/* Left: Info and Page Size Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span>
          Menampilkan <strong style={{ color: '#f1f5f9' }}>{start}–{end}</strong> dari{' '}
          <strong style={{ color: '#f1f5f9' }}>{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && pageSizeOptions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#64748b' }}>Baris:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                background: '#1e2433',
                border: '1px solid #2d3748',
                color: '#e2e8f0',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 12,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / hal
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Navigation Buttons */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* First Page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1}
            title="Halaman Pertama"
            style={btnStyle(currentPage <= 1)}
          >
            «
          </button>

          {/* Prev Page */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Halaman Sebelumnya"
            style={btnStyle(currentPage <= 1)}
          >
            ‹ Prev
          </button>

          {/* Page numbers */}
          {pageNumbers.map((p, idx) => {
            if (p === '…') {
              return (
                <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#475569', fontSize: 12 }}>
                  …
                </span>
              )
            }
            const pageNum = p as number
            const isActive = pageNum === currentPage

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                style={{
                  ...btnStyle(false),
                  minWidth: 30,
                  height: 30,
                  background: isActive ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#1e2433',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  fontWeight: isActive ? 700 : 400,
                  borderColor: isActive ? '#f97316' : '#2d3748',
                }}
              >
                {pageNum}
              </button>
            )
          })}

          {/* Next Page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Halaman Berikutnya"
            style={btnStyle(currentPage >= totalPages)}
          >
            Next ›
          </button>

          {/* Last Page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title="Halaman Terakhir"
            style={btnStyle(currentPage >= totalPages)}
          >
            »
          </button>
        </div>
      )}
    </div>
  )
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: '#1e2433',
    border: '1px solid #2d3748',
    color: disabled ? '#475569' : '#94a3b8',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.15s ease',
  }
}
