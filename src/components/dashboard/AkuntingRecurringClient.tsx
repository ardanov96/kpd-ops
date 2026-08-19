'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TipeTransaksiKeuangan, MetodeBayar, KategoriAkun, RecurringTransaction } from '@/types'

type FormState = {
  nama_template: string
  kategori_id: string
  tipe: TipeTransaksiKeuangan
  nominal: number
  metode: MetodeBayar | ''
  tanggal_setiap_bulan: number
  aktif: boolean
}

export default function AkuntingRecurringClient({
  outlet, kategoriList, recurringList,
}: {
  outlet: { id: string; kode: string; nama: string }
  kategoriList: KategoriAkun[]
  recurringList: any[]
}) {
  const router = useRouter()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    nama_template: '',
    kategori_id: '',
    tipe: 'KELUAR',
    nominal: 0,
    metode: 'CASH',
    tanggal_setiap_bulan: 1,
    aktif: true,
  })
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 2500)
  }

  function openAdd() {
    setEditId(null)
    setForm({
      nama_template: '', kategori_id: '', tipe: 'KELUAR',
      nominal: 0, metode: 'CASH', tanggal_setiap_bulan: 1, aktif: true,
    })
    setShowForm(true)
  }

  function openEdit(r: any) {
    setEditId(r.id)
    setForm({
      nama_template: r.nama_template,
      kategori_id: r.kategori_id,
      tipe: r.tipe,
      nominal: Number(r.nominal),
      metode: r.metode || 'CASH',
      tanggal_setiap_bulan: r.tanggal_setiap_bulan,
      aktif: r.aktif,
    })
    setShowForm(true)
  }

  async function submit() {
    if (!form.nama_template.trim()) return showToast('Nama template wajib diisi', 'err')
    if (!form.kategori_id) return showToast('Kategori wajib dipilih', 'err')
    if (!form.nominal || form.nominal <= 0) return showToast('Nominal harus > 0', 'err')
    if (form.tanggal_setiap_bulan < 1 || form.tanggal_setiap_bulan > 31) {
      return showToast('Tanggal harus 1-31', 'err')
    }
    setBusy(true)
    try {
      const payload = {
        outlet_id: outlet.id,
        nama_template: form.nama_template.trim(),
        kategori_id: form.kategori_id,
        tipe: form.tipe,
        nominal: Number(form.nominal),
        metode: form.metode || null,
        tanggal_setiap_bulan: form.tanggal_setiap_bulan,
        aktif: form.aktif,
      }
      const res = await fetch(
        editId ? `/api/akunting/recurring/${editId}` : '/api/akunting/recurring',
        {
          method: editId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal simpan')
      showToast(editId ? 'Template diupdate' : 'Template ditambahkan')
      setShowForm(false)
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function hapus(id: string) {
    if (!confirm('Hapus template recurring ini?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/akunting/recurring/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal hapus')
      showToast('Template dihapus')
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function toggleAktif(id: string, currentAktif: boolean) {
    setBusy(true)
    try {
      const res = await fetch(`/api/akunting/recurring/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif: !currentAktif }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Gagal update')
      }
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function triggerNow() {
    if (!confirm('Jalankan recurring sekarang? Akan generate transaksi untuk semua template aktif hari ini.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/cron/run-recurring', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal')
      showToast(`Recurring selesai. ${json.count || 0} transaksi di-generate.`)
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
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
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🔁 Recurring Transactions</h1>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              {outlet.nama} ({outlet.kode})
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={triggerNow} disabled={busy}
              style={btnSecondary()}>
              ▶️ Jalankan Sekarang
            </button>
            <button onClick={openAdd} disabled={busy}
              style={btnPrimary('#f97316')}>
              + Template Baru
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: '#1e243340', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: '#94a3b8' }}>
        ℹ️ Template aktif akan auto-generate transaksi setiap tanggal yang ditentukan (via Vercel Cron harian jam 06:00 WIB).
        Klik <strong>Jalankan Sekarang</strong> untuk trigger manual.
        Aturan tanggal: jika bulan tidak punya tanggal 31 (Feb), akan generate di tanggal terakhir bulan itu.
      </div>

      {/* List */}
      <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e2433' }}>
              <th style={th()}>Nama Template</th>
              <th style={th()}>Tipe</th>
              <th style={th()}>Kategori</th>
              <th style={th()}>Nominal</th>
              <th style={th()}>Metode</th>
              <th style={th()}>Tanggal/Bulan</th>
              <th style={th()}>Aktif</th>
              <th style={th()}>Last Run</th>
              <th style={th()}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {recurringList.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                Belum ada template. Klik <strong>+ Template Baru</strong> untuk mulai.
              </td></tr>
            )}
            {recurringList.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid #1e2433', opacity: r.aktif ? 1 : 0.5 }}>
                <td style={{ ...td(), fontWeight: 600 }}>{r.nama_template}</td>
                <td style={td()}>
                  <span style={{
                    background: (r.tipe === 'MASUK' ? '#22c55e' : '#ef4444') + '20',
                    color: r.tipe === 'MASUK' ? '#22c55e' : '#ef4444',
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  }}>
                    {r.tipe}
                  </span>
                </td>
                <td style={{ ...td(), fontFamily: 'monospace', fontSize: 11 }}>
                  {r.kategori?.kode} · <span style={{ fontFamily: 'inherit' }}>{r.kategori?.nama}</span>
                </td>
                <td style={{ ...td(), fontWeight: 700 }}>
                  {r.tipe === 'MASUK' ? '+' : '−'}Rp {Number(r.nominal).toLocaleString('id-ID')}
                </td>
                <td style={{ ...td(), color: '#94a3b8' }}>{r.metode || '—'}</td>
                <td style={{ ...td(), textAlign: 'center' }}>
                  Tgl <strong style={{ color: '#f97316' }}>{r.tanggal_setiap_bulan}</strong>
                </td>
                <td style={td()}>
                  <button onClick={() => toggleAktif(r.id, r.aktif)} disabled={busy}
                    style={{
                      background: r.aktif ? '#22c55e' : '#64748b',
                      border: 'none', color: '#fff',
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    }}>
                    {r.aktif ? '✅ ON' : '⏸ OFF'}
                  </button>
                </td>
                <td style={{ ...td(), fontSize: 11, color: '#64748b' }}>
                  {r.last_run ? new Date(r.last_run).toLocaleString('id-ID') : '—'}
                </td>
                <td style={td()}>
                  <button onClick={() => openEdit(r)} disabled={busy}
                    style={{ ...btnSmall('#3b82f6'), marginRight: 4 }}>Edit</button>
                  <button onClick={() => hapus(r.id)} disabled={busy}
                    style={btnSmall('#64748b')}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#111827', border: '1px solid #1e2433', borderRadius: 12,
            padding: 24, width: '90%', maxWidth: 480,
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
              {editId ? 'Edit Template' : '+ Template Baru'}
            </h2>

            <Field label="Nama Template *">
              <input value={form.nama_template} onChange={(e) => setForm({ ...form, nama_template: e.target.value })}
                style={input()} placeholder="misal: WiFi Bulanan, Listrik, Sewa Outlet" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Tipe *">
                <select value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value as TipeTransaksiKeuangan })}
                  style={input()}>
                  <option value="KELUAR">⬇️ Pengeluaran</option>
                  <option value="MASUK">⬆️ Pemasukan</option>
                </select>
              </Field>
              <Field label="Tanggal Setiap Bulan (1-31) *">
                <input type="number" min="1" max="31" value={form.tanggal_setiap_bulan}
                  onChange={(e) => setForm({ ...form, tanggal_setiap_bulan: Number(e.target.value) })} style={input()} />
              </Field>
            </div>

            <Field label={`Kategori * (${form.tipe === 'MASUK' ? 'Income' : 'Expense'})`}>
              <select value={form.kategori_id} onChange={(e) => setForm({ ...form, kategori_id: e.target.value })} style={input()}>
                <option value="">-- pilih --</option>
                {kategoriList
                  .filter((k) => (form.tipe === 'MASUK' ? k.tipe === 'INCOME' : k.tipe === 'EXPENSE'))
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.kode} · {k.nama}
                    </option>
                  ))}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Nominal (Rp) *">
                <input type="number" min="0" step="100" value={form.nominal || ''}
                  onChange={(e) => setForm({ ...form, nominal: Number(e.target.value) })} style={input()} />
              </Field>
              <Field label="Metode">
                <select value={form.metode} onChange={(e) => setForm({ ...form, metode: e.target.value as MetodeBayar })}
                  style={input()}>
                  <option value="CASH">💵 Cash</option>
                  <option value="BANK">🏦 Bank</option>
                  <option value="EWALLET">📱 E-Wallet</option>
                </select>
              </Field>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}>
              <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
              Aktif (auto-generate setiap bulan)
            </label>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={btnSecondary()}>Batal</button>
              <button onClick={submit} disabled={busy}
                style={{ ...btnPrimary('#f97316'), opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Menyimpan...' : editId ? 'Update' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.kind === 'ok' ? '#22c55e' : '#ef4444',
          color: '#fff', padding: '12px 20px', borderRadius: 10,
          fontWeight: 600, fontSize: 14,
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
    border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
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
function btnPrimary(color: string): React.CSSProperties {
  return {
    background: color, border: 'none', color: '#fff',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
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
    padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
  }
}
