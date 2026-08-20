# 📦 Ekspedisi Dashboard — Setup Guide

Sistem manajemen internal untuk outlet ekspedisi multi-franchise (Lion Parcel, JNE, J&T, Wahana).

**Status Modul:**
- ✅ Sprint 0 — Setup, Dashboard, Import XLSX
- ✅ Sprint 1 — Inventaris (stok, opname, kartu stok)
- ✅ Sprint 2 — Akunting (income, expense, recurring, closing)
- ✅ Sprint 3 — Pajak (PPh Final 0,5%, NPWP, SPT estimator)
- ✅ Sprint 4 — Storage + Recurring (upload nota, SSP)
- ✅ Sprint 5 — Export PDF/XLSX + Polish UX

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
3. Copy-paste isi file `supabase/migrations/001_init.sql` → klik **Run**
4. Tunggu sampai semua tabel, views, dan seed data berhasil dibuat

### 3. Ambil API Keys Supabase

1. Di Supabase Dashboard → **Project Settings** → **API**
2. Copy:
   - `Project URL` → untuk `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → untuk `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → untuk `SUPABASE_SERVICE_ROLE_KEY`

### 4. Buat File .env.local

```bash
cp .env.local.example .env.local
```

Isi dengan keys dari langkah 3:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

### 5. Buat User Pertama (Owner)

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

### 6. Jalankan Development Server

```bash
npm run dev
```

Buka http://localhost:3000 → otomatis redirect ke `/login`

---

## 📤 Cara Import Laporan

1. Login → klik **Import Laporan** di sidebar
2. Pilih kurir (LION, JNE, JNT, WAHANA)
3. Pilih outlet
4. Isi periode bulan
5. Upload file XLSX laporan dari sistem masing-masing kurir
6. Klik **Import Sekarang**

### Cara export laporan dari masing-masing kurir:
- **Lion Parcel**: Portal LP → Laporan → Export STT → Download XLSX
- **JNE**: myconsignee.jne.co.id → Laporan → Export Excel
- **J&T**: Portal J&T → History → Export
- **Wahana**: Portal Wahana → Laporan Pengiriman → Export

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
3. Di **Environment Variables**, tambahkan semua isi `.env.local`
4. Klik **Deploy**
5. Selesai! Dapat URL gratis seperti `ekspedisi-dashboard.vercel.app`

---

## 📁 Struktur Project

```
src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx        ← Auth guard + Sidebar
│   │   ├── page.tsx          ← Overview dashboard
│   │   ├── transaksi/        ← Tabel semua transaksi
│   │   └── upload/           ← Import XLSX
│   ├── api/
│   │   ├── upload/           ← POST handler import XLSX
│   │   ├── summary/          ← GET summary data
│   │   └── auth/logout/      ← Logout
│   ├── login/                ← Halaman login
│   └── globals.css
├── components/
│   ├── Sidebar.tsx
│   └── dashboard/
│       ├── OverviewClient.tsx   ← Charts & KPI
│       ├── TransaksiClient.tsx  ← Tabel transaksi
│       └── UploadClient.tsx     ← Form upload
├── lib/
│   ├── supabase/
│   │   ├── client.ts         ← Browser client
│   │   └── server.ts         ← Server + Admin client
│   └── parsers/
│       └── xlsxParser.ts     ← Parser XLSX per kurir
├── types/index.ts
└── middleware.ts             ← Auth protection
supabase/
└── migrations/
    └── 001_init.sql          ← Semua tabel, views, RLS
```

---

## ➕ Menambahkan Kurir Baru (JNE, Wahana, dll)

Setelah mendapatkan sample laporan JNE/Wahana/J&T:

1. Buka `src/lib/parsers/xlsxParser.ts`
2. Update fungsi `parseJNERow` / `parseWahanaRow` / `parseJNTRow` sesuai nama kolom aslinya
3. Test dengan upload file sample
4. Parser akan otomatis aktif saat kurir dipilih di halaman Upload

---

## 🔒 Keamanan

- Semua halaman `/dashboard/*` dilindungi middleware (auto redirect ke login)
- Row Level Security (RLS) aktif di semua tabel Supabase
- `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di server-side (API routes)
- Staff hanya bisa melihat data outlet mereka sendiri

---

## 📞 Troubleshooting

**Error "relation does not exist"** → Jalankan ulang `001_init.sql` di Supabase SQL Editor

**Upload gagal "Kurir tidak ditemukan"** → Pastikan seed data kurir sudah ada, atau tambahkan manual di tabel `kurir`

**Login redirect loop** → Hapus cookies browser, coba lagi

**Build error TypeScript** → Jalankan `npm run build` untuk cek semua error sebelum deploy

---

## 📤 Export Laporan (Sprint 5)

Setelah Sprint 5, setiap halaman laporan punya tombol **Export XLSX** dan beberapa punya **Export PDF**:

| Halaman | Tombol Export |
|---|---|
| `/dashboard/akunting/laba-rugi` | 📥 Export XLSX (3 sheet) + 📄 Export PDF |
| `/dashboard/inventaris/[id]` | 📥 Export XLSX (Kartu Stok + Summary) |
| `/dashboard/pajak/spt` | 📋 Copy CSV + 🖨️ Print/Save as PDF |

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

## 🧾 Pajak Setup (Sprint 3)

1. Buka `/dashboard/pajak/pengaturan` → isi NPWP, nama WP, pilih PKP/non-PKP, form_spt
2. Setiap kali **Tutup Buku** di `/dashboard/akunting/closing`, sistem auto-generate PPh Final 0,5% ke `pajak_rekap`
3. Reminder badge muncul di dashboard utama saat jatuh tempo ≤7 hari
4. Buka `/dashboard/pajak/spt` untuk lihat SPT estimator + Export PDF/CSV untuk konsultan pajak
