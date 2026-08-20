/**
 * src/lib/export/pdf.tsx
 * PDF report helper Sprint 5 — reusable untuk SPT + laporan internal.
 *
 * Menggunakan @react-pdf/renderer (client-side, no Puppeteer).
 *
 * Catatan:
 *   - PDF generator berbasis React component → type-safe + gaya konsisten.
 *   - Untuk download di client, gunakan `pdf(<Template />).toBlob()` lalu trigger download.
 *   - Untuk SPT ke konsultan pajak: format generik dengan header SPT, tabel, footer.
 */

'use client'

import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import React from 'react'

// ============================================================
// STYLES
// ============================================================

const colors = {
  primary: '#1e40af',
  text: '#1f2937',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  bgHeader: '#f3f4f6',
  bgAlt: '#f9fafb',
  green: '#16a34a',
  red: '#dc2626',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: colors.text,
  },

  // Header
  headerContainer: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 10,
    marginBottom: 20,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.primary,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: 8,
  },
  reportSubtitle: {
    fontSize: 10,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 4,
  },

  // WP info block
  wpInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 8,
    backgroundColor: colors.bgHeader,
    borderRadius: 2,
  },
  wpInfoLeft: { fontSize: 9 },
  wpInfoRight: { fontSize: 9, textAlign: 'right' },
  wpInfoLabel: { color: colors.textMuted, fontSize: 8 },

  // Table
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    color: '#ffffff',
    fontWeight: 700,
    padding: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 6,
  },
  tableRowAlt: {
    backgroundColor: colors.bgAlt,
  },
  tableCell: { fontSize: 9, paddingHorizontal: 4 },
  tableCellHeader: { fontSize: 9, fontWeight: 700, paddingHorizontal: 4, color: '#ffffff' },

  // Totals row
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgHeader,
    fontWeight: 700,
    padding: 6,
    marginTop: 4,
  },

  // Footer
  footerContainer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: colors.textMuted,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },

  // Section
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 6,
    color: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },

  // Numbers
  textRight: { textAlign: 'right' },
  textGreen: { color: colors.green, fontWeight: 700 },
  textRed: { color: colors.red, fontWeight: 700 },

  // Signature
  signatureBlock: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureCol: { width: '40%', fontSize: 9, textAlign: 'center' },
  signatureLine: {
    marginTop: 60,
    borderTopWidth: 1,
    borderTopColor: colors.text,
    paddingTop: 4,
  },
  signatureLabel: { fontSize: 8, color: colors.textMuted },

  // Misc
  noteBox: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 2,
    fontSize: 8,
    color: '#78350f',
  },
})

// ============================================================
// TYPES
// ============================================================

export interface PdfWPInfo {
  nama_wp: string
  npwp?: string
  alamat?: string
  outlet_nama: string
  outlet_kode: string
}

export interface PdfTableColumn {
  header: string
  width: string  // flex value, mis. '2' atau '*'
  align?: 'left' | 'right' | 'center'
  bold?: boolean
}

export interface PdfTableRow {
  cells: (string | number)[]
  isTotal?: boolean
  isEmpty?: boolean
}

export interface PdfExportOptions {
  reportTitle: string
  reportSubtitle?: string
  wpInfo?: PdfWPInfo
  sections?: PdfSection[]
  columns: PdfTableColumn[]
  rows: PdfTableRow[]
  footerNote?: string
  generatedAt?: Date
  customFooter?: string
}

export interface PdfSection {
  title: string
  rows: PdfTableRow[]
  totals?: PdfTableRow[]
}

// ============================================================
// COMPONENTS
// ============================================================

function TableCell({
  children,
  width,
  align = 'left',
  bold = false,
  isHeader = false,
}: {
  children?: React.ReactNode
  width: string
  align?: 'left' | 'right' | 'center'
  bold?: boolean
  isHeader?: boolean
}) {
  return (
    <Text
      style={{
        ...(isHeader ? styles.tableCellHeader : styles.tableCell),
        width,
        textAlign: align,
        fontWeight: bold ? 700 : (isHeader ? 700 : 'normal'),
      }}
    >
      {children}
    </Text>
  )
}

function PdfTable({ columns, rows, totals }: { columns: PdfTableColumn[]; rows: PdfTableRow[]; totals?: PdfTableRow[] }) {
  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeader}>
        {columns.map((col, i) => (
          <TableCell key={`h-${i}`} width={col.width} align={col.align} isHeader>
            {col.header}
          </TableCell>
        ))}
      </View>

      {/* Body */}
      {rows.map((row, ri) => (
        <View
          key={`r-${ri}`}
          style={[styles.tableRow, ri % 2 === 1 ? styles.tableRowAlt : {}]}
          wrap={false}
        >
          {row.cells.map((cell, ci) => (
            <TableCell
              key={`r-${ri}-${ci}`}
              width={columns[ci]?.width || '*'}
              align={columns[ci]?.align || 'left'}
              bold={row.isTotal || columns[ci]?.bold}
            >
              {cell}
            </TableCell>
          ))}
        </View>
      ))}

      {/* Totals */}
      {totals && totals.length > 0 && (
        <>
          {totals.map((row, ri) => (
            <View key={`t-${ri}`} style={styles.totalsRow} wrap={false}>
              {row.cells.map((cell, ci) => (
                <TableCell
                  key={`t-${ri}-${ci}`}
                  width={columns[ci]?.width || '*'}
                  align={columns[ci]?.align || 'left'}
                  bold
                >
                  {cell}
                </TableCell>
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  )
}

// ============================================================
// MAIN TEMPLATE
// ============================================================

export function PdfReportTemplate(opts: PdfExportOptions) {
  const generatedAt = opts.generatedAt || new Date()
  const formatIDR = (n: number | string | undefined): string => {
    if (n === '' || n === null || n === undefined) return ''
    const num = typeof n === 'string' ? Number(n) : n
    if (isNaN(num)) return String(n)
    return 'Rp ' + Math.round(num).toLocaleString('id-ID')
  }

  return (
    <Document
      title={opts.reportTitle}
      author={opts.wpInfo?.nama_wp || 'Owner'}
      creator="Ekspedisi Dashboard"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer} fixed>
          <Text style={styles.companyName}>{opts.wpInfo?.nama_wp || 'Ekspedisi Dashboard'}</Text>
          {opts.wpInfo?.npwp && <Text style={{ fontSize: 9 }}>NPWP: {opts.wpInfo.npwp}</Text>}
          <Text style={styles.reportTitle}>{opts.reportTitle}</Text>
          {opts.reportSubtitle && <Text style={styles.reportSubtitle}>{opts.reportSubtitle}</Text>}
        </View>

        {/* WP Info */}
        {opts.wpInfo && (
          <View style={styles.wpInfoContainer}>
            <View style={styles.wpInfoLeft}>
              <Text style={styles.wpInfoLabel}>OUTLET</Text>
              <Text>
                {opts.wpInfo.outlet_nama} ({opts.wpInfo.outlet_kode})
              </Text>
            </View>
            <View style={styles.wpInfoRight}>
              <Text style={styles.wpInfoLabel}>TANGGAL CETAK</Text>
              <Text>
                {generatedAt.toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        )}

        {/* Sections + Single Table */}
        {opts.sections ? (
          opts.sections.map((sec, si) => (
            <View key={`sec-${si}`} wrap={false}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              <PdfTable columns={opts.columns} rows={sec.rows} totals={sec.totals} />
            </View>
          ))
        ) : (
          <PdfTable columns={opts.columns} rows={opts.rows} />
        )}

        {/* Footer note */}
        {opts.footerNote && <Text style={styles.noteBox}>📌 {opts.footerNote}</Text>}

        {/* Signature */}
        {opts.wpInfo && (
          <View style={styles.signatureBlock}>
            <View style={styles.signatureCol}>
              <Text>Dibuat oleh,</Text>
              <View style={styles.signatureLine}>
                <Text>{opts.wpInfo.nama_wp}</Text>
                <Text style={styles.signatureLabel}>Owner</Text>
              </View>
            </View>
            <View style={styles.signatureCol}>
              <Text>Diverifikasi oleh,</Text>
              <View style={styles.signatureLine}>
                <Text>______________________</Text>
                <Text style={styles.signatureLabel}>Konsultan Pajak</Text>
              </View>
            </View>
          </View>
        )}

        {/* Page footer */}
        <View style={styles.footerContainer} fixed>
          <Text>{opts.customFooter || 'Dihasilkan otomatis oleh Ekspedisi Dashboard'}</Text>
          <Text
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => (
              `Halaman ${pageNumber} dari ${totalPages}`
            )}
          />
        </View>
      </Page>
    </Document>
  )
}

// ============================================================
// HELPER: download dari client
// ============================================================

import dynamic from 'next/dynamic'

// Lazy import @react-pdf/renderer (PDFDownloadLink) untuk client-only
export const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false }
) as unknown as typeof import('@react-pdf/renderer').PDFDownloadLink

export const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false }
) as unknown as typeof import('@react-pdf/renderer').PDFViewer

// Re-export untuk type saja
export { Document, Page, Text, View, StyleSheet, Image }
