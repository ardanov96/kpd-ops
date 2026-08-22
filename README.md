# 📦 Ekspedisi Dashboard — Setup Guide

Sistem manajemen internal untuk outlet ekspedisi multi-franchise (Lion Parcel, JNE, J&T, Wahana).

**Status Modul:**
- ✅ Sprint 0 — Setup, Dashboard, Import XLSX
- ✅ Sprint 1 — Inventaris (stok, opname, kartu stok)
- ✅ Sprint 2 — Akunting (income, expense, recurring, closing)
- ✅ Sprint 3 — Pajak (PPh Final 0,5%, NPWP, SPT estimator)
- ✅ Sprint 4 — Storage + Recurring (upload nota, SSP)
- ✅ Sprint 5 — Export PDF/XLSX + Polish UX
- ✅ Sprint 6 — Security & Robustness (API auth, atomic ops, backup S3, timezone)

**Status Pengembangan Lanjutan (in-flight / backlog):**
- 🚧 Harian (recap harian) + Analitik perbandingan antar outlet/kurir
- 🚧 Cek Ongkir (lookup ongkir antar-kurir)
- ⏳ Sprint 7+ — Search STT, atomic expense+upload, multi-outlet scaling

**Versi:** `v1.0` (package.json: `"version": "0.1.0"`, label UI: "Dashboard v1.0")
**Stack:** Next.js 16 (App Router) + Supabase (PostgreSQL + Storage + Auth) + TypeScript + Tailwind CSS
**Library utama:** `@supabase/ssr`, `@supabase/supabase-js`, `recharts`, `xlsx`, `@react-pdf/renderer`, `pg`, `@aws-sdk/client-s3`, `date-fns`, `lucide-react`

---

## 🚀 Langkah Setup (Lokal)

### 1. Install Dependencies

```bash
cd ekspedisi-dashboard
npm install
```

### 2. Setup Supabase

1. Buka https://supabase.com dan buat project baru (gratis)
2. Masuk ke **SQL Editor** → klik **New Query**
3. **Jalankan migration SQL secara berurutan** (penting!):
   - `001_init.sql` (outlets, profiles, kurir, transaksi, dsb)
   - `002_daily_summary.sql`
   - `003_inventaris.sql`
   - `004_akunting.sql`
   - `005_pajak.sql`
   - `006_pajak_closing_trigger.sql` (patch agar closing auto-trigger PPh Final)
   - `006_storage_recurring.sql` (recurring template + bucket RLS)
   - `007_opname_atomic.sql` (opname anti-race condition)
   - `008_recurring_lastday.sql` (recurring tgl 31 di Feb handled)
   - `009_aggregate_income_idempotent.sql` (income aggregate idempotent)
   - `010_aggregate_income_clarity.sql` (kolom tambahan untuk klarifikasi)
   - `011_indexes_performance.sql` (index untuk query besar)
   - `012_stok_keluar_atomic.sql` (stok keluar race-safe via RPC)
4. Tunggu sampai semua tabel, views, function, dan seed data berhasil dibuat

### 3. Setup Supabase Storage (Sprint 4+)

Di Supabase Dashboard → **Storage**, buat 2 bucket **private**:
- `nota-expense` — foto nota expense (≤5MB, JPG/PNG/WebP/PDF)
- `bukti-pajak` — foto/PDF SSP PPh Final (≤5MB, JPG/PNG/PDF)

RLS sudah terpasang via `006_storage_recurring.sql`.

### 4. Ambil API Keys & URL Database Supabase

1. **API Keys**: Supabase Dashboard → **Project Settings** → **API**
   - Copy `Project URL` → untuk `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` key → untuk `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` key → untuk `SUPABASE_SERVICE_ROLE_KEY`
2. **Database URL** (untuk backup S3): **Project Settings** → **Database** → **Connection string** → **Transaction pooler**
   - Format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
   - Simpan sebagai `SUPABASE_DB_URL`

### 5. Buat File .env.local

```bash
cp .env.local.example .env.local
```

Isi dengan keys dari langkah 4 (lihat juga `.env.local.example` untuk variabel backup S3):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Cron Secret (opsional, untuk proteksi /api/cron/*)
CRON_SECRET=

# Backup S3 (Sprint 6+) — wajib untuk cron backup harian
SUPABASE_DB_URL=postgresql://...
BACKUP_S3_BUCKET=ekspedisi-backups
BACKUP_S3_REGION=ap-southeast-1
BACKUP_S3_ACCESS_KEY_ID=...
BACKUP_S3_SECRET_ACCESS_KEY=...
BACKUP_CRON_SECRET=<openssl rand -hex 32>
```

### 6. Buat User Pertama (Owner)

1. Di Supabase Dashboard → **Authentication** → **Users** → **Invite User**
2. Masukkan email kamu → Send Invite
3. Cek email, klik link, set password
4. Setelah login berhasil, jalankan SQL ini di SQL Editor untuk set role owner:

```sql
INSERT INTO profiles (id, nama, role, outlet_id)
VALUES (
  auth.uid(),  -- ganti dengan UUID user dari tabel auth.users
  'Nama Kamu',
  'owner',
  (SELECT id FROM outlets WHERE kode = 'KEPUNDUNG-1')
);
```

> Atau gunakan cara mudah: di tabel `auth.users`, copy UUID user kamu, lalu INSERT manual ke tabel `profiles`.

### 7. Jalankan Development Server

```bash
npm run dev
```

Default port: `3001` (lihat `package.json`). Buka http://localhost:3001 → otomatis redirect ke `/login`.

---

## 🧭 Menu Sidebar (Setelah Login)

Setelah login, sidebar kiri menampilkan menu berikut (lihat `src/components/Sidebar.tsx`):

| Menu | Path | Keterangan |
|---|---|---|
| 📅 Harian | `/dashboard/harian` | Recap transaksi harian |
| 📊 Ringkasan | `/dashboard` | KPI utama & trend |
| 📦 Transaksi | `/dashboard/transaksi` | Tabel semua transaksi |
| 📈 Analitik | `/dashboard/analitik` | Perbandingan per outlet/kurir |
| 💰 Akunting | `/dashboard/akunting` | Laba-rugi, expense, recurring, closing, laporan |
| 🧾 Pajak | `/dashboard/pajak` | PPh Final rekap + reminder (badge) |
| 🔍 Cek Ongkir | `/dashboard/ongkir` | Lookup ongkir antar-kurir |
| 📤 Import Laporan | `/dashboard/upload` | Upload XLSX Lion/JNE/J&T/Wahana |
| 📦 Inventaris | `/dashboard/inventaris` | Stok, opname, kartu stok (badge alert) |
| ⚙️ Pengaturan | `/dashboard/profil` | Profil user & signout |

> **Badge alert** (merah) muncul di:
> - **Pajak** → ada PPh Final `BELUM` jatuh tempo ≤ 7 hari
> - **Inventaris** → ada barang dengan `stok <= stok_min`

---

## 📤 Cara Import Laporan

1. Login → klik **Import Laporan** di sidebar
2. Pilih kurir (LION, JNE, JNT, WAHANA)
3. Pilih outlet
4. Isi periode bulan
5. Upload file XLSX laporan dari sistem masing-masing kurir (atau PDF untuk JNE)
6. Klik **Import Sekarang**

### Cara export laporan dari masing-masing kurir:
- **Lion Parcel**: Portal LP → Laporan → Export STT → Download XLSX
- **JNE**: myconsignee.jne.co.id → Laporan → Export Excel / PDF statement
- **J&T**: Portal J&T → History → Export
- **Wahana**: Portal Wahana → Laporan Pengiriman → Export

Parser tambahan:
- `src/lib/parsers/xlsxParser.ts` — Lion, J&T, Wahana (XLSX)
- `src/lib/parsers/jnePdfParser.ts` — JNE (PDF statement)

---

## 🌐 Deploy ke Vercel (Gratis Selamanya)

1. Push project ke GitHub:
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/username/ekspedisi-dashboard.git
git push -u origin main
```

2. Buka https://vercel.com → **New Project** → import repo GitHub
3. Di **Environment Variables**, tambahkan semua variabel dari `.env.local`:
   - Supabase (3 var wajib)
   - `SUPABASE_DB_URL` + 4 var `BACKUP_S3_*` + `BACKUP_CRON_SECRET` (untuk backup harian)
   - `CRON_SECRET` (opsional)
4. Klik **Deploy**
5. Selesai! Dapat URL gratis seperti `ekspedisi-dashboard.vercel.app`

### Cron Schedule

`vercel.json` sudah include 2 cron job:
| Path | Schedule | Keterangan |
|---|---|---|
| `/api/cron/run-recurring` | `0 23 * * *` (23:00 UTC = 06:00 WIB) | Generate recurring transactions harian |
| `/api/admin/backup` | `0 23 * * *` (23:00 UTC = 06:00 WIB) | Backup DB → S3 (Sprint 6+) |

Middleware otomatis skip kedua path ini (`/api/cron/*` & `/api/admin/*`) — lihat `D-030` di `docs/030-decision-log.md`.

---

## 📁 Struktur Project (Kondisi Terkini)

```
src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx        ← Auth guard + Sidebar (alert count)
│   │   ├── page.tsx          ← Ringkasan (overview)
│   │   ├── harian/           ← 📅 Recap harian
│   │   ├── transaksi/        ← Tabel semua transaksi
│   │   ├── analitik/         ← 📈 Perbandingan outlet/kurir
│   │   ├── akunting/         ← 💰 Akunting (laba-rugi, expense, recurring, closing)
│   │   │   ├── page.tsx
│   │   │   ├── expense/
│   │   │   ├── recurring/
│   │   │   ├── closing/
│   │   │   └── laba-rugi/
│   │   ├── pajak/            ← 🧾 Pajak (rekap, pengaturan, upload SSP, SPT)
│   │   │   ├── page.tsx
│   │   │   ├── pengaturan/
│   │   │   ├── rekap/
│   │   │   ├── upload-bukti/
│   │   │   └── spt/
│   │   ├── inventaris/       ← 📦 Inventaris (stok, opname, kartu stok)
│   │   │   ├── page.tsx
│   │   │   ├── [id]/         ← Kartu stok per barang
│   │   │   └── opname/
│   │   ├── ongkir/           ← 🔍 Cek ongkir antar-kurir
│   │   ├── upload/           ← 📤 Import XLSX/PDF
│   │   └── profil/           ← ⚙️ Pengaturan user
│   ├── api/
│   │   ├── upload/           ← POST import XLSX
│   │   ├── upload-jne/       ← POST import JNE PDF
│   │   ├── summary/          ← GET summary ringkasan
│   │   ├── summary-harian/   ← GET summary harian (untuk Harian)
│   │   ├── ekspedisi/        ← CRUD master data ekspedisi
│   │   ├── ongkir/           ← Cek ongkir (ongkir/check, ongkir/villages)
│   │   ├── auth/logout/      ← Logout
│   │   ├── akunting/         ← Modul akunting (transaksi, recurring, closing, export)
│   │   ├── inventaris/       ← Modul inventaris (barang, stok-masuk/k eluar, opname)
│   │   ├── pajak/            ← Modul pajak (config, rekap, generate, bayar)
│   │   ├── storage/          ← Upload nota/SSP, signed URL
│   │   ├── cron/             ← Cron endpoint (run-recurring)
│   │   └── admin/            ← Admin ops (backup DB → S3)
│   ├── login/                ← Halaman login
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── Sidebar.tsx           ← Menu + alert badge (inventaris, pajak)
│   ├── ClientProviders.tsx   ← ToastProvider, ConfirmProvider
│   └── dashboard/
│       ├── OverviewClient.tsx        ← KPI + chart ringkasan
│       ├── HarianClient.tsx          ← Recap harian
│       ├── TransaksiClient.tsx       ← Tabel transaksi
│       ├── AnalitikClient.tsx        ← Perbandingan
│       ├── AkuntingClient.tsx        ← KPI + chart
│       ├── AkuntingExpenseForm.tsx   ← Form + upload nota
│       ├── AkuntingRecurringClient.tsx ← Template CRUD
│       ├── AkuntingClosingClient.tsx ← Closing + konfirmasi
│       ├── AkuntingLaporanClient.tsx ← Laba-rugi + Neraca + Cashflow + export
│       ├── InventarisClient.tsx      ← List + modal CRUD & stok
│       ├── InventarisDetailClient.tsx← Kartu stok + export XLSX
│       ├── InventarisOpnameClient.tsx← Form opname
│       ├── PajakClient.tsx           ← KPI + reminder
│       ├── PajakPengaturanClient.tsx ← Form NPWP
│       ├── PajakRekapClient.tsx      ← Tabel rekap + filter
│       ├── PajakUploadBuktiClient.tsx← Drag-drop upload SSP
│       ├── PajakSPTClient.tsx        ← SPT tahunan + export
│       ├── ProfilClient.tsx          ← Profil user
│       ├── UploadClient.tsx          ← Form upload XLSX
│       ├── MobileShell.tsx           ← Responsive mobile
│       ├── EmptyState.tsx            ← Empty list placeholder
│       ├── LoadingSkeleton.tsx       ← Loading shimmer
│       ├── Toast.tsx                 ← Toast notification
│       ├── ConfirmDialog.tsx         ← Confirm dialog
│       ├── FileViewerModal.tsx       ← Lightbox file nota/SSP
│       └── ViewFileButton.tsx        ← Tombol lihat file via signed URL
├── lib/
│   ├── supabase/
│   │   ├── client.ts         ← Browser client
│   │   ├── server.ts         ← Server + Admin client
│   │   └── outlet.ts         ← Helper outlet aktif
│   ├── parsers/
│   │   ├── xlsxParser.ts     ← Parser Lion/J&T/Wahana (XLSX)
│   │   └── jnePdfParser.ts   ← Parser JNE (PDF)
│   ├── export/
│   │   ├── xlsx.ts           ← Helper export multi-sheet
│   │   └── pdf.tsx           ← Template PDF (@react-pdf/renderer)
│   ├── api/
│   │   ├── auth.ts           ← requireOwner(), requireAuth() (Sprint 6)
│   │   └── response.ts       ← apiOk/apiError/apiBadRequest (Sprint 6)
│   ├── storage.ts            ← Helper upload file ke Supabase Storage
│   └── timezone.ts           ← Asia/Makassar helpers (Sprint 6)
├── types/index.ts
└── middleware.ts             ← Auth protection (skip /api/cron/* & /api/admin/*)
supabase/
└── migrations/
    ├── 001_init.sql                    ← Tabel awal + RLS + seed
    ├── 002_daily_summary.sql
    ├── 003_inventaris.sql              ← Sprint 1
    ├── 004_akunting.sql                ← Sprint 2
    ├── 005_pajak.sql                   ← Sprint 3
    ├── 006_pajak_closing_trigger.sql   ← Sprint 3 patch
    ├── 006_storage_recurring.sql       ← Sprint 4
    ├── 007_opname_atomic.sql           ← Sprint 6 (race-safe opname)
    ├── 008_recurring_lastday.sql       ← Sprint 4 patch (Feb-31 handling)
    ├── 009_aggregate_income_idempotent.sql ← Sprint 6 (income idempotent)
    ├── 010_aggregate_income_clarity.sql    ← Sprint 6 (kolom tambahan)
    ├── 011_indexes_performance.sql     ← Sprint 6 (index tuning)
    └── 012_stok_keluar_atomic.sql      ← Sprint 6 (race-safe stok keluar)
docs/                                   ← Sprint briefs & spec (lihat docs/README.md)
```

---

## ➕ Menambahkan Kurir Baru (JNE, Wahana, dll)

Setelah mendapatkan sample laporan JNE/Wahana/J&T:

1. Buka `src/lib/parsers/xlsxParser.ts` (untuk XLSX) atau `src/lib/parsers/jnePdfParser.ts` (untuk PDF)
2. Update fungsi parser sesuai nama kolom aslinya
3. Test dengan upload file sample
4. Parser akan otomatis aktif saat kurir dipilih di halaman Upload

Untuk kurir PDF (seperti JNE statement PDF): lihat pattern di `jnePdfParser.ts` — return array of rows yang struktur-nya sama dengan hasil `xlsxParser`.

---

## 🔒 Keamanan

- Semua halaman `/dashboard/*` dilindungi middleware (auto redirect ke login)
- Row Level Security (RLS) aktif di semua tabel Supabase
- `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di server-side (API routes)
- **Sprint 6 hardening**:
  - API routes pakai `requireOwner()` untuk write & `requireAuth()` untuk read (lihat `src/lib/api/auth.ts`)
  - Staff hanya bisa akses outlet sendiri (defense-in-depth)
  - Storage endpoints (`upload-bukti`, `get-signed-url`) owner-only (NPWP/SSP sensitif)
  - Error response di-sanitize oleh `src/lib/api/response.ts` (tidak bocor schema DB)
- Backup DB di-encrypt gzip & di-upload ke S3 private bucket (Bearer token)
- Vercel environment variables di-encrypt at rest
- Cron endpoints dilindungi `CRON_SECRET` / `BACKUP_CRON_SECRET` (Bearer header)

---

## 📞 Troubleshooting

**Error "relation does not exist"** → Jalankan ulang semua migration SQL di Supabase SQL Editor **secara berurutan** (001 → 012).

**Upload gagal "Kurir tidak ditemukan"** → Pastikan seed data kurir sudah ada, atau tambahkan manual di tabel `kurir`.

**Login redirect loop** → Hapus cookies browser, coba lagi.

**Build error TypeScript** → Jalankan `npm run build` untuk cek semua error sebelum deploy.

**Tanggal / bulan "kemarin" padahal sekarang pagi** → Sistem pakai `src/lib/timezone.ts` (WIB/Asia-Makassar). Cek helper `getCurrentPeriodeWIB()`, `getTodayWIB()`.

**Backup S3 gagal** → Cek env vars: `SUPABASE_DB_URL`, `BACKUP_S3_*`, `BACKUP_CRON_SECRET`. Lihat log Vercel → Crons.

**Closing manual edit pajak "Periode locked"** → Ini by-design (Sprint 6 / `D-031`). Hubungi owner untuk unlock via DB manual jika perlu.

**Stok keluar "Stok tidak cukup"** → Ada race condition yang ter-detect atau stok fisik memang kurang. Lakukan **opname** untuk adjust.

**Recurring tidak generate** → Cek Vercel Dashboard → Crons → log `/api/cron/run-recurring`. Endpoint dilindungi `CRON_SECRET`.

---

## 📤 Export Laporan (Sprint 5)

Setiap halaman laporan punya tombol **Export XLSX** dan beberapa punya **Export PDF**:

| Halaman | Tombol Export |
|---|---|
| `/dashboard/akunting/laba-rugi` | 📥 Export XLSX (3 sheet: Laba-Rugi, Cashflow, Neraca) + 📄 Export PDF |
| `/dashboard/inventaris/[id]` | 📥 Export XLSX (Kartu Stok + Summary) |
| `/dashboard/pajak/spt` | 📋 Copy CSV + 🖨️ Print/Save as PDF (via `PDFDownloadLink`) |
| `/dashboard/pajak/rekap` | 📥 Export XLSX |

### Tambah kurir baru
Helper Excel generic di `src/lib/export/xlsx.ts` — bisa dipakai untuk laporan apapun:
```ts
import { exportAndDownloadXlsx } from '@/lib/export/xlsx'
exportAndDownloadXlsx({
  filename: 'Laporan_X.xlsx',
  sheets: [{ name: 'Sheet1', columns: [...], rows: [...] }],
})
```

### Export PDF laporan internal
Gunakan template `PdfReportTemplate` di `src/lib/export/pdf.tsx` (berbasis `@react-pdf/renderer`).

### Library yang dipakai
- `xlsx` (SheetJS) — client-side XLSX generation
- `@react-pdf/renderer` — client-side PDF (~5MB, tanpa Puppeteer)

## 🗃️ Storage Setup (Sprint 4)

Setup 2 bucket Supabase (private):
1. `nota-expense` — foto nota expense, ≤5MB, JPG/PNG/WebP/PDF
2. `bukti-pajak` — foto/PDF SSP PPh Final, ≤5MB, JPG/PNG/PDF

Jalankan `supabase/migrations/006_storage_recurring.sql` di SQL Editor untuk RLS policies.

Sprint 6 tambahan: storage endpoints (`upload-bukti`, `get-signed-url`) owner-only via `requireOwner()`.

## 🧾 Pajak Setup (Sprint 3)

1. Buka `/dashboard/pajak/pengaturan` → isi NPWP, nama WP, pilih PKP/non-PKP, form_spt
2. Setiap kali **Tutup Buku** di `/dashboard/akunting/closing`, sistem auto-generate PPh Final 0,5% ke `pajak_rekap`
3. Reminder badge muncul di dashboard utama saat jatuh tempo ≤7 hari (`v_pajak_reminder`)
4. Buka `/dashboard/pajak/spt` untuk lihat SPT estimator + Export PDF/CSV untuk konsultan pajak

## 🔐 Setup Backup S3 (Sprint 6)

Backup harian via Vercel Cron → S3.

1. Buat S3 bucket (e.g. `ekspedisi-backups`) di AWS Console
2. IAM → User → Attach policy `AmazonS3PutObjectOnly` untuk bucket tersebut
3. Copy Access Key ID & Secret → set di `.env.local` sebagai `BACKUP_S3_ACCESS_KEY_ID` & `BACKUP_S3_SECRET_ACCESS_KEY`
4. Set `BACKUP_S3_BUCKET` & `BACKUP_S3_REGION`
5. Generate `BACKUP_CRON_SECRET` dengan `openssl rand -hex 32`
6. Set di Vercel Environment Variables saat deploy
7. Backup jalan otomatis tiap hari jam 23:00 UTC = 06:00 WIB

Restore: download file `.sql.gz` dari S3, decompress (`gunzip`), lalu execute SQL di Supabase SQL Editor.

---

## 🆕 Modul yang Sudah Hadir (Pasca Sprint 5)

### 📅 Harian (`/dashboard/harian`)
Recap harian omzet, jumlah STT, breakdown per kurir. Data dari `/api/summary-harian`.

### 📈 Analitik (`/dashboard/analitik`)
Perbandingan antar outlet & antar kurir dengan chart recharts.

### 🔍 Cek Ongkir (`/dashboard/ongkir`)
Lookup ongkir antar-kurir untuk rute tertentu:
- `/api/ongkir/check` — hitung ongkir Lion/JNE/J&T/Wahana
- `/api/ongkir/villages` — autocomplete desa/kecamatan

### ⚙️ Pengaturan (`/dashboard/profil`)
Profil user, signout. (Pengaturan outlet akan di-extend di Sprint 7+.)

### 📦 Modul Ekspedisi (`/api/ekspedisi`)
CRUD master data ekspedisi (jika outlet mendukung multi-ekspedisi).

---

## 📚 Dokumentasi Lengkap

Lihat folder `docs/` untuk dokumentasi detail per modul dan sprint:
- `docs/000-glossary.md` — Istilah teknis & akunting
- `docs/001-sprint-modul-inventaris.md` ... `005-sprint-export-pdf-xlsx.md` — Sprint briefs
- `docs/MODUL-INVENTARIS.md` / `MODUL-AKUNTING.md` / `MODUL-PAJAK.md` — Dokumentasi fitur
- `docs/010-spec-schema.md` — Schema SQL final
- `docs/020-spec-workflow.md` — Workflow & otomasi tiap modul
- `docs/030-decision-log.md` — Log keputusan teknis (termasuk Sprint 6: `D-027` s/d `D-034`)
