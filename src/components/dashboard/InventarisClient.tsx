'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { StokAktual, KategoriInventaris } from '@/types'

const fmt = (n: number) =>
  n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt`
  : n >= 1_000   ? `Rp ${(n / 1_000).toFixed(0)}rb`
  : `Rp ${n}`

const fmtFull = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

type BarangForm = {
  kategori_id: string
  sku: string
  nama: string
  satuan: string
  stok_min: number
  harga_beli: number
  aktif: boolean
}

const SATUAN_OPTIONS = ['pcs', 'box', 'roll', 'lembar', 'meter', 'pack', 'botol', 'rim']

const emptyForm: BarangForm = {
  kategori_id: '',
  sku: '',
  nama: '',
  satuan: 'pcs',
  stok_min: 0,
  harga_beli: 0,
  aktif: true,
}

type StokForm = {
  barang_id: string
  qty: number
  harga_satuan: number
  tanggal: string
  keterangan: string
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function InventarisClient({
  outlet, initialStok, kategoriList, belowMinCount,
}: {
  outlet: { id: string; kode: string; nama: string }
  initialStok: any[]
  kategoriList: KategoriInventaris[]
  belowMinCount: number
}) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [filterKategori, setFilterKategori] = useState('')

  // Modal states
  const [showBarangModal, setShowBarangModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<BarangForm>(emptyForm)

  const [showStokModal, setShowStokModal] = useState<null | 'IN' | 'OUT'>(null)
  const [stokForm, setStokForm] = useState<StokForm>({
    barang_id: '', qty: 1, harga_satuan: 0, tanggal: todayIso(), keterangan: '',
  })

  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 2500)
  }

  // Filtered list
  const filtered = useMemo(() => {
    return initialStok.filter((s) => {
      if (filterKategori && s.kategori_id !== filterKategori) return false
      if (search) {
        const q = search.toLowerCase()
        if (!s.nama.toLowerCase().includes(q) &&
            !(s.sku || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [initialStok, search, filterKategori])

  // ── CRUD BARANG ─────────────────────────────────────
  function openAddBarang() {
    setEditId(null)
    setForm({ ...emptyForm, kategori_id: kategoriList[0]?.id || '' })
    setShowBarangModal(true)
  }

  function openEditBarang(b: any) {
    setEditId(b.barang_id)
    setForm({
      kategori_id: b.kategori_id,
      sku: b.sku || '',
      nama: b.nama,
      satuan: b.satuan,
      stok_min: b.stok_min,
      harga_beli: b.harga_beli,
      aktif: b.aktif,
    })
    setShowBarangModal(true)
  }

  async function submitBarang() {
    if (!form.nama.trim()) return showToast('Nama barang wajib diisi', 'err')
    if (!form.kategori_id) return showToast('Kategori wajib dipilih', 'err')
    setBusy(true)
    try {
      const payload = {
        outlet_id: outlet.id,
        kategori_id: form.kategori_id,
        sku: form.sku.trim() || null,
        nama: form.nama.trim(),
        satuan: form.satuan,
        stok_min: Number(form.stok_min) || 0,
        harga_beli: Number(form.harga_beli) || 0,
        aktif: form.aktif,
      }
      const url = editId
        ? `/api/inventaris/barang/${editId}`
        : '/api/inventaris/barang'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal simpan')
      showToast(editId ? 'Barang diupdate' : 'Barang ditambahkan')
      setShowBarangModal(false)
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function hapusBarang(id: string, nama: string) {
    if (!confirm(`Hapus barang "${nama}"? Data movement terkait tetap ada.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/inventaris/barang/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal hapus')
      showToast('Barang dinonaktifkan')
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  // ── STOK MOVEMENT ───────────────────────────────────
  function openStokModal(tipe: 'IN' | 'OUT', barangId?: string) {
    const initialBarangId = barangId || initialStok[0]?.barang_id || ''
    const selected = initialStok.find((s) => s.barang_id === initialBarangId)
    setStokForm({
      barang_id: initialBarangId,
      qty: 1,
      harga_satuan: selected?.harga_beli || 0,
      tanggal: todayIso(),
      keterangan: '',
    })
    setShowStokModal(tipe)
  }

  async function submitStok() {
    if (!stokForm.barang_id) return showToast('Pilih barang', 'err')
    if (!stokForm.qty || stokForm.qty <= 0) return showToast('Qty harus > 0', 'err')
    setBusy(true)
    try {
      const endpoint = showStokModal === 'IN'
        ? '/api/inventaris/stok-masuk'
        : '/api/inventaris/stok-keluar'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barang_id: stokForm.barang_id,
          qty: Number(stokForm.qty),
          harga_satuan: Number(stokForm.harga_satuan) || 0,
          tanggal: stokForm.tanggal,
          keterangan: stokForm.keterangan.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal simpan')
      showToast(showStokModal === 'IN' ? 'Stok masuk tercatat' : 'Stok keluar tercatat')
      setShowStokModal(null)
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  // Update harga_satuan when barang changes in stok modal
  function onBarangChange(id: string) {
    const selected = initialStok.find((s) => s.barang_id === id)
    setStokForm({
      ...stokForm,
      barang_id: id,
      harga_satuan: selected?.harga_beli || 0,
    })
  }

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📦 Inventaris</h1>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            {outlet.nama} ({outlet.kode})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => openStokModal('IN')}
            disabled={busy || initialStok.length === 0}
            style={btnPrimary('#22c55e')}>
            ➕ Stok Masuk
          </button>
          <button onClick={() => openStokModal('OUT')}
            disabled={busy || initialStok.length === 0}
            style={btnPrimary('#ef4444')}>
            ➖ Stok Keluar
          </button>
          <button onClick={() => router.push('/dashboard/inventaris/opname')}
            style={btnSecondary()}>
            📋 Opname Bulanan
          </button>
          <button onClick={openAddBarang} disabled={busy}
            style={btnPrimary('#f97316')}>
            + Tambah Barang
          </button>
        </div>
      </div>

      {/* Alert minimum */}
      {belowMinCount > 0 && (
        <div style={{
          background: '#ef444420', border: '1px solid #ef4444',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#ef4444' }}>
              {belowMinCount} barang di bawah stok minimum
            </div>
            <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 2 }}>
              Segera lakukan restock. Lihat tabel di bawah (badge merah).
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Cari nama / SKU..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={inputStyle()}
        />
        <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}
          style={inputStyle()}>
          <option value="">Semua Kategori</option>
          {kategoriList.map((k) => (
            <option key={k.id} value={k.id}>{k.nama}</option>
          ))}
        </select>
      </div>

      {/* Tabel */}
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e2433' }}>
              <th style={th()}>Kategori</th>
              <th style={th()}>Nama Barang</th>
              <th style={th()}>SKU</th>
              <th style={th()}>Satuan</th>
              <th style={th()}>Stok</th>
              <th style={th()}>Min</th>
              <th style={th()}>Harga Beli</th>
              <th style={th()}>Status</th>
              <th style={th()}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                {initialStok.length === 0 ? 'Belum ada barang. Klik "Tambah Barang".' : 'Tidak ada hasil filter.'}
              </td></tr>
            )}
            {filtered.map((b) => (
              <tr key={b.barang_id} style={{ borderTop: '1px solid #1e2433' }}>
                <td style={td()}>{b.kategori?.nama || '-'}</td>
                <td style={td()}>
                  <a href={`/dashboard/inventaris/${b.barang_id}`}
                    style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>
                    {b.nama}
                  </a>
                </td>
                <td style={{ ...td(), color: '#64748b', fontFamily: 'monospace' }}>
                  {b.sku || '-'}
                </td>
                <td style={td()}>{b.satuan}</td>
                <td style={{
                  ...td(), fontWeight: 700,
                  color: b.is_below_min ? '#ef4444' : '#22c55e',
                }}>
                  {Number(b.stok).toLocaleString('id-ID')}
                </td>
                <td style={{ ...td(), color: '#94a3b8' }}>{Number(b.stok_min).toLocaleString('id-ID')}</td>
                <td style={td()}>{fmt(b.harga_beli)}</td>
                <td style={td()}>
                  {b.is_below_min
                    ? <span style={badgeStyle('#ef4444')}>⚠️ Minimum</span>
                    : <span style={badgeStyle('#22c55e')}>✓ Aman</span>}
                  {!b.aktif && <span style={{ ...badgeStyle('#64748b'), marginLeft: 4 }}>Non-aktif</span>}
                </td>
                <td style={td()}>
                  <button onClick={() => openEditBarang(b)} disabled={busy}
                    style={btnSmall('#3b82f6')}>Edit</button>
                  {b.aktif && (
                    <button onClick={() => hapusBarang(b.barang_id, b.nama)} disabled={busy}
                      style={{ ...btnSmall('#64748b'), marginLeft: 4 }}>Hapus</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        Total: {filtered.length} barang
        {filterKategori || search ? ` (filter aktif dari ${initialStok.length})` : ''}
      </div>

      {/* ── Modal Barang (CRUD) ─────────────────────── */}
      {showBarangModal && (
        <Modal onClose={() => setShowBarangModal(false)} title={editId ? 'Edit Barang' : 'Tambah Barang'}>
          <Field label="Kategori *">
            <select value={form.kategori_id} onChange={(e) => setForm({ ...form, kategori_id: e.target.value })}
              style={inputStyle()}>
              <option value="">-- pilih --</option>
              {kategoriList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </Field>
          <Field label="Nama Barang *">
            <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })}
              style={inputStyle()} placeholder="Karton Box M" />
          </Field>
          <Field label="SKU (opsional)">
            <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
              style={inputStyle()} placeholder="KR-001" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Satuan *">
              <select value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })}
                style={inputStyle()}>
                {SATUAN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Stok Minimum">
              <input type="number" min="0" step="1" value={form.stok_min}
                onChange={(e) => setForm({ ...form, stok_min: Number(e.target.value) })}
                style={inputStyle()} />
            </Field>
          </div>
          <Field label="Harga Beli (Rp)">
            <input type="number" min="0" step="1" value={form.harga_beli}
              onChange={(e) => setForm({ ...form, harga_beli: Number(e.target.value) })}
              style={inputStyle()} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
            Aktif
          </label>
          <ModalActions
            onCancel={() => setShowBarangModal(false)}
            onSubmit={submitBarang}
            busy={busy}
            submitLabel={editId ? 'Update' : 'Simpan'}
          />
        </Modal>
      )}

      {/* ── Modal Stok (IN / OUT) ───────────────────── */}
      {showStokModal && (
        <Modal onClose={() => setShowStokModal(null)}
          title={showStokModal === 'IN' ? '➕ Catat Stok Masuk' : '➖ Catat Stok Keluar'}>
          <Field label="Barang *">
            <select value={stokForm.barang_id}
              onChange={(e) => onBarangChange(e.target.value)}
              style={inputStyle()}>
              <option value="">-- pilih --</option>
              {initialStok.map((b) => (
                <option key={b.barang_id} value={b.barang_id}>
                  {b.nama} (stok: {Number(b.stok).toLocaleString('id-ID')} {b.satuan})
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={showStokModal === 'IN' ? 'Qty Masuk *' : 'Qty Keluar *'}>
              <input type="number" min="0.01" step="0.01" value={stokForm.qty}
                onChange={(e) => setStokForm({ ...stokForm, qty: Number(e.target.value) })}
                style={inputStyle()} />
            </Field>
            <Field label="Harga Satuan (Rp)">
              <input type="number" min="0" step="1" value={stokForm.harga_satuan}
                onChange={(e) => setStokForm({ ...stokForm, harga_satuan: Number(e.target.value) })}
                style={inputStyle()} />
            </Field>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: -8, marginBottom: 12 }}>
            Total: <strong style={{ color: '#f1f5f9' }}>
              {fmtFull(Number(stokForm.qty) * Number(stokForm.harga_satuan))}
            </strong>
          </div>
          <Field label="Tanggal *">
            <input type="date" value={stokForm.tanggal}
              onChange={(e) => setStokForm({ ...stokForm, tanggal: e.target.value })}
              style={inputStyle()} />
          </Field>
          <Field label="Keterangan (opsional)">
            <textarea value={stokForm.keterangan}
              onChange={(e) => setStokForm({ ...stokForm, keterangan: e.target.value })}
              style={{ ...inputStyle(), minHeight: 60, resize: 'vertical' }}
              placeholder={showStokModal === 'OUT' ? 'misal: untuk paket Lion #STT12345' : 'misal: belanja Tokopedia'} />
          </Field>
          {showStokModal === 'OUT' && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: -8, marginBottom: 12, fontStyle: 'italic' }}>
              ℹ️ Auto-journal ke Beban ATK akan dipasang di Sprint 2.
            </div>
          )}
          <ModalActions
            onCancel={() => setShowStokModal(null)}
            onSubmit={submitStok}
            busy={busy}
            submitLabel={showStokModal === 'IN' ? 'Catat Masuk' : 'Catat Keluar'}
          />
        </Modal>
      )}

      {/* Toast */}
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

// ── Helper components ─────────────────────────────────
function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#111827', border: '1px solid #1e2433', borderRadius: 12,
        padding: 24, width: '90%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{title}</h2>
        {children}
      </div>
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

function ModalActions({ onCancel, onSubmit, busy, submitLabel }:
  { onCancel: () => void; onSubmit: () => void; busy: boolean; submitLabel: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} disabled={busy} style={btnSecondary()}>Batal</button>
      <button onClick={onSubmit} disabled={busy} style={btnPrimary('#f97316')}>
        {busy ? '...' : submitLabel}
      </button>
    </div>
  )
}

// ── Style helpers ──────────────────────────────────────
function th(): React.CSSProperties {
  return {
    padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#94a3b8',
    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
  }
}
function td(): React.CSSProperties {
  return { padding: '10px 12px', color: '#e2e8f0' }
}
function inputStyle(): React.CSSProperties {
  return {
    width: '100%', padding: '8px 12px', background: '#0d111c',
    border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0',
    fontSize: 13, outline: 'none',
  }
}
function btnPrimary(color: string): React.CSSProperties {
  return {
    background: color, border: 'none', color: '#fff',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
  }
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
function badgeStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-block', background: color + '20', color, border: `1px solid ${color}`,
    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
  }
}
