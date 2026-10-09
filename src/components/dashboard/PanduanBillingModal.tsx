'use client'

import React, { useState } from 'react'

export default function PanduanBillingModal({
  isOpen,
  onClose,
  periode,
  nominal,
  npwp,
  namaWp,
}: {
  isOpen: boolean
  onClose: () => void
  periode?: string | null
  nominal?: number | null
  npwp?: string | null
  namaWp?: string | null
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!isOpen) return null

  function copyText(text: string, fieldName: string) {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const fmtRp = (n: number) =>
    'Rp. ' + Math.round(Number(n || 0)).toLocaleString('id-ID') + ',-'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e2433',
          borderRadius: 16,
          maxWidth: 680,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: '#e2e8f0',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1e2433',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: '#111827',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📖</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                Panduan Bayar e-Billing DJP
              </h2>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Tata cara pembuatan kode billing PPh Final 0,5% PT Perorangan
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1e2433',
              border: 'none',
              color: '#94a3b8',
              borderRadius: 8,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Copy Info Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid #334155',
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
              ⚡ Data Wajib untuk Formulir e-Billing SSE (DJP)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {/* NPWP */}
              <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: 8, border: '1px solid #1e2433' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>NPWP PT Perorangan</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa', fontFamily: 'monospace' }}>
                    {npwp || '0407175918901000'}
                  </span>
                  <button
                    onClick={() => copyText((npwp || '0407175918901000').replace(/\D/g, ''), 'npwp')}
                    style={{
                      background: copiedField === 'npwp' ? '#22c55e' : '#1e2433',
                      color: copiedField === 'npwp' ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {copiedField === 'npwp' ? '✓ Tersalin' : 'Salin'}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {namaWp || 'MEGAE MEMARGI RAGA'}
                </div>
              </div>

              <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: 8, border: '1px solid #1e2433' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Jenis Pajak (KAP)</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>411128</span>
                  <button
                    onClick={() => copyText('411128', 'kap')}
                    style={{
                      background: copiedField === 'kap' ? '#22c55e' : '#1e2433',
                      color: copiedField === 'kap' ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {copiedField === 'kap' ? '✓ Tersalin' : 'Salin'}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>PPh Final</div>
              </div>

              <div style={{ background: '#090d16', padding: '10px 14px', borderRadius: 8, border: '1px solid #1e2433' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Jenis Setoran (KJS)</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#f97316', fontFamily: 'monospace' }}>420</span>
                  <button
                    onClick={() => copyText('420', 'kjs')}
                    style={{
                      background: copiedField === 'kjs' ? '#22c55e' : '#1e2433',
                      color: copiedField === 'kjs' ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {copiedField === 'kjs' ? '✓ Tersalin' : 'Salin'}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>PPh Final UMKM (PP 55 / PP 20)</div>
              </div>
            </div>

            {periode && nominal && nominal > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Masa Pajak: <strong style={{ color: '#e2e8f0' }}>{periode}</strong></span>
                <span style={{ color: '#94a3b8' }}>
                  Jumlah Setor: <strong style={{ color: '#22c55e', fontSize: 15 }}>{fmtRp(nominal)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Steps */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#f1f5f9' }}>
              📝 6 Langkah Pembayaran:
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StepItem
                num={1}
                title="Login ke DJP Online"
                desc="Buka djponline.pajak.go.id, login menggunakan NPWP PT Perorangan Anda (15/16 digit) dan password akun DJP Badan."
              />
              <StepItem
                num={2}
                title="Buka Menu e-Billing"
                desc="Di navbar atas, klik menu 'Bayar' lalu pilih ikon 'e-Billing' untuk masuk ke formulir Surat Setoran Elektronik (SSE)."
              />
              <StepItem
                num={3}
                title="Isi Formulir e-Billing SSE"
                desc="Pilih Jenis Pajak 411128, Jenis Setoran 420, Masa Pajak (bulan yang ingin dibayar), Tahun Pajak, dan ketik Jumlah Setor sesuai tagihan di dashboard."
              />
              <StepItem
                num={4}
                title="Buat Kode Billing"
                desc="Klik tombol 'Buat Kode Billing', masukkan kode captcha, lalu klik Cetak. Anda akan menerima 15 digit Kode Billing (berlaku 30 hari)."
              />
              <StepItem
                num={5}
                title="Bayar via M-Banking / ATM / E-Commerce"
                desc="Bayar di M-Banking (menu Pembayaran → Penerimaan Negara / Pajak DJP), Teller Bank, Kantor Pos, atau Tokopedia/Blibli menggunakan 15 digit Kode Billing."
              />
              <StepItem
                num={6}
                title="Upload Bukti & Tandai LUNAS"
                desc="Simpan struk / Bukti Penerimaan Negara (BPN) yang memuat kode NTPN. Kembali ke halaman ini, masukkan tanggal bayar, catatan NTPN, upload struk, dan centang Set LUNAS."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #1e2433',
            background: '#0d111c',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          <a
            href="https://djponline.pajak.go.id"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            🌐 Buka DJP Online ↗
          </a>

          <button
            onClick={onClose}
            style={{
              background: '#1e2433',
              border: 'none',
              color: '#e2e8f0',
              padding: '10px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

function StepItem({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: '#1e2433',
          border: '1px solid #334155',
          color: '#f97316',
          fontSize: 12,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {num}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}
