'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { exportAndDownloadXlsx, type XlsxSheet } from '@/lib/export/xlsx'

const fmtFull = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

const TIPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  IN:  { bg: '#22c55e20', color: '#22c55e', label: '⬆ Masuk' },
  OUT: { bg: '#ef444420', color: '#ef4444', label: '⬇ Keluar' },
  ADJ: { bg: '#3b82f620', color: '#3b82f6', label: '⚖ Adjust' },
}

export default function InventarisDetailClient({
  barang, stok, movements,
}: {
  barang: any
  stok: any
  movements: any[]
}) {
  const router = useRouter()

  // Summary aggregat
  const summary = useMemo(() => {
    let totalIn = 0, totalOut = 0, totalAdj = 0, totalNilaiIn = 0, totalNilaiOut = 0
    for (const m of movements) {
      if (m.tipe === 'IN') {
        totalIn += Number(m.qty)
        totalNilaiIn += Number(m.total)
      } else if (m.tipe === 'OUT') {
        totalOut += Number(m.qty)
        totalNilaiOut += Number(m.total)
      } else if (m.tipe === 'ADJ') {
        totalAdj += Number(m.qty)
      }
    }
    return { totalIn, totalOut, totalAdj, totalNilaiIn, totalNilaiOut }
  }, [movements])

  function exportXLSX() {
    // Sprint 5: pakai helper generic dengan currency format + metadata
    const movementsRows = movements.map((m) => ({
      tanggal: m.tanggal,
      tipe: m.tipe,
      qty: Number(m.qty),
      'harga_satuan': Number(m.harga_satuan),
      total: Number(m.total),
      ref_type: m.ref_type || '-',
      keterangan: m.keterangan || '-',
      created_at: m.created_at,
    }))

    const sheets: XlsxSheet[] = [
      {
        name: 'Kartu Stok',
        title: `KARTU STOK — ${barang.nama}`,
        subtitle: `${barang.kategori?.kode || ''} · ${barang.kategori?.nama || ''} · Stok saat ini: ${stok?.stok ?? 0} ${barang.satuan}`,
        columns: [
          { header: 'Tanggal',         key: 'tanggal',      width: 14 },
          { header: 'Tipe',            key: 'tipe',         width: 10 },
          { header: 'Qty',             key: 'qty',          width: 10, format: 'number' },
          { header: 'Harga Satuan (Rp)', key: 'harga_satuan', width: 18, format: 'currency' },
          { header: 'Total (Rp)',      key: 'total',        width: 18, format: 'currency' },
          { header: 'Tipe Ref',        key: 'ref_type',     width: 12 },
          { header: 'Keterangan',      key: 'keterangan',   width: 30 },
          { header: 'Created At',      key: 'created_at',   width: 22 },
        ],
        rows: movementsRows,
      },
      {
        name: 'Summary',
        title: 'SUMMARY KARTU STOK',
        columns: [
          { header: 'Field', key: 'field', width: 24 },
          { header: 'Value', key: 'value', width: 28 },
        ],
        rows: [
          { field: 'Nama Barang',  value: barang.nama },
          { field: 'SKU',          value: barang.sku || '-' },
          { field: 'Kategori',     value: barang.kategori?.nama || '-' },
          { field: 'Satuan',       value: barang.satuan },
          { field: 'Stok Minimum', value: Number(barang.stok_min) },
          { field: 'Stok Aktual',  value: Number(stok?.stok ?? 0) },
          { field: 'Total Masuk',  value: summary.totalIn },
          { field: 'Total Keluar', value: summary.totalOut },
          { field: 'Total Adjust', value: summary.totalAdj },
          { field: 'Nilai Masuk',  value: fmtFull(summary.totalNilaiIn) },
          { field: 'Nilai Keluar', value: fmtFull(summary.totalNilaiOut) },
        ],
      },
    ]

    exportAndDownloadXlsx({
      filename: `Kartu_Stok_${barang.nama.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets,
      companyName: 'Ekspedisi Dashboard',
    })
  }

  const stokNumber = Number(stok?.stok ?? 0)
  const isBelowMin = stok?.is_below_min ?? false

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/dashboard/inventaris')}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8 }}>
          ← Kembali ke Inventaris
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{barang.nama}</h1>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              {barang.kategori?.nama || '-'} · SKU: {barang.sku || '-'} · Satuan: {barang.satuan}
            </div>
          </div>
          <button onClick={exportXLSX}
            style={{
              background: '#22c55e', border: 'none', color: '#fff',
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
            }}>
            📥 Export XLSX
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        <Card label="Stok Aktual" value={`${stokNumber.toLocaleString('id-ID')} ${barang.satuan}`}
          color={isBelowMin ? '#ef4444' : '#22c55e'} />
        <Card label="Stok Minimum" value={`${Number(barang.stok_min).toLocaleString('id-ID')} ${barang.satuan}`}
          color="#94a3b8" />
        <Card label="Total Masuk" value={`${summary.totalIn.toLocaleString('id-ID')} ${barang.satuan}`}
          color="#22c55e" />
        <Card label="Total Keluar" value={`${summary.totalOut.toLocaleString('id-ID')} ${barang.satuan}`}
          color="#ef4444" />
        <Card label="Total Adjust" value={`${summary.totalAdj.toLocaleString('id-ID')} ${barang.satuan}`}
          color="#3b82f6" />
        <Card label="Nilai Masuk" value={fmtFull(summary.totalNilaiIn)} color="#22c55e" />
        <Card label="Nilai Keluar" value={fmtFull(summary.totalNilaiOut)} color="#ef4444" />
      </div>

      {/* Info barang */}
      <div style={{
        background: '#111827', border: '1px solid #1e2433', borderRadius: 10,
        padding: 16, marginBottom: 24,
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Info Barang
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
          <InfoRow label="Harga Beli" value={fmtFull(Number(barang.harga_beli))} />
          <InfoRow label="Status" value={barang.aktif ? '✅ Aktif' : '⏸ Non-aktif'} />
          <InfoRow label="Dibuat" value={new Date(barang.created_at).toLocaleDateString('id-ID')} />
        </div>
      </div>

      {/* Tabel kartu stok */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📜 Kartu Stok</h2>
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e2433' }}>
              <th style={th()}>Tanggal</th>
              <th style={th()}>Tipe</th>
              <th style={th()}>Qty</th>
              <th style={th()}>Harga</th>
              <th style={th()}>Total</th>
              <th style={th()}>Ref</th>
              <th style={th()}>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                Belum ada pergerakan stok.
              </td></tr>
            )}
            {movements.map((m) => {
              const badge = TIPE_BADGE[m.tipe]
              const isOut = m.tipe === 'OUT'
              return (
                <tr key={m.id} style={{ borderTop: '1px solid #1e2433' }}>
                  <td style={td()}>{m.tanggal}</td>
                  <td style={td()}>
                    <span style={{
                      background: badge.bg, color: badge.color,
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    }}>{badge.label}</span>
                  </td>
                  <td style={{
                    ...td(),
                    color: m.tipe === 'IN' ? '#22c55e' : m.tipe === 'OUT' ? '#ef4444' : '#3b82f6',
                    fontWeight: 700,
                  }}>
                    {isOut ? '-' : '+'}{Number(m.qty).toLocaleString('id-ID')} {barang.satuan}
                  </td>
                  <td style={td()}>{fmtFull(Number(m.harga_satuan))}</td>
                  <td style={td()}>{fmtFull(Number(m.total))}</td>
                  <td style={{ ...td(), fontSize: 11, color: '#64748b' }}>{m.ref_type || '-'}</td>
                  <td style={{ ...td(), fontSize: 12, color: '#94a3b8' }}>{m.keterangan || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Card({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2433', borderRadius: 10,
      padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function th(): React.CSSProperties {
  return {
    padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#94a3b8',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
  }
}
function td(): React.CSSProperties {
  return { padding: '10px 12px', color: '#e2e8f0' }
}
