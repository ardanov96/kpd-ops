'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TipeTransaksiKeuangan, TipeAkun, MetodeBayar, KategoriAkun, TransaksiKeuangan } from '@/types'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

const TIPE_COLOR: Record<string, string> = {
  MASUK: '#22c55e',
  KELUAR: '#ef4444',
  TRANSFER: '#3b82f6',
}

const TIPE_LABEL: Record<TipeTransaksiKeuangan, string> = {
  MASUK: '⬆️ Pemasukan',
  KELUAR: '⬇️ Pengeluaran',
  TRANSFER: '🔄 Transfer',
}

const METODE_LABEL: Record<MetodeBayar, string> = {
  CASH: '💵 Cash',
  BANK: '🏦 Bank',
  EWALLET: '📱 E-Wallet',
}

const todayIso = () => new Date().toISOString().slice(0, 10)

type FormState = {
  tanggal: string
  tipe: TipeTransaksiKeuangan
  kategori_id: string
  nominal: number
  metode: MetodeBayar
  keterangan: string
}

export default function AkuntingExpenseForm({
  outlet, kategoriList, transaksiList, filterPeriode, filterTipe,
}: {
  outlet: { id: string; kode: string; nama: string }
  kategoriList: KategoriAkun[]
  transaksiList: any[]
  filterPeriode: string
  filterTipe: string
}) {
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    tanggal: todayIso(),
    tipe: 'KELUAR',
    kategori_id: '',
    nominal: 0,
    metode: 'CASH',
    keterangan: '',
  })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 2500)
  }

  // Filter kategori based on tipe
  const tipeToAkunTipe: Record<TipeTransaksiKeuangan, TipeAkun[]> = {
    MASUK: ['INCOME'],
    KELUAR: ['EXPENSE'],
    TRANSFER: ['ASSET', 'LIABILITY', 'EQUITY'],
  }
  const filteredKategori = kategoriList.filter((k) =>
    tipeToAkunTipe[form.tipe]?.includes(k.tipe)
  )

  // Filter list lokal (instant)
  const filteredList = transaksiList.filter((t) => {
    if (filterPeriode) {
      const tgl = String(t.tanggal || '')
      if (!tgl.startsWith(filterPeriode)) return false
    }
    if (filterTipe && t.tipe !== filterTipe) return false
    return true
  })

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (filterPeriode && key !== 'periode') params.set('periode', filterPeriode)
    if (filterTipe && key !== 'tipe') params.set('tipe', filterTipe)
    if (value) params.set(key, value)
    router.push(`/dashboard/akunting/expense?${params.toString()}`)
  }

  async function submit() {
    if (!form.kategori_id) return showToast('Kategori wajib dipilih', 'err')
    if (!form.nominal || form.nominal <= 0) return showToast('Nominal harus > 0', 'err')
    if (!form.tanggal) return showToast('Tanggal wajib diisi', 'err')
    setBusy(true)
    try {
      const res = await fetch('/api/akunting/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outlet.id,
          tanggal: form.tanggal,
          tipe: form.tipe,
          kategori_id: form.kategori_id,
          nominal: Number(form.nominal),
          metode: form.metode,
          keterangan: form.keterangan.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal simpan')
      showToast(`Transaksi ${form.tipe} tersimpan`)
      setForm({ ...form, nominal: 0, keterangan: '', kategori_id: '' })
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function hapus(id: string) {
    if (!confirm('Hapus transaksi ini?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/akunting/transaksi/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal hapus')
      showToast('Transaksi dihapus')
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/dashboard/akunting')}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8 }}>
          ← Kembali ke Akunting
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>💸 Input Transaksi Keuangan</h1>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
          {outlet.nama} ({outlet.kode})
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 }}>
        {/* Form */}
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 20, height: 'fit-content' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>➕ Transaksi Baru</h2>

          <Field label="Tipe *">
            <select value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value as TipeTransaksiKeuangan, kategori_id: '' })}
              style={input()}>
              {(Object.keys(TIPE_LABEL) as TipeTransaksiKeuangan[]).map((t) => (
                <option key={t} value={t}>{TIPE_LABEL[t]}</option>
              ))}
            </select>
          </Field>

          <Field label={`Kategori * (${form.tipe === 'MASUK' ? 'Income' : form.tipe === 'KELUAR' ? 'Expense' : 'Asset/Liability/Equity'})`}>
            <select value={form.kategori_id} onChange={(e) => setForm({ ...form, kategori_id: e.target.value })}
              style={input()}>
              <option value="">-- pilih --</option>
              {filteredKategori.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.kode} · {k.nama}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tanggal *">
            <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} style={input()} />
          </Field>

          <Field label="Nominal (Rp) *">
            <input type="number" min="0" step="100" value={form.nominal || ''}
              onChange={(e) => setForm({ ...form, nominal: Number(e.target.value) })} style={input()} />
          </Field>

          <Field label="Metode Bayar">
            <div style={{ display: 'flex', gap: 6 }}>
              {(Object.keys(METODE_LABEL) as MetodeBayar[]).map((m) => (
                <button key={m} type="button" onClick={() => setForm({ ...form, metode: m })}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: form.metode === m ? '#f9731620' : '#0d111c',
                    border: form.metode === m ? '1px solid #f97316' : '1px solid #1e2433',
                    color: form.metode === m ? '#f97316' : '#94a3b8',
                  }}>
                  {METODE_LABEL[m]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Keterangan">
            <textarea value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              style={{ ...input(), minHeight: 60, resize: 'vertical' }}
              placeholder={form.tipe === 'KELUAR' ? 'misal: Bayar WiFi bulan Oktober' : 'misal: Setoran modal'} />
          </Field>

          <button type="button" onClick={submit} disabled={busy}
            style={{
              width: '100%', background: '#f97316', border: 'none', color: '#fff',
              padding: '10px 16px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 700, marginTop: 8,
              opacity: busy ? 0.6 : 1,
            }}>
            {busy ? 'Menyimpan...' : '✅ Simpan Transaksi'}
          </button>

          <div style={{ fontSize: 11, color: '#64748b', marginTop: 12, fontStyle: 'italic' }}>
            ℹ️ Upload nota pembayaran (Sprint 4) akan terpasang setelah Modul Storage selesai.
          </div>
        </div>

        {/* List */}
        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
            📋 Daftar Transaksi
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 8 }}>
              ({filteredList.length}{filterPeriode || filterTipe ? ` dari ${transaksiList.length}` : ''})
            </span>
          </h2>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="month" value={filterPeriode} onChange={(e) => updateFilter('periode', e.target.value)}
              style={{ ...input(), width: 160 }} />
            <select value={filterTipe} onChange={(e) => updateFilter('tipe', e.target.value)}
              style={{ ...input(), width: 160 }}>
              <option value="">Semua Tipe</option>
              <option value="MASUK">Pemasukan</option>
              <option value="KELUAR">Pengeluaran</option>
              <option value="TRANSFER">Transfer</option>
            </select>
            {(filterPeriode || filterTipe) && (
              <button onClick={() => router.push('/dashboard/akunting/expense')} style={btnSecondary()}>
                ✕ Reset
              </button>
            )}
          </div>

          {/* Tabel */}
          <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e2433' }}>
                  <th style={th()}>Tanggal</th>
                  <th style={th()}>Tipe</th>
                  <th style={th()}>Kategori</th>
                  <th style={th()}>Nominal</th>
                  <th style={th()}>Metode</th>
                  <th style={th()}>Keterangan</th>
                  <th style={th()}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    {transaksiList.length === 0 ? 'Belum ada transaksi.' : 'Tidak ada hasil filter.'}
                  </td></tr>
                )}
                {filteredList.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid #1e2433' }}>
                    <td style={td()}>{t.tanggal}</td>
                    <td style={td()}>
                      <span style={{
                        background: TIPE_COLOR[t.tipe] + '20',
                        color: TIPE_COLOR[t.tipe],
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      }}>
                        {t.tipe}
                      </span>
                    </td>
                    <td style={{ ...td(), fontFamily: 'monospace', fontSize: 11 }}>
                      {t.kategori?.kode} · <span style={{ fontFamily: 'inherit' }}>{t.kategori?.nama}</span>
                    </td>
                    <td style={{
                      ...td(), fontWeight: 700, color: TIPE_COLOR[t.tipe],
                    }}>
                      {t.tipe === 'MASUK' ? '+' : t.tipe === 'KELUAR' ? '−' : ''}{fmtRp(Number(t.nominal))}
                    </td>
                    <td style={{ ...td(), color: '#94a3b8' }}>{t.metode || '—'}</td>
                    <td style={{ ...td(), fontSize: 12, color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.keterangan || '—'}
                    </td>
                    <td style={td()}>
                      {t.sumber === 'MANUAL' && (
                        <button onClick={() => hapus(t.id)} disabled={busy}
                          style={{ ...btnSmall('#64748b') }}>Hapus</button>
                      )}
                      {t.sumber !== 'MANUAL' && (
                        <span style={{ fontSize: 10, color: '#64748b' }}>auto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.kind === 'ok' ? '#22c55e' : '#ef4444',
          color: '#fff', padding: '12px 20px', borderRadius: 10,
          fontWeight: 600, fontSize: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function input(): React.CSSProperties {
  return {
    width: '100%', padding: '8px 12px', background: '#0d111c',
    border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0',
    fontSize: 13, outline: 'none',
  }
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
function btnSecondary(): React.CSSProperties {
  return {
    background: '#1e2433', border: '1px solid #2d3748', color: '#94a3b8',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  }
}
function btnSmall(color: string): React.CSSProperties {
  return {
    background: color, border: 'none', color: '#fff',
    padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
    fontSize: 11, fontWeight: 600,
  }
}
