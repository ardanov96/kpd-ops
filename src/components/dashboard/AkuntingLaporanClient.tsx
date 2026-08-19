'use client'

import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

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

  function exportXLSX() {
    // Sheet 1: Laba-Rugi
    const lrRows = [
      { Section: 'PENDAPATAN', Kode: '', Nama: '', Nominal: '' },
      ...incomeItems.map((b: any) => ({
        Section: '', Kode: b.kategori_kode, Nama: b.kategori_nama, Nominal: Number(b.nominal_income),
      })),
      { Section: 'Total Income', Kode: '', Nama: '', Nominal: income },
      { Section: '', Kode: '', Nama: '', Nominal: '' },
      { Section: 'BEBAN', Kode: '', Nama: '', Nominal: '' },
      ...expenseItems.map((b: any) => ({
        Section: '', Kode: b.kategori_kode, Nama: b.kategori_nama, Nominal: Number(b.nominal_expense),
      })),
      { Section: 'Total Expense', Kode: '', Nama: '', Nominal: expense },
      { Section: '', Kode: '', Nama: '', Nominal: '' },
      { Section: 'LABA KOTOR', Kode: '', Nama: '', Nominal: laba },
    ]
    const wsLR = XLSX.utils.json_to_sheet(lrRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsLR, 'Laba-Rugi')

    // Sheet 2: Cashflow
    const wsCF = XLSX.utils.json_to_sheet(
      cashflow.map((c: any) => ({
        Metode: c.metode,
        Cashflow: Number(c.cashflow),
      }))
    )
    XLSX.utils.book_append_sheet(wb, wsCF, 'Cashflow')

    // Sheet 3: Neraca
    if (neraca) {
      const wsNR = XLSX.utils.json_to_sheet([
        { Akun: 'Kas',            Nilai: Number(neraca.total_aset_kas) },
        { Akun: 'Total Aset',     Nilai: Number(neraca.total_aset) },
        { Akun: '',               Nilai: '' },
        { Akun: 'Modal Pemilik',  Nilai: Number(neraca.total_modal_pemilik) },
        { Akun: 'Laba Ditahan',   Nilai: Number(neraca.total_laba_ditahan) },
        { Akun: 'Total Equity',   Nilai: Number(neraca.total_equity) },
        { Akun: '',               Nilai: '' },
        { Akun: 'Selisih (harus 0)', Nilai: Number(neraca.selisih) },
      ])
      XLSX.utils.book_append_sheet(wb, wsNR, 'Neraca')
    }

    const filename = `Laporan_Keuangan_${outlet.kode}_${selectedPeriode}.xlsx`
    XLSX.writeFile(wb, filename)
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
