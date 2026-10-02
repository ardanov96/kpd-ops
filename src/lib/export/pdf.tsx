/**
 * src/lib/export/pdf.tsx
 * PDF report helper untuk Laporan Keuangan Ekspedisi (Laba Rugi, Cashflow, Neraca).
 *
 * Menggunakan @react-pdf/renderer (client-side, dynamic import).
 * Menghasilkan PDF standar akuntansi resmi yang rapi, profesional, dan proporsional.
 */

'use client'

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import dynamic from 'next/dynamic'

// ============================================================
// STYLES & COLOR PALETTE
// ============================================================

const colors = {
  primary: '#1e3a8a',       // Deep corporate navy
  primaryLight: '#eff6ff',
  primaryBorder: '#bfdbfe',
  text: '#1e293b',          // Slate 800
  textMuted: '#64748b',     // Slate 500
  border: '#cbd5e1',        // Slate 300
  borderLight: '#e2e8f0',   // Slate 200
  bgAlt: '#f8fafc',         // Slate 50
  bgHeader: '#f1f5f9',      // Slate 100
  green: '#15803d',         // Green 700
  greenBg: '#f0fdf4',
  greenBorder: '#bbf7d0',
  red: '#b91c1c',           // Red 700
  redBg: '#fef2f2',
  redBorder: '#fecaca',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: colors.text,
    backgroundColor: '#ffffff',
  },

  // Header Bar
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 10,
    marginBottom: 10,
  },
  companyName: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  companySub: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 2,
  },
  reportTitleBlock: {
    alignItems: 'flex-end',
  },
  reportTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
  },
  reportPeriode: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginTop: 2,
  },

  // Meta Info Bar
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 4,
    padding: 7,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'column',
  },
  metaLabel: {
    fontSize: 6.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    marginTop: 1,
  },

  // KPI Summary Cards
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  kpiSub: {
    fontSize: 6.5,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Table
  tableContainer: {
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 2,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
  },
  tableSectionHeader: {
    flexDirection: 'row',
    backgroundColor: colors.bgHeader,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  tableSectionTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    backgroundColor: colors.bgAlt,
  },
  cellText: {
    fontSize: 7.5,
  },
  cellTextBold: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },
  subtotalRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    marginBottom: 4,
  },

  // Grand Result Box
  grandTotalRow: {
    flexDirection: 'row',
    borderRadius: 4,
    borderWidth: 1.5,
    paddingVertical: 5.5,
    paddingHorizontal: 8,
    marginTop: 3,
    marginBottom: 10,
    alignItems: 'center',
  },

  // 2-Column Bottom Summary (Cashflow & Neraca)
  bottomGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 4,
    padding: 7,
    backgroundColor: colors.bgAlt,
  },
  summaryBoxTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 3,
    marginBottom: 4,
  },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  miniLabel: {
    fontSize: 7,
    color: colors.textMuted,
  },
  miniValue: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },

  // Signature Block
  signatureBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
  },
  signatureCol: {
    width: '36%',
    textAlign: 'center',
    alignItems: 'center',
  },
  signatureRole: {
    fontSize: 7,
    color: colors.textMuted,
    marginBottom: 36,
  },
  signatureLine: {
    width: '100%',
    borderTopWidth: 0.8,
    borderTopColor: colors.text,
    paddingTop: 3,
    alignItems: 'center',
  },
  signatureName: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },
  signatureSub: {
    fontSize: 6.5,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Footer
  footerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 6.5,
    color: colors.textMuted,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderLight,
    paddingTop: 5,
  },
})

// ============================================================
// FORMAT HELPERS
// ============================================================

export function formatIDR(n: number | string | undefined | null): string {
  if (n === null || n === undefined || n === '') return 'Rp. 0,-'
  const num = typeof n === 'string' ? Number(n) : n
  if (isNaN(num)) return String(n)
  const formatted = Math.round(Math.abs(num)).toLocaleString('id-ID')
  return num < 0 ? `-Rp. ${formatted},-` : `Rp. ${formatted},-`
}

export function formatPeriodeIndo(periodeStr: string): string {
  if (!periodeStr) return ''
  const parts = periodeStr.split('-')
  if (parts.length < 2) return periodeStr
  const year = parts[0]
  const month = parts[1]
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  const mIndex = parseInt(month, 10) - 1
  if (mIndex >= 0 && mIndex < 12) {
    return `${months[mIndex]} ${year} (${periodeStr})`
  }
  return periodeStr
}

export function formatTanggalCetak(d: Date): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  const day = String(d.getDate()).padStart(2, '0')
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year}, ${hours}:${minutes} WIB`
}

// ============================================================
// INTERFACES & TYPES
// ============================================================

export interface PdfWPInfo {
  nama_wp: string
  npwp?: string
  alamat?: string
  outlet_nama: string
  outlet_kode: string
}

export interface PdfFinancialReportData {
  outlet: {
    id?: string
    kode: string
    nama: string
  }
  selectedPeriode: string
  income: number
  expense: number
  laba: number
  incomeItems: Array<{
    kategori_kode: string
    kategori_nama: string
    nominal_income: number | string
    jumlah_transaksi?: number | string
  }>
  expenseItems: Array<{
    kategori_kode: string
    kategori_nama: string
    nominal_expense: number | string
    jumlah_transaksi?: number | string
  }>
  cashflow?: Array<{
    metode: string
    cashflow: number | string
  }>
  neraca?: {
    total_aset_kas?: number | string
    total_modal_pemilik?: number | string
    total_equity?: number | string
    selisih?: number | string
  } | null
  wpInfo?: PdfWPInfo
  generatedAt?: Date
}

// Legacy table types for backwards compatibility
export interface PdfTableColumn {
  header: string
  width: string
  align?: 'left' | 'right' | 'center'
  bold?: boolean
}

export interface PdfTableRow {
  cells: (string | number)[]
  isTotal?: boolean
  isEmpty?: boolean
}

export interface PdfSection {
  title: string
  rows: PdfTableRow[]
  totals?: PdfTableRow[]
}

export interface PdfExportOptions {
  reportTitle?: string
  reportSubtitle?: string
  wpInfo?: PdfWPInfo
  sections?: PdfSection[]
  columns?: PdfTableColumn[]
  rows?: PdfTableRow[]
  footerNote?: string
  generatedAt?: Date
  customFooter?: string
  reportData?: PdfFinancialReportData
}

// ============================================================
// FINANCIAL REPORT COMPONENT
// ============================================================

function FinancialReportView({ data }: { data: PdfFinancialReportData }) {
  const generatedAt = data.generatedAt || new Date()
  const isProfit = data.laba >= 0
  const periodeLabel = formatPeriodeIndo(data.selectedPeriode)

  const totalIncomeTrx = data.incomeItems.reduce(
    (acc, it) => acc + (Number(it.jumlah_transaksi) || 1),
    0
  )
  const totalExpenseTrx = data.expenseItems.reduce(
    (acc, it) => acc + (Number(it.jumlah_transaksi) || 1),
    0
  )

  return (
    <Document title={`Laporan Keuangan ${data.outlet.kode} ${data.selectedPeriode}`}>
      <Page size="A4" style={styles.page}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.companyName}>{data.outlet.nama}</Text>
            <Text style={styles.companySub}>Sistem Pembukuan & Keuangan Terpadu</Text>
          </View>
          <View style={styles.reportTitleBlock}>
            <Text style={styles.reportTitle}>LAPORAN KEUANGAN</Text>
            <Text style={styles.reportPeriode}>Periode {periodeLabel}</Text>
          </View>
        </View>

        {/* Metadata Bar */}
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Outlet ID / Kode</Text>
            <Text style={styles.metaValue}>{data.outlet.kode}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Basis Pembukuan</Text>
            <Text style={styles.metaValue}>Kas Masuk & Beban Riil</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Mata Uang</Text>
            <Text style={styles.metaValue}>IDR (Rupiah)</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Tanggal Cetak</Text>
            <Text style={styles.metaValue}>{formatTanggalCetak(generatedAt)}</Text>
          </View>
        </View>

        {/* 3 KPI Highlights */}
        <View style={styles.kpiRow} wrap={false}>
          <View style={[styles.kpiCard, { borderColor: colors.greenBorder, backgroundColor: colors.greenBg }]}>
            <Text style={[styles.kpiLabel, { color: colors.green }]}>Total Pendapatan (Income)</Text>
            <Text style={[styles.kpiValue, { color: colors.green }]}>{formatIDR(data.income)}</Text>
            <Text style={styles.kpiSub}>Komisi Booking & Diskon</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: colors.redBorder, backgroundColor: colors.redBg }]}>
            <Text style={[styles.kpiLabel, { color: colors.red }]}>Total Beban (Expense)</Text>
            <Text style={[styles.kpiValue, { color: colors.red }]}>{formatIDR(data.expense)}</Text>
            <Text style={styles.kpiSub}>Beban Operasional Outlet</Text>
          </View>

          <View
            style={[
              styles.kpiCard,
              {
                borderColor: isProfit ? colors.greenBorder : colors.redBorder,
                backgroundColor: isProfit ? colors.greenBg : colors.redBg,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { color: isProfit ? colors.green : colors.red }]}>
              {isProfit ? 'Laba Bersih Operasional' : 'Defisit / Rugi Operasional'}
            </Text>
            <Text style={[styles.kpiValue, { color: isProfit ? colors.green : colors.red }]}>
              {formatIDR(data.laba)}
            </Text>
            <Text style={styles.kpiSub}>Status: {isProfit ? 'Surplus Operasional' : 'Defisit Operasional'}</Text>
          </View>
        </View>

        {/* Laba Rugi Table */}
        <View style={styles.tableContainer}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Kode Akun</Text>
            <Text style={[styles.tableHeaderCell, { width: '50%' }]}>Kategori / Nama Akun</Text>
            <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'center' }]}>Frekuensi</Text>
            <Text style={[styles.tableHeaderCell, { width: '22%', textAlign: 'right' }]}>Nominal (IDR)</Text>
          </View>

          {/* Section I: Pendapatan */}
          <View style={styles.tableSectionHeader}>
            <Text style={styles.tableSectionTitle}>I. PENDAPATAN USAHA (REVENUE)</Text>
          </View>
          {data.incomeItems.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.cellText, { width: '100%', color: colors.textMuted, fontStyle: 'italic' }]}>
                Tidak ada catatan pendapatan pada periode ini.
              </Text>
            </View>
          ) : (
            data.incomeItems.map((item, idx) => (
              <View key={item.kategori_kode} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.cellTextBold, { width: '14%', color: colors.textMuted }]}>{item.kategori_kode}</Text>
                <Text style={[styles.cellText, { width: '50%' }]}>{item.kategori_nama}</Text>
                <Text style={[styles.cellText, { width: '14%', textAlign: 'center', color: colors.textMuted }]}>
                  {item.jumlah_transaksi ? `${item.jumlah_transaksi} Trx` : '-'}
                </Text>
                <Text style={[styles.cellTextBold, { width: '22%', textAlign: 'right', color: colors.green }]}>
                  {formatIDR(item.nominal_income)}
                </Text>
              </View>
            ))
          )}
          {/* Subtotal Pendapatan */}
          <View style={styles.subtotalRow} wrap={false}>
            <Text style={[styles.cellTextBold, { width: '64%', color: colors.primary }]}>
              SUBTOTAL PENDAPATAN USAHA
            </Text>
            <Text style={[styles.cellTextBold, { width: '14%', textAlign: 'center', color: colors.textMuted }]}>
              {totalIncomeTrx > 0 ? `${totalIncomeTrx} Trx` : '-'}
            </Text>
            <Text style={[styles.cellTextBold, { width: '22%', textAlign: 'right', color: colors.green }]}>
              {formatIDR(data.income)}
            </Text>
          </View>

          {/* Section II: Beban */}
          <View style={styles.tableSectionHeader}>
            <Text style={styles.tableSectionTitle}>II. BEBAN OPERASIONAL (OPERATIONAL EXPENSES)</Text>
          </View>
          {data.expenseItems.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.cellText, { width: '100%', color: colors.textMuted, fontStyle: 'italic' }]}>
                Tidak ada catatan beban operasional pada periode ini.
              </Text>
            </View>
          ) : (
            data.expenseItems.map((item, idx) => (
              <View key={item.kategori_kode} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.cellTextBold, { width: '14%', color: colors.textMuted }]}>{item.kategori_kode}</Text>
                <Text style={[styles.cellText, { width: '50%' }]}>{item.kategori_nama}</Text>
                <Text style={[styles.cellText, { width: '14%', textAlign: 'center', color: colors.textMuted }]}>
                  {item.jumlah_transaksi ? `${item.jumlah_transaksi} Trx` : '-'}
                </Text>
                <Text style={[styles.cellTextBold, { width: '22%', textAlign: 'right' }]}>
                  {formatIDR(item.nominal_expense)}
                </Text>
              </View>
            ))
          )}
          {/* Subtotal Beban */}
          <View style={styles.subtotalRow} wrap={false}>
            <Text style={[styles.cellTextBold, { width: '64%', color: colors.primary }]}>
              SUBTOTAL BEBAN OPERASIONAL
            </Text>
            <Text style={[styles.cellTextBold, { width: '14%', textAlign: 'center', color: colors.textMuted }]}>
              {totalExpenseTrx > 0 ? `${totalExpenseTrx} Trx` : '-'}
            </Text>
            <Text style={[styles.cellTextBold, { width: '22%', textAlign: 'right', color: colors.red }]}>
              {formatIDR(data.expense)}
            </Text>
          </View>

          {/* Grand Total Laba Rugi */}
          <View
            style={[
              styles.grandTotalRow,
              {
                backgroundColor: isProfit ? colors.greenBg : colors.redBg,
                borderColor: isProfit ? colors.greenBorder : colors.redBorder,
              },
            ]}
            wrap={false}
          >
            <Text style={[styles.cellTextBold, { width: '64%', fontSize: 9, color: isProfit ? colors.green : colors.red }]}>
              LABA / (RUGI) OPERASIONAL BERSIH
            </Text>
            <Text
              style={[
                styles.cellTextBold,
                { width: '36%', textAlign: 'right', fontSize: 10, color: isProfit ? colors.green : colors.red },
              ]}
            >
              {formatIDR(data.laba)}
            </Text>
          </View>
        </View>

        {/* 2-Column Summary: Cashflow & Neraca Snapshot */}
        <View style={styles.bottomGrid} wrap={false}>
          {/* Cashflow */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryBoxTitle}>Arus Kas (Cashflow Periode Ini)</Text>
            {(!data.cashflow || data.cashflow.length === 0) ? (
              <Text style={[styles.cellText, { color: colors.textMuted, fontStyle: 'italic', paddingVertical: 4 }]}>
                Belum ada transaksi kas tercatat.
              </Text>
            ) : (
              <>
                {data.cashflow.map(c => {
                  const val = Number(c.cashflow) || 0
                  return (
                    <View key={c.metode} style={styles.miniRow}>
                      <Text style={styles.miniLabel}>Metode {c.metode}</Text>
                      <Text style={[styles.miniValue, { color: val >= 0 ? colors.green : colors.red }]}>
                        {formatIDR(val)}
                      </Text>
                    </View>
                  )
                })}
                <View style={[styles.miniRow, { borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: 3, marginTop: 2 }]}>
                  <Text style={[styles.miniLabel, { fontFamily: 'Helvetica-Bold', color: colors.text }]}>Net Cashflow</Text>
                  <Text style={[styles.miniValue, { color: data.laba >= 0 ? colors.green : colors.red }]}>
                    {formatIDR(data.laba)}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Neraca Snapshot */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryBoxTitle}>Posisi Keuangan (Neraca Saldo)</Text>
            {!data.neraca ? (
              <Text style={[styles.cellText, { color: colors.textMuted, fontStyle: 'italic', paddingVertical: 4 }]}>
                Belum ada data posisi neraca.
              </Text>
            ) : (
              <>
                <View style={styles.miniRow}>
                  <Text style={styles.miniLabel}>Total Aset Kas & Bank</Text>
                  <Text style={styles.miniValue}>{formatIDR(data.neraca.total_aset_kas)}</Text>
                </View>
                <View style={styles.miniRow}>
                  <Text style={styles.miniLabel}>Modal Awal Pemilik</Text>
                  <Text style={styles.miniValue}>{formatIDR(data.neraca.total_modal_pemilik)}</Text>
                </View>
                <View style={[styles.miniRow, { borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingTop: 3, marginTop: 2 }]}>
                  <Text style={[styles.miniLabel, { fontFamily: 'Helvetica-Bold', color: colors.text }]}>Total Ekuitas</Text>
                  <Text style={styles.miniValue}>{formatIDR(data.neraca.total_equity)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Signature Block */}
        <View style={styles.signatureBlock} wrap={false}>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureRole}>Dibuat & Dilaporkan Oleh,</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{data.wpInfo?.nama_wp || data.outlet.nama}</Text>
              <Text style={styles.signatureSub}>Pengelola Outlet / Owner</Text>
            </View>
          </View>

          <View style={styles.signatureCol}>
            <Text style={styles.signatureRole}>Diverifikasi & Disetujui Oleh,</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>____________________________</Text>
              <Text style={styles.signatureSub}>Bagian Keuangan / Konsultan Pajak</Text>
            </View>
          </View>
        </View>

        {/* Page Footer */}
        <View style={styles.footerContainer} fixed>
          <Text>Dihasilkan otomatis oleh Sistem Akuntansi Ekspedisi | Dokumen Resmi & Terverifikasi Digital</Text>
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
// LEGACY TABLE FALLBACK (Normalized column widths)
// ============================================================

function LegacyPdfTable({ columns, rows }: { columns: PdfTableColumn[]; rows: PdfTableRow[] }) {
  // Normalize column widths to percentages so small weights like '2.5' never squeeze into 2.5 points!
  const totalWeight = columns.reduce((acc, col) => {
    const w = parseFloat(col.width) || 1
    return acc + w
  }, 0)

  const pctWidths = columns.map(col => {
    if (col.width.endsWith('%')) return col.width
    const w = parseFloat(col.width) || 1
    return `${((w / totalWeight) * 100).toFixed(1)}%`
  })

  return (
    <View style={{ marginTop: 8 }}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        {columns.map((col, i) => (
          <Text
            key={`h-${i}`}
            style={[
              styles.tableHeaderCell,
              { width: pctWidths[i], textAlign: col.align || 'left' },
            ]}
          >
            {col.header}
          </Text>
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
            <Text
              key={`r-${ri}-${ci}`}
              style={[
                styles.cellText,
                row.isTotal ? styles.cellTextBold : {},
                {
                  width: pctWidths[ci] || '25%',
                  textAlign: columns[ci]?.align || 'left',
                },
              ]}
            >
              {String(cell || '')}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

// ============================================================
// MAIN EXPORT TEMPLATE
// ============================================================

export function PdfReportTemplate(opts: PdfExportOptions) {
  if (opts.reportData) {
    return <FinancialReportView data={opts.reportData} />
  }

  // Fallback to legacy generic rendering if columns & rows passed without reportData
  const generatedAt = opts.generatedAt || new Date()
  return (
    <Document
      title={opts.reportTitle || 'Laporan Keuangan'}
      author={opts.wpInfo?.nama_wp || 'Owner'}
      creator="Ekspedisi Dashboard"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.companyName}>{opts.wpInfo?.nama_wp || 'Ekspedisi Dashboard'}</Text>
            {opts.wpInfo?.npwp && <Text style={{ fontSize: 8 }}>NPWP: {opts.wpInfo.npwp}</Text>}
          </View>
          <View style={styles.reportTitleBlock}>
            <Text style={styles.reportTitle}>{opts.reportTitle || 'Laporan Keuangan'}</Text>
            {opts.reportSubtitle && <Text style={styles.reportPeriode}>{opts.reportSubtitle}</Text>}
          </View>
        </View>

        {opts.columns && opts.rows && (
          <LegacyPdfTable columns={opts.columns} rows={opts.rows} />
        )}

        {opts.footerNote && (
          <Text style={{ marginTop: 12, fontSize: 7.5, color: colors.textMuted }}>
            {opts.footerNote}
          </Text>
        )}

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
// CLIENT LAZY DOWNLOAD LINK
// ============================================================

export const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false }
) as unknown as typeof import('@react-pdf/renderer').PDFDownloadLink

export const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { ssr: false }
) as unknown as typeof import('@react-pdf/renderer').PDFViewer

export { Document, Page, Text, View, StyleSheet, Image, Font }
