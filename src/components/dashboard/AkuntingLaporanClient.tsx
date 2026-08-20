'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { exportAndDownloadXlsx, type XlsxSheet } from '@/lib/export/xlsx'
import { PdfReportTemplate, type PdfExportOptions } from '@/lib/export/pdf'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

// Client-only lazy load PDFDownloadLink (browser-only)
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false }
)

export default function AkuntingLaporanClient({
  outlet, selectedPeriode, currentPeriode, labaRugi, breakdown, cashflow, neraca,
}: {
  outlet: { id: string; kode: string; nama: string }
  selectedPeriode: string
  currentPeriode: string
  labaRugi: { total_income: number; total_expense: number; laba_kotor: number }
  breakdown: any[]
  cashflow: any[]
  neraca: any
}) {
  const router = useRouter()

  const income = Number(labaRugi.total_income || 0)
  const expense = Number(labaRugi.total_expense || 0)
  const laba = Number(labaRugi.laba_kotor || 0)

  const incomeItems = breakdown.filter((b: any) => Number(b.nominal_income) > 0)
  const expenseItems = breakdown.filter((b: any) => Number(b.nominal_expense) > 0)

  const [pdfBusy, setPdfBusy] = useState(false)

  function exportXLSX() {
    // Sprint 5: refactor pakai helper generic dengan multi-sheet + currency format
    const lrRows: XlsxSheet['rows'] = []
    lrRows.push({ section: 'PENDAPATAN', kode: '', nama: '', nominal: '' })
    incomeItems.forEach((b: any) => {
      lrRows.push({ section: '', kode: b.kategori_kode, nama: b.kategori_nama, nominal: Number(b.nominal_income) })
    })
    lrRows.push({ section: 'Total Income', kode: '', nama: '', nominal: income })
    lrRows.push({ section: '', kode: '', nama: '', nominal: '' })
    lrRows.push({ section: 'BEBAN', kode: '', nama: '', nominal: '' })
    expenseItems.forEach((b: any) => {
      lrRows.push({ section: '', kode: b.kategori_kode, nama: b.kategori_nama, nominal: Number(b.nominal_expense) })
    })
    lrRows.push({ section: 'Total Expense', kode: '', nama: '', nominal: expense })
    lrRows.push({ section: '', kode: '', nama: '', nominal: '' })
    lrRows.push({ section: 'LABA KOTOR', kode: '', nama: '', nominal: laba })

    const sheets: XlsxSheet[] = [
      {
        name: 'Laba-Rugi',
        title: 'LAPORAN LABA-RUGI',
        subtitle: `${outlet.nama} (${outlet.kode}) - Periode ${selectedPeriode}`,
        columns: [
          { header: 'Section', key: 'section', width: 16 },
          { header: 'Kode Akun', key: 'kode', width: 12 },
          { header: 'Nama Akun', key: 'nama', width: 36 },
          { header: 'Nominal (Rp)', key: 'nominal', width: 18, format: 'currency' },
        ],
        rows: lrRows,
        footerNote: 'Dihasilkan otomatis oleh Ekspedisi Dashboard',
      },
      {
        name: 'Cashflow',
        title: 'LAPORAN CASHFLOW',
        subtitle: `Per Metode Bayar - Periode ${selectedPeriode}`,
        columns: [
          { header: 'Metode', key: 'metode', width: 16 },
          { header: 'Cashflow (Rp)', key: 'cashflow', width: 18, format: 'currency' },
        ],
        rows: cashflow.map((c: any) => ({
          metode: c.metode,
          cashflow: Number(c.cashflow),
        })),
      },
    ]

    if (neraca) {
      sheets.push({
        name: 'Neraca',
        title: 'LAPORAN NERACA',
        subtitle: 'Posisi Keuangan - Snapshot',
        columns: [
          { header: 'Akun', key: 'akun', width: 32 },
          { header: 'Nilai (Rp)', key: 'nilai', width: 18, format: 'currency' },
        ],
        rows: [
          { akun: 'Kas', nilai: Number(neraca.total_aset_kas) },
          { akun: 'Total Aset', nilai: Number(neraca.total_aset) },
          { akun: '', nilai: '' },
          { akun: 'Modal Pemilik', nilai: Number(neraca.total_modal_pemilik) },
          { akun: 'Laba Ditahan', nilai: Number(neraca.total_laba_ditahan) },
          { akun: 'Total Equity', nilai: Number(neraca.total_equity) },
          { akun: '', nilai: '' },
          { akun: 'Selisih (harus 0)', nilai: Number(neraca.selisih) },
        ],
      })
    }

    exportAndDownloadXlsx({
      filename: `Laporan_Keuangan_${outlet.kode}_${selectedPeriode}.xlsx`,
      sheets,
      companyName: outlet.nama,
    })
  }

  function getPdfOptions(): PdfExportOptions {
    const lrRows = [
      { cells: ['PENDAPATAN', '', '', ''] },
      ...incomeItems.map((b: any): { cells: (string | number)[] } => ({
        cells: ['', b.kategori_kode, b.kategori_nama, fmtRp(b.nominal_income)],
      })),
      { cells: ['Total Income', '', '', fmtRp(income)], isTotal: true },
      { cells: ['', '', '', ''], isEmpty: true },
      { cells: ['BEBAN', '', '', ''] },
      ...expenseItems.map((b: any): { cells: (string | number)[] } => ({
        cells: ['', b.kategori_kode, b.kategori_nama, fmtRp(b.nominal_expense)],
      })),
      { cells: ['Total Expense', '', '', fmtRp(expense)], isTotal: true },
      { cells: ['', '', '', ''], isEmpty: true },
      { cells: ['LABA KOTOR', '', '', fmtRp(laba)], isTotal: true },
    ]
    return {
      reportTitle: 'Laporan Keuangan',
      reportSubtitle: `Periode ${selectedPeriode}`,
      wpInfo: {
        nama_wp: outlet.nama,
        outlet_nama: outlet.nama,
        outlet_kode: outlet.kode,
      },
      columns: [
        { header: 'Section / Kategori', width: '2.5', align: 'left' },
        { header: 'Kode', width: '1', align: 'left' },
        { header: 'Nama Akun', width: '4', align: 'left' },
        { header: 'Nominal', width: '2', align: 'right', bold: true },
      ],
      rows: lrRows,
    }
  }

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/dashboard/akunting')}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8 }}>
          ← Kembali ke Akunting
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📊 Laporan Keuangan</h1>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              {outlet.nama} ({outlet.kode}) · Periode {selectedPeriode}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="month" value={selectedPeriode}
              onChange={(e) => router.push(`/dashboard/akunting/laba-rugi?periode=${e.target.value}`)}
              style={{
                padding: '8px 12px', background: '#0d111c', border: '1px solid #1e2433',
                borderRadius: 8, color: '#e2e8f0', fontSize: 13,
              }} />
            <button onClick={exportXLSX}
              style={{
                background: '#22c55e', border: 'none', color: '#fff',
                padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>
              📥 Export XLSX (3 sheet)
            </button>
            {/* Sprint 5: Tombol Export PDF */}
            <PDFDownloadLink
              document={<PdfReportTemplate {...getPdfOptions()} />}
              fileName={`Laporan_Keuangan_${outlet.kode}_${selectedPeriode}.pdf`}
              style={{ textDecoration: 'none' }}
            >
              {({ loading }: { loading: boolean }) => (
                <button
                  disabled={loading || pdfBusy}
                  style={{
                    background: loading ? '#1e2433' : '#3b82f6', border: 'none', color: '#fff',
                    padding: '10px 16px', borderRadius: 8,
                    cursor: loading ? 'wait' : 'pointer',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {loading ? '⏳ Generating PDF...' : '📄 Export PDF'}
                </button>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Laba-Rugi (Income + Expense breakdown) */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: '#22c55e' }}>⬆️ PENDAPATAN</h2>
          {incomeItems.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>Belum ada income.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {incomeItems.map((b: any) => (
                  <tr key={b.kategori_id}>
                    <td style={{ padding: '6px 0', color: '#94a3b8' }}>
                      <code style={{ background: '#0d111c', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{b.kategori_kode}</code>
                      {' '}{b.kategori_nama}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                      {fmtRp(Number(b.nominal_income))}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #22c55e' }}>
                  <td style={{ padding: '12px 0 4px', fontWeight: 700, fontSize: 14 }}>TOTAL INCOME</td>
                  <td style={{ padding: '12px 0 4px', textAlign: 'right', fontWeight: 800, color: '#22c55e', fontSize: 16 }}>
                    {fmtRp(income)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '20px 0 12px', color: '#ef4444' }}>⬇️ BEBAN</h2>
          {expenseItems.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>Belum ada expense.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {expenseItems.map((b: any) => (
                  <tr key={b.kategori_id}>
                    <td style={{ padding: '6px 0', color: '#94a3b8' }}>
                      <code style={{ background: '#0d111c', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{b.kategori_kode}</code>
                      {' '}{b.kategori_nama}
                    </td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                      {fmtRp(Number(b.nominal_expense))}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #ef4444' }}>
                  <td style={{ padding: '12px 0 4px', fontWeight: 700, fontSize: 14 }}>TOTAL EXPENSE</td>
                  <td style={{ padding: '12px 0 4px', textAlign: 'right', fontWeight: 800, color: '#ef4444', fontSize: 16 }}>
                    {fmtRp(expense)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          <div style={{
            marginTop: 16, padding: 16, background: laba >= 0 ? '#22c55e20' : '#ef444420',
            border: '1px solid ' + (laba >= 0 ? '#22c55e' : '#ef4444'),
            borderRadius: 10, display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: laba >= 0 ? '#22c55e' : '#ef4444' }}>
              💰 LABA KOTOR
            </span>
            <span style={{ fontSize: 20, fontWeight: 800, color: laba >= 0 ? '#22c55e' : '#ef4444' }}>
              {fmtRp(laba)}
            </span>
          </div>
        </div>

        {/* Neraca + Cashflow */}
        <div>
          {/* Cashflow */}
          <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>💵 Cashflow ({selectedPeriode})</h2>
            {cashflow.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>Belum ada transaksi cash/bank/ewallet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {cashflow.map((c: any) => (
                    <tr key={c.metode} style={{ borderTop: '1px solid #1e2433' }}>
                      <td style={{ padding: '8px 0' }}>
                        {c.metode === 'CASH' ? '💵' : c.metode === 'BANK' ? '🏦' : '📱'} {c.metode}
                      </td>
                      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700, color: Number(c.cashflow) >= 0 ? '#22c55e' : '#ef4444' }}>
                        {fmtRp(Number(c.cashflow))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Neraca */}
          <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>📊 Neraca (Snapshot)</h2>
            {!neraca ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>Belum ada data neraca.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  <SubRow label="Kas" value={neraca.total_aset_kas} color="#e2e8f0" />
                  <TotalRow label="TOTAL ASET" value={neraca.total_aset} color="#22c55e" />
                  <SubRow label="Modal Pemilik" value={neraca.total_modal_pemilik} color="#e2e8f0" />
                  <SubRow label="Laba Ditahan" value={neraca.total_laba_ditahan} color="#e2e8f0" />
                  <TotalRow label="TOTAL EQUITY" value={neraca.total_equity} color="#3b82f6" />
                  {Math.abs(Number(neraca.selisih)) > 1 && (
                    <tr>
                      <td style={{ padding: '8px 0', color: '#f59e0b', fontStyle: 'italic' }}>⚠ Selisih (Aset - Equity)</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>
                        {fmtRp(Number(neraca.selisih))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SubRow({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <tr>
      <td style={{ padding: '6px 0', color: '#94a3b8' }}>{label}</td>
      <td style={{ padding: '6px 0', textAlign: 'right', color, fontWeight: 600 }}>
        {typeof value === 'number' ? fmtRp(value) : value}
      </td>
    </tr>
  )
}

function TotalRow({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <tr style={{ borderTop: '2px solid ' + color }}>
      <td style={{ padding: '10px 0 4px', fontWeight: 700, color, fontSize: 14 }}>{label}</td>
      <td style={{ padding: '10px 0 4px', textAlign: 'right', fontWeight: 800, color, fontSize: 16 }}>
        {typeof value === 'number' ? fmtRp(value) : value}
      </td>
    </tr>
  )
}
