# � Sprint 2 — Modul Akunting

> **Tujuan:** Tracking laba-rugi otomatis dari data yang sudah ada (income dari `transaksi`, expense manual + auto dari inventaris).

---

## 📦 Scope

### Yang DICAKUP
- Master kategori akun (5 tipe: Aset, Liability, Equity, Income, Expense)
- Master rekening (kas, bank, e-wallet) — sederhana, 1-3 rekening per outlet
- Input transaksi keuangan manual (expense)
- **Auto-journal income** dari `transaksi` (XLSX yang sudah diimport)
- **Auto-journal expense** dari `stok_movement OUT` (modul inventaris)
- Recurring transaction (WiFi, listrik)
- Closing bulanan
- Laporan: Laba-Rugi, Cashflow, Neraca
- Export XLSX

### Yang TIDAK DICAKUP (sesuai keputusan)
- Gaji karyawan → tidak ada karyawan tetap
- PPN → Non-PKP
- Multi-currency
- Reconciliation bank otomatis

---

## 🗂️ Schema (migration `004_akunting.sql`)

Lihat detail lengkap di `010-spec-schema.md`. Singkat:

```
kategori_akun → transaksi_keuangan → periode_closing
rekening (sederhana, optional snapshot saldo)
```

Plus: **trigger & function** untuk auto-journal.

---

## 📋 Task Breakdown

### Phase 2A — DB & Seed

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 2.1 | Tulis `supabase/migrations/004_akunting.sql` (tabel + view) | 🤖 **Cline** | ⬜ | File SQL |
| 2.2 | Seed kategori akun default (4100, 5100-5400, 3100-3900) | � **Cline** | ⬜ | ~12 row seed |
| 2.3 | Trigger `auto_income_from_transaksi` (after insert `transaksi`) | 🤖 **Cline** | ⬜ | Function PG |
| 2.4 | Trigger `auto_expense_from_stok_out` (after insert `stok_movement OUT`) | 🤖 **Cline** | ⬜ | Function PG |
| 2.5 | View `v_laba_rugi`, `v_cashflow`, `v_neraca` | 🤖 **Cline** | ⬜ | 3 view DB |

### Phase 2B — Frontend Halaman Utama

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 2.6 | Halaman `src/app/dashboard/akunting/page.tsx` | 🤖 **Cline** | ⬜ | Dashboard laba-rugi bulan ini |
| 2.7 | Komponen `AkuntingClient.tsx` (chart + KPI) | 🤖 **Cline** | ⬜ | Visualisasi recharts |
| 2.8 | Tambah entry NAV di `Sidebar.tsx` (icon: 💰) | 🤖 **Cline** | ⬜ | Menu sidebar |

### Phase 2C — Input Expense Manual

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 2.9 | Halaman `src/app/dashboard/akunting/expense/page.tsx` | 🤖 **Cline** | ⬜ | Form input |
| 2.10 | Komponen `AkuntingExpenseForm.tsx` | 🤖 **Cline** | ⬜ | Form + upload nota |
| 2.11 | API route `POST /api/akunting/transaksi` | 🤖 **Cline** | ⬜ | Endpoint + validasi |
| 2.12 | List transaksi (dengan filter tanggal & kategori) | 🤖 **Cline** | ⬜ | Tabel interaktif |

### Phase 2D — Recurring Transaction

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 2.13 | Halaman `src/app/dashboard/akunting/recurring/page.tsx` | 🤖 **Cline** | ⬜ | Manage template |
| 2.14 | API route cron `POST /api/cron/run-recurring` | 🤖 **Cline** | ⬜ | Auto-generate tiap bulan |
| 2.15 | Setup cron job (Vercel Cron / Supabase Scheduled Function) | 👤 **Owner** | ⬜ | Scheduled trigger |

### Phase 2E — Closing Bulanan

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 2.16 | Halaman `src/app/dashboard/akunting/closing/page.tsx` | 🤖 **Cline** | ⬜ | Tombol "Tutup Buku" |
| 2.17 | Komponen `AkuntingClosingClient.tsx` | 🤖 **Cline** | ⬜ | Konfirmasi + preview laba |
| 2.18 | API route `POST /api/akunting/closing` | 🤖 **Cline** | � | Atomic: insert laba ditahan + lock periode |

### Phase 2F — Laporan

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 2.19 | Halaman Laporan Laba-Rugi (drill-down per kategori) | 🤖 **Cline** | ⬜ | Visual breakdown |
| 2.20 | Halaman Neraca | 🤖 **Cline** | ⬜ | Aset = Liability + Equity |
| 2.21 | Export XLSX Laba-Rugi + Cashflow | 🤖 **Cline** | ⬜ | Tombol download |

---

## ✅ Definition of Done (Sprint 2 Selesai)

- [ ] Migration `004_akunting.sql` jalan tanpa error
- [ ] Setelah import XLSX, baris auto-income langsung muncul di `transaksi_keuangan`
- [ ] Setiap stok keluar di inventaris → auto-create baris expense di `transaksi_keuangan`
- [ ] Owner bisa input expense manual (WiFi, listrik, dll) + upload nota
- [ ] Recurring transaction auto-generate tiap bulan (WiFi, listrik)
- [ ] Closing bulanan berfungsi: hitung laba, lock periode, insert laba ditahan
- [ ] Laporan Laba-Rugi, Cashflow, Neraca bisa dilihat & di-export
- [ ] Build `npm run build` sukses

---

## 🔗 Dependencies

- **Tergantung**: Sprint 1 (Inventaris) — untuk trigger auto-expense
- **Digunakan oleh**: Sprint 3 (Pajak) — untuk hitung dasar PPh Final

---

## ⚠️ Risiko & Catatan

- **Risiko**: trigger `auto_income_from_transaksi` bisa duplicate saat XLSX di-upload ulang untuk periode yang sama → perlu mekanisme **idempotent** (cek `unique(outlet_id, periode, sumber, ref_id)`)
- **Catatan**: Recurring transaction butuh cron job — Vercel Cron untuk project di Vercel, atau Supabase Edge Function
- **Catatan**: Neraca akan sangat sederhana di awal karena hanya ada Kas + Laba Ditahan → tidak perlu terlalu kompleks
- **Catatan**: Closing bulanan = **irreversible** (lock) — perlu konfirmasi UX yang kuat
