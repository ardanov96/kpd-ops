# 🏃 Sprint 4 — Storage + Recurring Transaction

> **Tujuan:** Setup Supabase Storage untuk upload file (nota & SSP), plus cron untuk recurring transaction.

---

## � Scope

### Yang DICAKUP
- Setup 2 bucket Supabase Storage:
  - `nota-expense/` — foto nota pembelian ATK, listrik, WiFi
  - `bukti-pajak/` — foto/PDF SSP PPh Final
- Validasi upload: maks 5 MB, format JPG/PNG/WebP/PDF
- Recurring transaction:
  - Template WiFi, listrik, sewa, dll yang fix tiap bulan
  - Auto-generate tiap bulan via cron
  - Halaman manage template (pause, edit, hapus)

### Yang TIDAK DICAKUP
- Resize/compress image otomatis (bisa nanti)
- OCR nota (baca teks dari foto)
- Multi-bucket per outlet (semua outlet pakai bucket yang sama)

---

## �️ Schema (migration `006_storage_recurring.sql`)

Lihat detail lengkap di `010-spec-schema.md`. Singkat:

```
recurring_transactions → (auto-generate tiap bulan) → transaksi_keuangan
```

Tabel ini sebenarnya bisa di migration `004_akunting.sql`, tapi saya pisah agar lebih modular.

---

## 📋 Task Breakdown

### Phase 4A — Storage Setup

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 4.1 | Setup bucket `nota-expense` di Supabase Dashboard | 👤 **Owner** | � | Bucket ready |
| 4.2 | Setup bucket `bukti-pajak` di Supabase Dashboard | 👤 **Owner** | ⬜ | Bucket ready |
| 4.3 | Setup RLS policy untuk storage (owner-only write) | 🤖 **Cline** | ⬜ | Policy PG |
| 4.4 | Helper `src/lib/storage.ts` (upload, get URL, delete) | 🤖 **Cline** | ⬜ | Fungsi reusable |

### Phase 4B — Recurring Transaction

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 4.5 | Tulis migration `006_storage_recurring.sql` (tabel recurring) | 🤖 **Cline** | ⬜ | File SQL |
| 4.6 | Tambah types di `src/types/index.ts` (RecurringTransaction) | 🤖 **Cline** | ⬜ | TypeScript types |
| 4.7 | Halaman `src/app/dashboard/akunting/recurring/page.tsx` | 🤖 **Cline** | ⬜ | List + form template |
| 4.8 | Komponen `AkuntingRecurringClient.tsx` | 🤖 **Cline** | ⬜ | CRUD template |
| 4.9 | API route `POST /api/akunting/recurring` (create/update/delete) | 🤖 **Cline** | ⬜ | Endpoint |
| 4.10 | API route cron `POST /api/cron/run-recurring` | 🤖 **Cline** | ⬜ | Scan template + insert transaksi_keuangan |
| 4.11 | Setup cron job (Vercel Cron / Supabase Scheduled Function) | 👤 **Owner** | � | Scheduled trigger harian |

### Phase 4C — Integrasi Upload Nota

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 4.12 | Komponen upload nota di `AkuntingExpenseForm.tsx` | 🤖 **Cline** | ⬜ | Drag-drop + preview |
| 4.13 | Komponen upload SSP di `PajakBuktiUpload.tsx` | 🤖 **Cline** | ⬜ | Drag-drop + preview |
| 4.14 | View file nota (klik untuk lihat full image) | 🤖 **Cline** | ⬜ | Lightbox modal |

---

## ✅ Definition of Done (Sprint 4 Selesai)

- [ ] Bucket `nota-expense` & `bukti-pajak` ready di Supabase Storage
- [ ] Owner bisa upload foto nota (JPG/PNG) & PDF (maks 5 MB)
- [ ] Owner bisa setup template recurring (WiFi tgl 5 Rp 300rb, PLN tgl 10 Rp 200rb)
- [ ] Cron job harian: scan template yang jatuh tempo → insert ke `transaksi_keuangan`
- [ ] Template bisa di-pause/edit/hapus
- [ ] File nota & SSP bisa dilihat dari list transaksi / rekap pajak
- [ ] Build `npm run build` sukses

---

## 🔗 Dependencies

- **Tergantung**: Sprint 2 (Akunting) untuk form expense & recurring page
- **Tergantung**: Sprint 3 (Pajak) untuk upload SSP
- **Bisa parallel**: dengan Sprint 2 & 3 jika bucket storage sudah ready duluan

---

## �️ Risiko & Catatan

- **Risiko**: Vercel Cron free tier hanya bisa 2 cron job per hari. Jika ada >2 cron, perlu upgrade atau pakai Supabase Scheduled Function.
- **Risiko**: Recurring transaction bisa duplicate jika cron jalan 2× di hari yang sama → perlu cek `unique(outlet_id, kategori_id, tanggal, recurring_id)`.
- **Catatan**: File upload lewat API route server-side (jangan dari client langsung) untuk amankan service_role key.
- **Catatan**: Storage RLS: owner-only write. Staff hanya bisa read file dari outlet sendiri.
