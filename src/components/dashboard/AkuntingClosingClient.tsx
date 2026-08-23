'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './Toast'

const fmtRp = (n: number) =>
  'Rp. ' + Math.round(n).toLocaleString('id-ID') + ',-'

const CONFIRM_TEXT = 'KONFIRMASI CLOSING'

export default function AkuntingClosingClient({
  outlet, selectedPeriode, recommendedPeriode, currentPeriode,
  preview, existing, history,
}: {
  outlet: { id: string; kode: string; nama: string }
  selectedPeriode: string
  recommendedPeriode: string
  currentPeriode: string
  preview: { total_income: number; total_expense: number; laba_kotor: number }
  existing: any
  history: any[]
}) {
  const router = useRouter()
  const [periode, setPeriode] = useState(selectedPeriode)
  const [confirmInput, setConfirmInput] = useState('')
  const [busy, setBusy] = useState(false)
  const { showToast } = useToast()

  function changePeriode(p: string) {
    const params = new URLSearchParams()
    if (p) params.set('periode', p)
    router.push(`/dashboard/akunting/closing?${params.toString()}`)
  }

  async function doClosing() {
    if (confirmInput !== CONFIRM_TEXT) {
      return showToast(`Ketik "${CONFIRM_TEXT}" untuk melanjutkan`, 'err')
    }
    setBusy(true)
    try {
      const res = await fetch('/api/akunting/closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outlet.id, periode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal closing')
      showToast(`Periode ${periode} berhasil di-closing. Laba: ${fmtRp(Number(json.laba))}`)
      setConfirmInput('')
      router.refresh()
    } catch (e: any) {
      showToast(e.message || 'Error', 'err')
    } finally {
      setBusy(false)
    }
  }

  const isLocked = !!existing?.is_locked
  const income = Number(preview.total_income || 0)
  const expense = Number(preview.total_expense || 0)
  const laba = Number(preview.laba_kotor || 0)
  const margin = income > 0 ? (laba / income * 100).toFixed(2) : '0.00'

  return (
    <div style={{ padding: '24px 32px', color: '#e2e8f0' }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push('/dashboard/akunting')}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8 }}>
          ← Kembali ke Akunting
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🔒 Closing Bulanan</h1>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
          {outlet.nama} ({outlet.kode})
        </div>
      </div>

      {isLocked && (
        <div style={{
          background: '#3b82f620', border: '1px solid #3b82f6',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <strong style={{ color: '#3b82f6' }}>🔒 Periode {selectedPeriode} sudah di-closing.</strong>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Closed at: {existing.closed_at ? new Date(existing.closed_at).toLocaleString('id-ID') : '—'}
            · Catatan: {existing.catatan || '—'}
          </div>
        </div>
      )}

      {/* Pilih periode */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, color: '#94a3b8' }}>Periode:</label>
        <input type="month" value={periode} onChange={(e) => { setPeriode(e.target.value); changePeriode(e.target.value) }}
          style={{
            padding: '8px 12px', background: '#0d111c', border: '1px solid #1e2433',
            borderRadius: 8, color: '#e2e8f0', fontSize: 13,
          }} />
        {recommendedPeriode !== currentPeriode && (
          <button onClick={() => changePeriode(recommendedPeriode)}
            style={{
              background: '#1e2433', border: '1px solid #f59e0b', borderRadius: 8,
              color: '#f59e0b', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
            }}>
            ⭐ Rekomendasi: {recommendedPeriode}
          </button>
        )}
      </div>

      {!isLocked && (
        <div style={{
          background: '#ef444420', border: '1px solid #ef4444',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
        }}>
          <strong style={{ color: '#ef4444' }}>⚠️ Closing adalah irreversible.</strong>
          <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 4 }}>
            Setelah di-closing, laba akan tersimpan permanen ke akun <strong>3900 Laba Ditahan</strong> dan periode ini terkunci.
            Pastikan semua transaksi sudah benar.
          </div>
        </div>
      )}

      {/* Preview Laba-Rugi */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 16,
      }}>
        <PreviewCard label="Total Income" value={income} color="#22c55e" icon="⬆️" />
        <PreviewCard label="Total Expense" value={expense} color="#ef4444" icon="⬇️" />
        <PreviewCard label="Laba Kotor" value={laba} color={laba >= 0 ? '#3b82f6' : '#ef4444'} icon="💵" />
        <PreviewCard label="Margin" value={`${margin}%`} color="#f97316" icon="📐" isText />
      </div>

      {/* Form konfirmasi */}
      {!isLocked && (
        <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>🔐 Konfirmasi Closing</h2>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
            Untuk mengunci periode <strong>{periode}</strong>, ketik teks berikut persis (case-sensitive):
          </p>
          <div style={{
            background: '#0d111c', border: '1px dashed #1e2433', borderRadius: 8,
            padding: '8px 12px', marginBottom: 12, fontFamily: 'monospace',
            color: '#ef4444', fontWeight: 700, textAlign: 'center', fontSize: 14,
          }}>
            {CONFIRM_TEXT}
          </div>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={`Ketik: ${CONFIRM_TEXT}`}
            style={{
              width: '100%', padding: '10px 12px', background: '#0d111c',
              border: '1px solid #1e2433', borderRadius: 8, color: '#e2e8f0',
              fontSize: 14, fontFamily: 'monospace', outline: 'none',
              marginBottom: 12,
            }}
          />
          <button
            onClick={doClosing}
            disabled={busy || confirmInput !== CONFIRM_TEXT}
            style={{
              width: '100%', background: '#ef4444', border: 'none', color: '#fff',
              padding: '12px 16px', borderRadius: 8,
              cursor: confirmInput === CONFIRM_TEXT ? 'pointer' : 'not-allowed',
              fontSize: 14, fontWeight: 700,
              opacity: confirmInput === CONFIRM_TEXT ? 1 : 0.4,
            }}
          >
            {busy ? '⏳ Memproses...' : '🔒 Tutup Buku & Lock Periode'}
          </button>
        </div>
      )}

      {/* History */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>📜 History Closing</h2>
        {history.length === 0 ? (
          <div style={{ color: '#64748b', padding: 24, textAlign: 'center', background: '#111827', borderRadius: 10 }}>
            Belum ada history closing.
          </div>
        ) : (
          <div style={{ background: '#111827', border: '1px solid #1e2433', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e2433' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11 }}>Periode</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11 }}>Income</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11 }}>Expense</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11 }}>Laba</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11 }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontSize: 11 }}>Closed At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={{ borderTop: '1px solid #1e2433' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>{h.periode}</td>
                    <td style={{ padding: '10px 12px', color: '#22c55e' }}>{fmtRp(Number(h.total_income))}</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444' }}>{fmtRp(Number(h.total_expense))}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: Number(h.laba) >= 0 ? '#3b82f6' : '#ef4444' }}>
                      {fmtRp(Number(h.laba))}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {h.is_locked ? (
                        <span style={{ background: '#3b82f620', color: '#3b82f6', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>🔒 LOCKED</span>
                      ) : (
                        <span style={{ background: '#f59e0b20', color: '#f59e0b', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>⚠ OPEN</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 11 }}>
                      {h.closed_at ? new Date(h.closed_at).toLocaleString('id-ID') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

function PreviewCard({ label, value, color, icon, isText }:
  { label: string; value: number | string; color: string; icon: string; isText?: boolean }) {
  return (
    <div style={{
      background: '#111827', border: '1px solid #1e2433', borderRadius: 10,
      padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: isText ? 20 : 16, fontWeight: 800, color }}>
        {isText ? value : fmtRp(value as number)}
      </div>
    </div>
  )
}
