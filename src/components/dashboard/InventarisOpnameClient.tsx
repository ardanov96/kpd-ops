'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Opname } from '@/types'
import { useToast } from './Toast'

const fmtFull = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

type OpnameRow = {
  barang_id: string
  nama: string
  satuan: string
  kategori_nama?: string
  qty_sistem: number
  qty_fisik: string  // input string biar bisa kosong
  selisih: number
  harga_satuan: number
  catatan: string
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#f59e0b',
  FINAL: '#22c55e',
}

export default function InventarisOpnameClient({
  outlet, periode, stokList, existingOpname, existingItems, opnameHistory,
}: {
  outlet: { id: string; kode: string; nama: string }
  periode: string
  stokList: any[]
  existingOpname: Opname | null
  existingItems: any[]
  opnameHistory: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [busy, setBusy] = useState(false)
  const { showToast } = useToast()
  const [catatan, setCatatan] = useState((existingOpname as any)?.catatan || '')
  const [tanggalOpname, setTanggalOpname] = useState(
    (existingOpname as any)?.tanggal_opname || new Date().toISOString().slice(0, 10)
  )

  // Build initial rows dari existing opname (jika ada) atau dari stokList
  const [rows, setRows] = useState<OpnameRow[]>(() => {
    if (existingOpname && existingItems.length > 0) {
      return stokList.map((s) => {
        const ex = existingItems.find((it: any) => it.barang_id === s.barang_id)
        return {
          barang_id: s.barang_id,
          nama: s.nama,
          satuan: s.satuan,
          kategori_nama: s.kategori?.nama,
          qty_sistem: ex ? Number(ex.qty_sistem) : Number(s.stok),
          qty_fisik: ex ? String(ex.qty_fisik) : String(Number(s.stok)),
          selisih: ex ? Number(ex.selisih || 0) : 0,
          harga_satuan: ex ? Number(ex.harga_satuan || 0) : Number(s.harga_beli || 0),
          catatan: ex?.catatan || '',
        }
      })
    }
    return stokList.map((s) => ({
      barang_id: s.barang_id,
      nama: s.nama,
      satuan: s.satuan,
      kategori_nama: s.kategori?.nama,
      qty_sistem: Number(s.stok),
      qty_fisik: String(Number(s.stok)),
      selisih: 0,
      harga_satuan: Number(s.harga_beli || 0),
      catatan: '',
    }))
  })

  function updateRow(barangId: string, field: keyof OpnameRow, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.barang_id !== barangId) return r
        const next = { ...r, [field]: value }
        if (field === 'qty_fisik') {
          const fisik = Number(value) || 0
          next.selisih = fisik - r.qty_sistem
        }
        return next
      })
    )
  }

  // Hitung summary
  const summary = useMemo(() => {
    const totalItems = rows.length
    const matchCount = rows.filter((r) => r.selisih === 0).length
    const diffCount = rows.filter((r) => r.selisih !== 0).length
    const totalSelisih = rows.reduce((acc, r) => acc + r.selisih, 0)
    const totalNilaiSelisih = rows.reduce(
      (acc, r) => acc + r.selisih * r.harga_satuan,
      0
    )
    return { totalItems, matchCount, diffCount, totalSelisih, totalNilaiSelisih }
  }, [rows])

  function changePeriode(newPeriode: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('periode', newPeriode)
    router.push(`/dashboard/inventaris/opname?${params.toString()}`)
  }

  async function submitOpname() {
    if (rows.length === 0) return showToast('Belum ada barang untuk diopname', 'err')
    setBusy(true)
    try {
      const payload = {
        outlet_id: outlet.id,
        periode,
        tanggal_opname: tanggalOpname,
        catatan: catatan.trim() || null,
        items: rows.map((r) => ({
          barang_id: r.barang_id,
          qty_sistem: r.qty_sistem,
          qty_fisik: Number(r.qty_fisik) || 0,
          selisih: r.selisih,
          harga_satuan: r.harga_satuan,
          catatan: r.catatan.trim() || null,
        })),
      }
      const res = await fetch('/api/inventaris/opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal simpan opname')
      showToast('✅ Opname tersimpan. Stok telah disesuaikan.')
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  const isFinal = existingOpname?.status === 'FINAL'

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button onClick={() => router.push('/dashboard/inventaris')}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8 }}>
            ← Kembali ke Inventaris
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📋 Opname Bulanan</h1>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            {outlet.nama} ({outlet.kode})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#94a3b8' }}>Periode:</label>
          <input type="month" value={periode} onChange={(e) => changePeriode(e.target.value)}
            style={{
              padding: '8px 12px', background: '#0d111c', border: '1px solid #1e2433',
              borderRadius: 8, color: '#e2e8f0', fontSize: 13,
            }} />
          {existingOpname && (
            <span style={{
              background: STATUS_COLOR[existingOpname.status] + '20',
              color: STATUS_COLOR[existingOpname.status],
              border: `1px solid ${STATUS_COLOR[existingOpname.status]}`,
              padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
            }}>
              Status: {existingOpname.status}
            </span>
          )}
        </div>
      </div>

      {/* Warning: kalau sudah FINAL, tidak bisa edit */}
      {isFinal && (
        <div style={{
          background: '#22c55e20', border: '1px solid #22c55e',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <strong style={{ color: '#22c55e' }}>✅ Opname periode ini sudah FINAL.</strong>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            ADJ movement sudah tercatat dan stok sudah disesuaikan. Tidak bisa diubah lagi.
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12, marginBottom: 16,
      }}>
        <SummaryCard label="Total Barang" value={summary.totalItems} color="#3b82f6" />
        <SummaryCard label="Cocok" value={summary.matchCount} color="#22c55e" />
        <SummaryCard label="Selisih" value={summary.diffCount} color="#f59e0b" />
        <SummaryCard label="Total Selisih" value={summary.totalSelisih} color={summary.totalSelisih < 0 ? '#ef4444' : '#22c55e'} />
        <SummaryCard label="Nilai Selisih" value={fmtFull(summary.totalNilaiSelisih)} color={summary.totalNilaiSelisih < 0 ? '#ef4444' : '#22c55e'} />
      </div>

      {/* Form opname */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12,
        marginBottom: 16,
      }}>
        <Field label="Tanggal Opname">
          <input type="date" value={tanggalOpname}
            disabled={isFinal}
            onChange={(e) => setTanggalOpname(e.target.value)}
            style={inputStyle(isFinal)} />
        </Field>
        <Field label="Catatan">
          <input type="text" value={catatan}
            disabled={isFinal}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="misal: stok opname akhir bulan"
            style={inputStyle(isFinal)} />
        </Field>
      </div>

      {/* Tabel input opname */}
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e2433' }}>
              <th style={th()}>Kategori</th>
              <th style={th()}>Nama Barang</th>
              <th style={th()}>Satuan</th>
              <th style={th()}>Qty Sistem</th>
              <th style={th()}>Qty Fisik *</th>
              <th style={th()}>Selisih</th>
              <th style={th()}>Harga</th>
              <th style={th()}>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                Belum ada barang. Tambah barang dulu di halaman Inventaris.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.barang_id} style={{ borderTop: '1px solid #1e2433' }}>
                <td style={td()}>{r.kategori_nama || '-'}</td>
                <td style={td()}>{r.nama}</td>
                <td style={td()}>{r.satuan}</td>
                <td style={{ ...td(), color: '#94a3b8' }}>{r.qty_sistem.toLocaleString('id-ID')}</td>
                <td style={td()}>
                  <input type="number" step="0.01" value={r.qty_fisik}
                    disabled={isFinal}
                    onChange={(e) => updateRow(r.barang_id, 'qty_fisik', e.target.value)}
                    style={{ ...inputStyle(isFinal), width: 100, padding: '4px 8px' }} />
                </td>
                <td style={{
                  ...td(),
                  color: r.selisih === 0 ? '#22c55e' : r.selisih < 0 ? '#ef4444' : '#3b82f6',
                  fontWeight: 700,
                }}>
                  {r.selisih > 0 ? '+' : ''}{r.selisih.toLocaleString('id-ID')}
                </td>
                <td style={td()}>
                  <input type="number" min="0" step="1" value={r.harga_satuan}
                    disabled={isFinal}
                    onChange={(e) => updateRow(r.barang_id, 'harga_satuan', e.target.value)}
                    style={{ ...inputStyle(isFinal), width: 90, padding: '4px 8px' }} />
                </td>
                <td style={td()}>
                  <input type="text" value={r.catatan}
                    disabled={isFinal}
                    onChange={(e) => updateRow(r.barang_id, 'catatan', e.target.value)}
                    style={{ ...inputStyle(isFinal), width: 140, padding: '4px 8px' }}
                    placeholder="opsional" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isFinal && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={submitOpname} disabled={busy || rows.length === 0}
            style={{
              background: '#f97316', border: 'none', color: '#fff',
              padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, fontWeight: 700,
            }}>
            {busy ? 'Menyimpan...' : '✅ Simpan Opname (Final)'}
          </button>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' }}>
        ℹ️ Menyimpan opname akan otomatis insert ADJ movement untuk setiap selisih. Stok akan terupdate via view <code>v_stok_aktual</code>.
      </div>

      {/* History */}
      {opnameHistory.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>📜 History Opname (12 terakhir)</h2>
          <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e2433' }}>
                  <th style={th()}>Periode</th>
                  <th style={th()}>Tanggal</th>
                  <th style={th()}>Status</th>
                  <th style={th()}>Jumlah Item</th>
                  <th style={th()}>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {opnameHistory.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid #1e2433' }}>
                    <td style={td()}>{o.periode}</td>
                    <td style={td()}>{o.tanggal_opname}</td>
                    <td style={td()}>
                      <span style={{
                        background: STATUS_COLOR[o.status] + '20',
                        color: STATUS_COLOR[o.status],
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      }}>{o.status}</span>
                    </td>
                    <td style={td()}>{o.items?.length || 0}</td>
                    <td style={{ ...td(), color: '#94a3b8', fontSize: 12 }}>{o.catatan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast sudah di-mount di <ClientProviders> di root layout */}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2433', borderRadius: 10,
      padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </label>
      {children}
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
  return { padding: '8px 12px', color: '#e2e8f0' }
}
function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '8px 12px', background: disabled ? '#1e243320' : '#0d111c',
    border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0',
    fontSize: 13, outline: 'none',
    cursor: disabled ? 'not-allowed' : 'text',
  }
}
