/**
 * src/lib/export/xlsx.ts
 * Generic XLSX export helper Sprint 5 — reusable untuk semua laporan.
 *
 * Menggunakan library `xlsx` (SheetJS) yang sudah terinstall.
 *
 * Cara pakai (client-side):
 *   import { exportToXlsx, downloadXlsx } from '@/lib/export/xlsx'
 *   const blob = exportToXlsx({ filename: 'laporan.xlsx', sheets: [...] })
 *   downloadXlsx(blob, 'laporan.xlsx')
 *
 * Cara pakai (server-side API route):
 *   import { exportToXlsxBuffer } from '@/lib/export/xlsx'
 *   const buffer = exportToXlsxBuffer({ sheets: [...] })
 *   return new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-...' } })
 */

import * as XLSX from 'xlsx'

// ============================================================
// TYPES
// ============================================================

export interface XlsxColumn {
  header: string
  key: string
  width?: number  // column width in chars (default 18)
  format?: 'number' | 'currency' | 'percent' | 'date' | 'text'
}

export interface XlsxSheet {
  name: string                       // nama sheet (max 31 char)
  title?: string                     // judul besar di atas tabel
  subtitle?: string                  // subjudul (periode, dll)
  columns: XlsxColumn[]              // definisi kolom
  rows: Record<string, unknown>[]    // data rows
  footerNote?: string                // catatan di bawah tabel
}

export interface XlsxExportOptions {
  filename: string                   // nama file output
  sheets: XlsxSheet[]
  creator?: string                   // metadata (default: 'Ekspedisi Dashboard')
  companyName?: string
}

// ============================================================
// FORMAT HELPERS
// ============================================================

function formatCell(value: unknown, format?: XlsxColumn['format']): unknown {
  if (value === null || value === undefined) return ''
  if (format === 'currency' && typeof value === 'number') {
    return value  // biarkan number — XLSX akan format via cell style
  }
  if (format === 'percent' && typeof value === 'number') return value / 100
  if (format === 'date' && typeof value === 'string') return value
  return value
}

function colLetter(n: number): string {
  let s = ''
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

// ============================================================
// CORE: Build workbook
// ============================================================

function buildWorkbook(opts: XlsxExportOptions): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  // Set metadata
  wb.Props = {
    Title: opts.filename.replace(/\.xlsx$/i, ''),
    Author: opts.creator || 'Ekspedisi Dashboard',
    Company: opts.companyName || 'KPD Ops',
    CreatedDate: new Date(),
  }

  for (const sheet of opts.sheets) {
    // Bangun rows dengan title + subtitle
    const aoa: unknown[][] = []

    if (sheet.title) {
      aoa.push([sheet.title])
      aoa.push([])
    }
    if (sheet.subtitle) {
      aoa.push([sheet.subtitle])
      aoa.push([])
    }

    // Header row
    aoa.push(sheet.columns.map(c => c.header))

    // Data rows
    for (const row of sheet.rows) {
      aoa.push(
        sheet.columns.map(col => formatCell(row[col.key], col.format))
      )
    }

    // Footer
    if (sheet.footerNote) {
      aoa.push([])
      aoa.push([sheet.footerNote])
    }

    // Convert ke worksheet
    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Set column widths
    const colWidths: XLSX.ColInfo[] = []
    sheet.columns.forEach((col, i) => {
      colWidths.push({ wch: col.width ?? 18 })
    })
    ws['!cols'] = colWidths

    // Apply number format ke kolom currency/percent
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    const headerRowIdx = (sheet.title ? 2 : 0) + (sheet.subtitle ? 2 : 0) + 0  // 0-indexed
    const dataStartRow = headerRowIdx + 1
    sheet.columns.forEach((col, i) => {
      if (!col.format) return
      for (let r = dataStartRow; r < range.e.r + 1; r++) {
        const ref = XLSX.utils.encode_cell({ r, c: i })
        const cell = ws[ref]
        if (!cell) continue
        if (col.format === 'currency' && typeof cell.v === 'number') {
          cell.z = '"Rp "#,##0;[Red]-"Rp "#,##0'
        } else if (col.format === 'percent' && typeof cell.v === 'number') {
          cell.z = '0.00%'
        }
      }
    })

    // Merge title cells
    if (sheet.title && sheet.columns.length > 0) {
      ws['!merges'] = [
        {
          s: { r: 0, c: 0 },
          e: { r: 0, c: sheet.columns.length - 1 },
        },
      ]
    }
    if (sheet.subtitle && sheet.columns.length > 0) {
      ws['!merges'] = [
        ...(ws['!merges'] || []),
        {
          s: { r: 2, c: 0 },
          e: { r: 2, c: sheet.columns.length - 1 },
        },
      ]
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }

  return wb
}

// ============================================================
// CLIENT-SIDE: Build Blob untuk di-download
// ============================================================

export function exportToXlsx(opts: XlsxExportOptions): Blob {
  const wb = buildWorkbook(opts)
  // writeFile dengan type 'array' returns ArrayBuffer
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export function downloadXlsx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

// All-in-one helper
export function exportAndDownloadXlsx(opts: XlsxExportOptions) {
  const blob = exportToXlsx(opts)
  downloadXlsx(blob, opts.filename)
}

// ============================================================
// SERVER-SIDE: Build Buffer untuk Response
// ============================================================

export function exportToXlsxBuffer(opts: XlsxExportOptions): ArrayBuffer {
  const wb = buildWorkbook(opts)
  // Buffer (Node runtime)
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as ArrayBuffer
}
