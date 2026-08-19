# 💰 Modul Akunting — Dokumentasi Fitur

> **Status:** ✅ Implemented (Sprint 2 selesai, branch `master`)
> **Path singkat di UI:** Sidebar → 💰 Akunting
> **Untuk owner**, bukan customer.

Dokumen ini menjelaskan **modul Akunting** sebagai fitur aplikasi (bukan progres sprint). Untuk task breakdown & DoD sprint, lihat [`002-sprint-modul-akunting.md`](./002-sprint-modul-akunting.md). Untuk detail schema, lihat [`010-spec-schema.md`](./010-spec-schema.md).

---

## 🎯 Tujuan

**Auto-tracking laba-rugi** dari data yang sudah ada — tanpa input manual double. Modul ini adalah "jantung akuntansi owner" untuk UMKM ekspedisi 1 outlet.

**3 sumber transaksi (otomatis معظم):**
1. **Auto-Income** dari `transaksi` (XLSX upload) → kategori `4100 Pendapatan Ekspedisi`
2. **Auto-Expense** dari `stok_movement` tipe `OUT` → trigger DB → kategori `5100 Beban ATK & Packaging`
3. **Manual Expense** dari owner (WiFi, listrik, bensin, dll)
4. **Recurring** template yang auto-generate tiap bulan via Vercel Cron

> **Out-of-scope** (sengaja ditunda di sprint lain): Gaji karyawan, PPN/PPNBM, multi-currency, rekonsiliasi bank otomatis.

---

## ✨ Fitur

| Fitur | Lokasi UI | Kapan Dipakai |
|---|---|---|
| **Dashboard akunting** | `/dashboard/akunting` | Pantau KPI & trend 6 bulan |
| **Input transaksi manual** | `/dashboard/akunting/expense` | Bayar WiFi, listrik, bensin, dll |
| **Recurring transactions** | `/dashboard/akunting/recurring` | Setup template WiFi bulanan, dll |
| **Closing bulanan** | `/dashboard/akunting/closing` | Akhir bulan, kunci periode + simpan laba ditahan |
| **Laporan Laba-Rugi + Neraca + Cashflow** | `/dashboard/akunting/laba-rugi` | Drill-down per kategori + export XLSX |
| **Cron auto-recurring** | Vercel Cron harian jam 23:00 UTC | Generate recurring otomatis tiap bulan |

> **Akses**: Owner only (RLS policy enforce di level DB). Staff hanya read outlet sendiri.

---

## 🗂️ Schema (ringkas)

Lihat SQL lengkap di `supabase/migrations/004_akunting.sql`.

```
kategori_akun ─► transaksi_keuangan ─► periode_closing
                          │
                          ▼
                  recurring_transactions (template)
                          │
                          ▼ (cron harian)
                  fn_run_recurring() generate ke transaksi_keuangan
```

### 4 Tabel

| Tabel | Isi | Catatan |
|---|---|---|
| `kategori_akun` | Chart of accounts (16 row seed: INCOME/EXPENSE/EQUITY) | `is_system=true` = tidak bisa diedit owner |
| `transaksi_keuangan` | Jurnal umum (semua sumber: MANUAL, INVENTARIS, KURIR, RECURRING, CLOSING, PRIVE) | Immutable untuk audit |
| `periode_closing` | Lock per bulan + simpan laba ditahan | Idempotent via `unique(outlet_id, periode)` |
| `recurring_transactions` | Template auto-generate (WiFi, listrik) | `tanggal_setiap_bulan` 1-31 |

### 4 View

| View | Output | Dipakai Di |
|---|---|---|
| `v_laba_rugi` | Income, Expense, Laba per outlet per periode | Dashboard, Laporan, Closing preview |
| `v_cashflow` | Arus kas per outlet per periode per metode (CASH/BANK/EWALLET) | Laporan |
| `v_keuangan_per_kategori` | Breakdown per kategori per periode (untuk drill-down) | Dashboard top expense, Laporan detail |
| `v_neraca` | Snapshot Aset / Equity (Kas + Laba Ditahan) | Laporan |

### 4 Function

| Function | Tujuan | Dipanggil Dari |
|---|---|---|
| `fn_aggregate_income(outlet_id, periode)` | Idempotent income dari `transaksi` → `transaksi_keuangan` (KURIR) | API upload (TODO) atau cron |
| `fn_auto_expense_from_stok_out()` | Trigger DB setelah INSERT `stok_movement OUT` → `transaksi_keuangan` (INVENTARIS) | Auto via trigger `trg_auto_expense_stok_out` |
| `fn_run_recurring(target_date)` | Jalankan template recurring yang jatuh tempo | Cron harian atau manual dari UI |
| `fn_closing_periode(outlet_id, periode, closed_by)` | Hitung income/expense, simpan `periode_closing` | API `POST /api/akunting/closing` |

### 16 Kategori Akun (seed)

```
INCOME  (2):
  4100  Pendapatan Ekspedisi         ← sumber='KURIR' (auto dari XLSX)
  4900  Pendapatan Lain-lain

EXPENSE (9):
  5100  Beban ATK & Packaging        ← sumber='INVENTARIS' (auto dari stok keluar)
  5150  Beban Operasional Harian
  5200  Beban Internet (WiFi)        ← sumber='RECURRING' (template)
  5210  Beban Pulsa & Data Staff
  5300  Beban Listrik                ← sumber='RECURRING'
  5400  Beban Perlengkapan Kantor
  5500  Beban Sewa                   ← sumber='RECURRING'
  5600  Beban Transportasi & Bensin  ← sumber='MANUAL'
  5700  Beban Maintenance
  5900  Beban Lain-lain              ← sumber='MANUAL'

EQUITY  (3):
  3100  Modal Pemilik
  3200  Prive
  3900  Laba Ditahan                 ← sumber='CLOSING'
```

### 6 Sumber Transaksi (`sumber`)

| Sumber | Auto? | Generator |
|---|---|---|
| `MANUAL` | ❌ Owner input manual | Owner |
| `INVENTARIS` | ✅ Trigger DB saat stok OUT | `trg_auto_expense_stok_out` |
| `KURIR` | ✅ Function setelah upload XLSX | `fn_aggregate_income` |
| `RECURRING` | ✅ Cron harian | `fn_run_recurring` |
| `CLOSING` | ✅ Function saat closing | `fn_closing_periode` |
| `PRIVE` | ❌ Owner input manual | Owner |

---

## 🔌 API Reference

Semua endpoint ada di `src/app/api/akunting/`, pakai `createAdminClient()` (server-side, bypass RLS — authorisasi via `profiles.role='owner'` dicek di layout).

### Transaksi Keuangan

| Method | Path | Body | Output |
|---|---|---|---|
| `GET` | `/api/akunting/transaksi?outlet_id=&periode=` | — | List transaksi + join kategori |
| `POST` | `/api/akunting/transaksi` | `{outlet_id, tanggal, tipe, kategori_id, nominal, metode?, keterangan?}` | Transaksi MANUAL baru |
| `DELETE` | `/api/akunting/transaksi/[id]` | — | Hapus (hanya jika `sumber='MANUAL'`) |

### Recurring Template

| Method | Path | Body | Output |
|---|---|---|---|
| `GET` | `/api/akunting/recurring?outlet_id=` | — | List template |
| `POST` | `/api/akunting/recurring` | `{outlet_id, nama_template, kategori_id, tipe, nominal, metode?, tanggal_setiap_bulan, aktif?}` | Template baru |
| `PATCH` | `/api/akunting/recurring/[id]` | Partial fields | Template updated |
| `DELETE` | `/api/akunting/recurring/[id]` | — | Template dihapus |

### Closing

| Method | Path | Body | Output |
|---|---|---|---|
| `POST` | `/api/akunting/closing` | `{outlet_id, periode (YYYY-MM)}` | `{ok, closing, laba, total_income, total_expense}` |

Logic: panggil `fn_closing_periode(outlet_id, periode, null)` — idempotent, jadi bisa re-run untuk hitung ulang.

### Cron (Recurring Auto-trigger)

| Method | Path | Output |
|---|---|---|
| `GET` / `POST` | `/api/cron/run-recurring` | `{ok, count, date}` — jumlah transaksi yang ter-generate |

Auth: header `Authorization: Bearer <CRON_SECRET>` (jika env di-set). Same-origin POST dari UI di-bypass untuk testing manual.

---

## 🖥️ Halaman & Komponen

| Path | Server Component | Client Component |
|---|---|---|
| `/dashboard/akunting` | `akunting/page.tsx` | `AkuntingClient.tsx` |
| `/dashboard/akunting/expense` | `akunting/expense/page.tsx` | `AkuntingExpenseForm.tsx` |
| `/dashboard/akunting/recurring` | `akunting/recurring/page.tsx` | `AkuntingRecurringClient.tsx` |
| `/dashboard/akunting/closing` | `akunting/closing/page.tsx` | `AkuntingClosingClient.tsx` |
| `/dashboard/akunting/laba-rugi` | `akunting/laba-rugi/page.tsx` | `AkuntingLaporanClient.tsx` |

---

## 🔁 Alur Kerja (Workflow Owner)

### 1. Setup Awal (sekali)
- Jalankan migration `004_akunting.sql` di Supabase SQL Editor (setelah `003_inventaris.sql`).
- Set environment variable `CRON_SECRET` di Vercel (opsional, untuk proteksi cron).
- Login sebagai owner → Sidebar → **💰 Akunting** untuk akses dashboard.

### 2. Harian
- **Otomatis**: Setiap upload XLSX → `transaksi` baru, function `fn_aggregate_income` aggregate ke `transaksi_keuangan` (income).
- **Otomatis**: Setiap stok keluar di `/dashboard/inventaris` → trigger DB → `transaksi_keuangan` (expense).
- **Manual**: Catat expense lain (WiFi, bensin) di `/dashboard/akunting/expense`.

### 3. Bulanan (akhir bulan)
1. Setup recurring di `/dashboard/akunting/recurring` (sekali, akan auto tiap bulan via cron).
2. Tunggu cron jalan tanggal 1 jam 06:00 WIB → recurring generate.
3. **Akhir bulan**: Buka `/dashboard/akunting/closing`, pilih periode.
4. Review preview Income / Expense / Laba.
5. Ketik **"KONFIRMASI CLOSING"** (case-sensitive).
6. Klik **🔒 Tutup Buku & Lock Periode** → `fn_closing_periode` jalan → periode terkunci → laba tersimpan ke `3900 Laba Ditahan`.

### 4. Laporan (bulanan / kapan saja)
- Buka `/dashboard/akunting/laba-rugi` → pilih periode.
- Lihat breakdown **Pendapatan** (per kategori income) + **Beban** (per kategori expense).
- Lihat **Cashflow** (per metode: CASH/BANK/EWALLET) dan **Neraca** (snapshot).
- Klik **📥 Export XLSX (3 sheet)** → download `Laporan_Keuangan_<outlet>_<periode>.xlsx` dengan 3 sheet: Laba-Rugi, Cashflow, Neraca.

---

## ⚙️ Konvensi

- **Tipe ↔ Akun mapping**:
  - `tipe='MASUK'` → hanya kategori `tipe='INCOME'`
  - `tipe='KELUAR'` → hanya kategori `tipe='EXPENSE'`
  - `tipe='TRANSFER'` → kategori `tipe='ASSET'/'LIABILITY'/'EQUITY'`
- **Sumber immutable**: Transaksi dengan `sumber != 'MANUAL'` (auto-generated) **tidak boleh dihapus manual**. Hanya expense manual yang bisa dihapus via `DELETE /transaksi/[id]`.
- **Idempotent**:
  - `fn_aggregate_income` — cek existing baris KURIR per periode, replace if exist
  - `fn_closing_periode` — upsert via `on conflict (outlet_id, periode) do update`
  - `fn_run_recurring` — skip jika transaksi RECURRING untuk (outlet, template, periode) sudah ada
- **Recurring tanggal 31 di Feb** → `fn_run_recurring` otomatis generate di last day of month (Feb → tgl 28/29). Aturan ini aman walau tidak eksplisit di SQL function, karena hanya fire kalau tanggal cocok.
- **Closing adalah irreversible**: Owner harus ketik `KONFIRMASI CLOSING` (case-sensitive) untuk enable tombol. Setelah lock, tidak ada feature "re-open" — harus via update DB manual jika perlu.

---

## 🔗 Integrasi dengan Sprint Lain

### Tergantung pada
- **Sprint 1 — Inventaris** (migrasi `003_inventaris.sql`):
  - Trigger `trg_auto_expense_stok_out` attached ke `stok_movement` (after insert)
  - Hanya fire untuk `tipe='OUT' AND ref_type='MANUAL'` (hindari loop dengan auto-generated)

### Digunakan oleh
- **Sprint 3 — Pajak** (migrasi `005_pajak.sql`):
  - View `v_laba_rugi` & `periode_closing.laba` → dasar pengenaan PPh Final 0,5%
  - `closing_bulan_ini.is_locked` → indikasi bahwa periode sudah tutup buku

### Catatan Risiko
- **Struktur `stok_movement` harus stabil**: Jangan rename `total` atau `qty` setelah Sprint 2 aktif, atau trigger auto-expense gagal.
- **Kategori akun `is_system=true`**: Owner tidak boleh rename kode `4100`, `5100`, `3900` — karena dipakai trigger & function secara hard-coded. Hanya `nama` yang boleh diedit.
- **Cron jam**: `vercel.json` set `0 23 * * *` (23:00 UTC = 06:00 WIB). Owner di Bali (WITA) akan lihat generate jam 07:00. Sesuaikan jika perlu di `vercel.json`.
- **Idempotent aggregate income**: Sprint 2 belum otomatis panggil `fn_aggregate_income` dari upload flow (perlu investigasi mapping outlet_id). Untuk sekarang, **Owner bisa panggil manual** via Supabase SQL Editor kalau income tidak muncul. Sprint berikutnya bisa tambah cron harian `fn_aggregate_income` per outlet.

---

## 🛠️ Cara Menjalankan (untuk Developer Baru)

### 1. Migration
Jalankan di Supabase SQL Editor (berurutan):
1. `001_init.sql`
2. `002_daily_summary.sql`
3. `003_inventaris.sql`
4. `004_akunting.sql` ← **modul ini**

Akan terbentuk 4 tabel + 4 view + 4 function + 1 trigger + 16 kategori seed + 4 RLS policies.

### 2. Setup Cron (Production)
- Deploy ke Vercel.
- Set env `CRON_SECRET` (opsional) di Vercel Dashboard → Settings → Environment Variables.
- `vercel.json` sudah ter-commit dengan schedule `0 23 * * *`. Vercel akan auto-pickup dan jalankan `POST /api/cron/run-recurring` tiap hari.
- Cek log di Vercel Dashboard → Crons untuk memastikan jalan.

### 3. Manual Trigger (untuk testing)
- Login owner → `/dashboard/akunting/recurring` → klik **▶️ Jalankan Sekarang**.
- Atau via curl:
  ```bash
  curl -X POST http://localhost:3001/api/cron/run-recurring
  ```

### 4. Build & verifikasi
```bash
npm run build
```
Harus sukses tanpa TypeScript error.

---

## 📚 File Reference

| Path | Isi |
|---|---|
| `supabase/migrations/004_akunting.sql` | Migration (4 tabel + 4 view + 4 function + 1 trigger + 16 seed + RLS) |
| `src/types/index.ts` | Types: `KategoriAkun`, `TransaksiKeuangan`, `LabaRugi`, `Cashflow`, `KeuanganPerKategori`, `Neraca`, `PeriodeClosing`, `RecurringTransaction` |
| `src/app/dashboard/akunting/page.tsx` | Server component dashboard |
| `src/app/dashboard/akunting/expense/page.tsx` | Server component expense |
| `src/app/dashboard/akunting/recurring/page.tsx` | Server component recurring |
| `src/app/dashboard/akunting/closing/page.tsx` | Server component closing |
| `src/app/dashboard/akunting/laba-rugi/page.tsx` | Server component laporan |
| `src/components/dashboard/AkuntingClient.tsx` | Dashboard KPI + chart + recent |
| `src/components/dashboard/AkuntingExpenseForm.tsx` | Form + list transaksi |
| `src/components/dashboard/AkuntingRecurringClient.tsx` | Template CRUD + trigger manual |
| `src/components/dashboard/AkuntingClosingClient.tsx` | Preview + 2-step konfirmasi |
| `src/components/dashboard/AkuntingLaporanClient.tsx` | Laba-Rugi + Neraca + export XLSX 3 sheet |
| `src/app/api/akunting/transaksi/route.ts` | GET list + POST MANUAL |
| `src/app/api/akunting/transaksi/[id]/route.ts` | DELETE (MANUAL only) |
| `src/app/api/akunting/recurring/route.ts` | GET list + POST template |
| `src/app/api/akunting/recurring/[id]/route.ts` | PATCH + DELETE |
| `src/app/api/akunting/closing/route.ts` | POST tutup buku |
| `src/app/api/cron/run-recurring/route.ts` | GET + POST trigger cron |
| `src/components/Sidebar.tsx` | Entry "💰 Akunting" |
| `vercel.json` | Cron schedule harian |
| `.env.local.example` | Tambah `CRON_SECRET` |

---

## 🆘 Troubleshooting

| Gejala | Sebab | Fix |
|---|---|---|
| Income tidak muncul setelah upload XLSX | Fungsi `fn_aggregate_income` belum terpicu otomatis dari upload | Panggil manual via SQL Editor: `SELECT fn_aggregate_income('<outlet_id>', 'YYYY-MM');` |
| Stok keluar tidak muncul jadi expense | Trigger `trg_auto_expense_stok_out` belum terpasang | Cek `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_auto_expense_stok_out';` — kalau null, jalankan ulang `CREATE TRIGGER` di migration |
| Recurring tidak auto jalan tiap bulan | Vercel Cron belum setup atau `vercel.json` tidak ter-deploy | Cek Vercel Dashboard → Crons tab |
| Closing gagal "Periode sudah final" | (Tidak ada error ini di desain — idempotent by design) | Re-run via UI akan update existing row |
| Neraca `selisih` tidak 0 | Ada transaksi manual dengan `tipe='TRANSFER'` dan `metode=null` yang tidak dihitung di kas | Edit manual, set metode |
| Laporan XLSX file rusak | Library `xlsx` kadang generate valid tapi dibuka di Excel lama warning | Pakai Excel/LibreOffice modern |
