# 🏃 Sprint 5 — Export PDF/XLSX & Polish

> **Tujuan:** Export laporan siap diberikan ke konsultan pajak, plus polish UX & build production.

---

## 📦 Scope

### Yang DICAKUP
- Export Laporan Laba-Rugi (XLSX) per outlet per bulan
- Export Laporan Cashflow (XLSX) per outlet per bulan
- Export SPT Tahunan Estimator (PDF + XLSX)
- Export Kartu Stok per barang (XLSX)
- Tombol "Export" di setiap halaman laporan
- Polish UI/UX: empty states, loading, error handling
- Build production & deploy

### Yang TIDAK DICAKUP
- Email otomatis laporan ke konsultan pajak
- Template PDF multi-bahasa
- Custom branding (logo, warna) — pakai default dulu

---

## � Task Breakdown

### Phase 5A — Export XLSX (pakai library `xlsx` yang sudah ada)

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 5.1 | Helper `src/lib/export/xlsx.ts` (generic export function) | � **Cline** | ⬜ | Fungsi reusable |
| 5.2 | Tombol Export di halaman Laba-Rugi | 🤖 **Cline** | ⬜ | Download XLSX |
| 5.3 | Tombol Export di halaman Cashflow | 🤖 **Cline** | ⬜ | Download XLSX |
| 5.4 | Tombol Export Kartu Stok per barang | 🤖 **Cline** | ⬜ | Download XLSX |
| 5.5 | API route `GET /api/akunting/export?type=laba-rugi&periode=YYYY-MM` | 🤖 **Cline** | ⬜ | Server-side export |

### Phase 5B — Export PDF (pakai library `pdf-parse` atau alternatif)

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 5.6 | Pilih library PDF (saran: `@react-pdf/renderer` untuk client, atau `puppeteer` server) | 🤖 **Cline** | ⬜ | Library installed |
| 5.7 | Helper `src/lib/export/pdf.ts` (template laporan) | 🤖 **Cline** | ⬜ | Fungsi reusable |
| 5.8 | Tombol Export PDF SPT Tahunan | 🤖 **Cline** | ⬜ | Download PDF |
| 5.9 | Template PDF SPT Tahunan (header, tabel, footer) | 🤖 **Cline** | ⬜ | Layout rapi |

### Phase 5C — Polish UX

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 5.10 | Empty state untuk semua list (gambar + teks ajakan input) | 🤖 **Cline** | ⬜ | Lebih informatif |
| 5.11 | Loading skeleton (bukan spinner doang) | 🤖 **Cline** | ⬜ | Lebih smooth |
| 5.12 | Toast notification untuk success/error | 🤖 **Cline** | ⬜ | Feedback UX |
| 5.13 | Konfirmasi dialog untuk aksi destruktif (delete, close period) | 🤖 **Cline** | ⬜ | Mencegah salah klik |
| 5.14 | Mobile responsive check (sidebar collapse, tabel scroll) | 🤖 **Cline** | ⬜ | Tampilan HP oke |

### Phase 5D — Production Build

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 5.15 | `npm run build` sukses tanpa error | 🤖 **Cline** | ⬜ | Build clean |
| 5.16 | Test semua flow end-to-end (import XLSX → modul baru) | 👤 **Owner** | ⬜ | Manual QA |
| 5.17 | Update README.md dengan modul baru | 🤖 **Cline** | ⬜ | Dokumentasi |
| 5.18 | Deploy ke Vercel | 👤 **Owner** | ⬜ | Live URL |

---

## ✅ Definition of Done (Sprint 5 Selesai)

- [ ] Semua laporan bisa di-export ke XLSX
- [ ] SPT Tahunan bisa di-export ke PDF (siap kasih ke konsultan pajak)
- [ ] UX dipoles: empty state, loading, toast, konfirmasi
- [ ] Mobile responsive
- [ ] Build production clean
- [ ] Manual QA passed (semua flow dari import XLSX → pajak)
- [ ] README updated
- [ ] Deployed ke Vercel

---

## 🔗 Dependencies

- **Tergantung**: Sprint 1, 2, 3, 4 selesai

---

## ⚠️ Risiko & Catatan

- **Risiko**: Library PDF besar (`puppeteer` ~200MB) — jika dipakai, deploy di Vercel mungkin kena limit. Alternatif: `@react-pdf/renderer` (~5MB, client-side).
- **Risiko**: XLSX export dengan data besar bisa lemot — chunking per 1000 baris jika perlu.
- **Catatan**: PDF template harus mengikuti format standar DJP (untuk SPT) atau format internal (untuk laporan internal). Konsultan pajak akan cek format.
