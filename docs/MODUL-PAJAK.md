# 🧾 Modul Pajak — Dokumentasi Fitur

> **Status:** ✅ Implemented (Sprint 3 selesai)
> **Path singkat di UI:** Sidebar → 🧾 Pajak
> **Untuk owner**, bukan customer.

Dokumen ini menjelaskan **modul Pajak** sebagai fitur aplikasi (bukan progres sprint). Untuk task breakdown & DoD sprint, lihat [`003-sprint-modul-pajak.md`](./003-sprint-modul-pajak.md). Untuk detail schema, lihat [`010-spec-schema.md`](./010-spec-schema.md).

---

## 🎯 Tujuan

Otomatisasi rekap **PPh Final 0,5%** per bulan + reminder bayar + export untuk konsultan pajak. Owner adalah Perseroan Perorangan **Non-PKP** dengan omzet < 4,8 M (tarif sesuai PP 23/2018).

**Output modul:**
1. **Rekap otomatis** PPh Final per bulan (setiap kali `fn_closing_periode` jalan di Sprint 2)
2. **Reminder badge** di dashboard utama untuk PPh yang jatuh tempo ≤ 7 hari
3. **Status bayar** (BELUM / LUNAS / BEAS) + upload bukti SSP
4. **SPT Tahunan Estimator** untuk diberikan ke konsultan pajak
5. **Export PDF + XLSX** untuk arsip

> **Out-of-scope** (sengaja ditunda di sprint lain): PPN, PPh Pasal 21, PPh Pasal 23, integrasi langsung e-Filing DJP, pendaftaran NPWP.

---

## ✨ Fitur

| Fitur | Lokasi UI | Kapan Dipakai |
|---|---|---|
| **Dashboard pajak** | `/dashboard/pajak` | Pantau PPh Final bulan ini + reminder |
| **Pengaturan pajak** | `/dashboard/pajak/pengaturan` | Setup NPWP, nama WP, PKP, form SPT |
| **Rekap bulanan** | `/dashboard/pajak/rekap` | Lihat history 24+ bulan + filter tahun/status |
| **Upload bukti SSP** | `/dashboard/pajak/upload-bukti` | Set LUNAS + upload foto/PDF SSP ke e-Billing DJP |
| **SPT tahunan** | `/dashboard/pajak/spt` | Akumulasi 12 bulan untuk konsultan pajak |
| **Auto-trigger PPh Final** | Otomatis dari closing | Setiap tutup buku → 1 klik auto-generate rekap |

---

## 🗂️ Schema (ringkas)

Lihat SQL lengkap di `supabase/migrations/005_pajak.sql` dan patch `006_pajak_closing_trigger.sql`.

```sql
-- Tabel
pajak_config (1 row per outlet)   -- NPWP, nama WP, metode, PKP, form SPT
pajak_rekap (bulanan)             -- dasar_pengenaan × tarif = nilai PPh Final

-- View
v_spt_tahunan_estimator          -- aggregate per tahun (12 bulan)
v_pajak_reminder                 -- view reminder jatuh tempo ≤ 7 hari

-- Function
fn_generate_pph_final_rekap       -- idempotent generate/update rekap
```

### Tabel `pajak_config` (1 row per outlet)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `outlet_id` | uuid PK | FK ke `outlets.id` |
| `npwp` | text | 15 digit angka (format auto di UI: `XX.XXX.XXX.X-XXX.XXX`) |
| `nama_wp` | text | Nama sesuai NPWP |
| `metode_pph` | text | `FINAL_05` (default, hardcode untuk MVP) |
| `pkp` | bool | Default `false` (Non-PKP) |
| `omzet_tahunan` | numeric | Estimasi, untuk referensi threshold PKP (4,8 M) |
| `form_spt` | text | `1770S3` (default) / `1770S` / `1771` — lihat D-009 |

### Tabel `pajak_rekap` (bulanan)

| Kolom | Tipe | Keterangan |
|---|---|---|
| `periode` | text | `YYYY-MM` |
| `dasar_pengenaan` | numeric | Net omzet bulan ini (dari `v_laba_rugi.total_income`) |
| `tarif` | numeric | `0.5` (pers (0,5%)) |
| `nilai_pajak` | numeric | `dasar × 0.005` |
| `status_bayar` | text | `BELUM` / `LUNAS` / `BEAS` |
| `tanggal_bayar` | date | Tanggal bayar ke DJP (manual atau dari upload bukti) |
| `bukti_url` | text | Path file di Supabase Storage bucket `bukti-pajak` |
| `catatan` | text | Opsional (mis. NTPN: 1234567890) |

**Unique**: `(outlet_id, periode, jenis_pajak)` — idempotent.

### Function `fn_generate_pph_final_rekap(p_outlet_id, p_periode)`

Dipanggil otomatis dari `fn_closing_periode` (lihat `006_pajak_closing_trigger.sql`). Idempotent:
- Skip kalau `v_laba_rugi.total_income <= 0` (return `SKIP_NO_INCOME`)
- Insert/update row `pajak_rekap` dengan `status_bayar='BELUM'`
- **Tidak reset** `status_bayar` kalau `LUNAS` atau `B

### View `v_pajak_reminder`

Menampilkan baris `pajak_rekap` `BELUM` dengan `tanggal_jatuh_tempo` (tgl 15 bulan setelahnya) dan `sisa_hari` (negatif = lewat).

Dipakai di:
- `src/app/dashboard/layout.tsx` → badge count di sidebar (owner only)
- `src/app/dashboard/pajak/page.tsx` → banner reminder di dashboard

---

## 🔌 API Reference

Semua endpoint ada di `src/app/api/pajak/`, pakai `createAdminClient()` (server-side).

### Pengaturan Pajak

| Method | Path | Body | Output |
|---|---|---|---|
| `POST` | `/api/pajak/config` | `{outlet_id, npwp, nama_wp, pkp?, form_spt?, omzet_tahunan?, metode_pph?}` | `{outlet_id, ...}` (upsert) |

### Rekap Bulanan

| Method | Path | Body | Output |
|---|---|---|---|
| `GET` | `/api/pajak/rekap` | query: `outlet_id`, `tahun?`, `status?` | List rekap + filter |
| `POST` | `/api/pajak/generate-rekap` | `{outlet_id, periode}` | Idempotent insert/update |
| `POST` | `/api/pajak/bayar` | `{id, status_bayar, tanggal_bayar?, bukti_url?, catatan?}` | Updated rekap |

### Upload Bukti SSP

| Method | Path | Body | Output |
|---|---|---|---|
| `POST` | `/api/storage/upload-bukti` | multipart: `file`, `outletId`, `refId?`, `subfolder?` | `{ok, path, publicUrl, ...}` (owner only) |
| `POST` | `/api/storage/get-signed-url` | `{bucket, path, expiry?}` | `{url, expiry}` (owner only) |

---

## 🖥️ Halaman & Komponen

| Path | Server Component | Client Component |
|---|---|---|
| `/dashboard/pajak` | `pajak/page.tsx` | `PajakClient.tsx` |
| `/dashboard/pajak/pengaturan` | `pajak/pengaturan/page.tsx` | `PajakPengaturanClient.tsx` |
| `/dashboard/pajak/rekap` | `pajak/rekap/page.tsx` | `PajakRekapClient.tsx` |
| `/dashboard/pajak/upload-bukti` | `pajak/upload-bukti/page.tsx` | `PajakUploadBuktiClient.tsx` |
| `/dashboard/pajak/spt` | `pajak/spt/page.tsx` | `PajakSPTClient.tsx` |

---

## 🔁 Alur Kerja (Workflow Owner)

### 1. Setup Awal (sekali)
- Login sebagai owner → `/dashboard/pajak/pengaturan`
- Isi NPWP (15 digit, format otomatis) + nama WP
- Pilih form SPT (default `1770S3`, konfirmasi dulu ke konsultan pajak — lihat D-009)
- Simpan → config tersimpan di `pajak_config`

### 2. Bulanan (otomatis, setiap `fn_closing_periode`)
1. Owner melakukan **closing bulanan** di `/dashboard/akunting/closing`
2. `fn_closing_periode` jalan → update `periode_closing` + **auto-call** `fn_generate_pph_final_rekap`
3. Function insert/update row `pajak_rekap` bulan ini dengan `status_bayar='BELUM'`
4. Owner lihat di `/dashboard/pajak` → ada baris PPh Final bulan ini, status BELUM

### 3. Bayar ke DJP (manual via e-Billing DJP)
1. Owner buka `/dashboard/pajak/rekap` → lihat baris BELUM
2. Klik "Bayar" → arahkan ke e-Billing DJP (`https://e-billing.pajak.go.id`)
3. Bayar via bank → dapat NTPN
4. Kembali ke `/dashboard/pajak/upload-bukti` → pilih rekap bulan tersebut
5. Isi tanggal bayar + (opsional) NTPN di catatan
6. Drag-drop foto/PDF SSP → upload ke bucket `bukti-pajak`
7. Centang "Set LUNAS" → simpan → `status_bayar='LUNAS'`, `tanggal_bayar` terisi, `bukti_url` terupload

### 4. Reminder Otomatis
- Badge counter muncul di **sidebar → 🧾 Pajak** jika ada PPh `BELUM` dengan `sisa_hari ≤ 7`
- Banner reminder muncul di dashboard pajak jika ada PPh lewat jatuh tempo (`sisa_hari < 0`)

### 5. Akhir Tahun → SPT
1. Owner buka `/dashboard/pajak/spt`
2. Pilih tahun (filter chips di atas)
3. Lihat akumulasi omzet + PPh Final 12 bulan + status bayar
4. Download PDF (print → save as PDF) atau CSV untuk konsultan pajak
5. File SPT jadi **estimator internal** — e-Filing tetap manual di website DJP

---

## ⚙️ Konvensi

- **Tarif hardcoded** `0.5%` di sistem (sesuai D-008). Owner Non-PKP, omzet < 4,8 M.
- **Form SPT default `1770S3`** (sesuai D-009). Bisa diedit owner, tapi **WAJIB konfirmasi** ke konsultan pajak sebelum pelaporan.
- **Auto-trigger** PPh Final dari `fn_closing_periode` (lihat `006_pajak_closing_trigger.sql`) — idempotent, aman dipanggil berulang.
- **Status `BEAS`** untuk bulan yang dibebaskan (mis. omzet < 4,8 M di awal usaha). Manual set oleh owner.
- **Idempotent**: `fn_generate_pph_final_rekap` bisa dipanggil manual via tombol "Generate Rekap" di halaman pajak untuk regenerate bulan yang sudah ada.
- **Bucket storage**: `bukti-pajak` (private, owner-only write, signed URL 1 jam).
- **RLS**: Tabel `pajak_config` & `pajak_rekap` **owner-only** (tidak ada policy untuk staff — sesuai D-006 karena data sensitif).

---

## 🔗 Integrasi dengan Sprint Lain

### Tergantung pada
- **Sprint 1 — Inventaris**: tidak ada dependency langsung
- **Sprint 2 — Akunting**:
  - View `v_laba_rugi.total_income` → dasar pengeng
  - `fn_closing_periode` → trigger auto-generate PPh Final
  - `recurring_transactions` → tidak ada dependency langsung
- **Sprint 4 — Storage**: Bucket `bukti-pajak` + upload via `/api/storage/upload-bukti`

### Digunakan oleh
- (tidak ada modul lain yang pakai modul pajak saat ini)

### Catatan Risiko
- **Form SPT `1770S3` belum terkonfirmasi** ke konsultan pajak (lihat D-009). Tindak lanjut sebelum sprint berikutnya.
- **NPWP disimpan plain text** di `pajak_config.npwp`. Untuk MVP cukup; untuk compliance tinggi perlu encryption at rest.
- **e-Filing DJP tetap manual** — sistem ini cuma rekap internal, bukan pengganti DJP.
- **PPh Final ≠ PPN** — PKP hanya untuk omzet > 4,8 M. Owner saat ini Non-PKP.

---

## 🛠️ Cara Menjalankan (untuk Developer Baru)

### 1. Migration
Jalankan di Supabase SQL Editor (berurutan):
1. `001_init.sql`
2. `002_daily_summary.sql`
3. `003_inventaris.sql`
4. `004_akunting.sql`
5. `005_pajak.sql` ← **modul ini** (tabel + view + function)
6. `006_pajak_closing_trigger.sql` ← **patch** agar `fn_closing_periode` auto-call `fn_generate_pph_final_rekap`
7. `006_storage_recurring.sql` ← untuk upload bukti SSP

### 2. Setup Storage
- Buka Supabase Dashboard → Storage
- Buat bucket `bukti-pajak` (private)
- RLS sudah terpasang otomatis dari `006_storage_recurring.sql`

### 3. Setup Owner
- Login sebagai owner → `/dashboard/pajak/pengaturan`
- Isi NPWP & nama WP

### 4. Test Auto-Trigger
1. Import laporan XLSX ke `/dashboard/upload` → `fn_aggregate_income` auto jalan (Sprint 2 integration)
2. Tutup buku bulan di `/dashboard/akunting/closing` → `fn_generate_pph_final_rekap` auto jalan
3. Cek `/dashboard/pajak` → ada baris PPh Final bulan tersebut

### 5. Build & verifikasi
```bash
npm run build
```
Harus sukses tanpa TypeScript error.

---

## 📚 File Reference

| Path | Isi |
|---|---|
| `supabase/migrations/005_pajak.sql` | Migration (2 tabel + 2 view + 1 function + RLS + 1 seed) |
| `supabase/migrations/006_pajak_closing_trigger.sql` | Patch `fn_closing_periode` untuk auto-trigger PPh Final |
| `src/types/index.ts` | Types: `PajakConfig`, `PajakRekap`, `SPTTahunanEstimator`, `PajakReminder` |
| `src/app/dashboard/pajak/page.tsx` | Server component dashboard |
| `src/app/dashboard/pajak/pengaturan/page.tsx` | Server component settings |
| `src/app/dashboard/pajak/rekap/page.tsx` | Server component rekap |
| `src/app/dashboard/pajak/upload-bukti/page.tsx` | Server component upload bukti |
| `src/app/dashboard/pajak/spt/page.tsx` | Server component SPT tahunan |
| `src/app/api/pajak/config/route.ts` | POST upsert pajak_config |
| `src/app/api/pajak/rekap/route.ts` | GET list rekap |
| `src/app/api/pajak/generate-rekap/route.ts` | POST idempotent generate PPh Final |
| `src/app/api/pajak/bayar/route.ts` | POST set status bayar (LUNAS/BELUM/BEAS) + tanggal |
| `src/app/api/storage/upload-bukti/route.ts` | POST upload SSP ke bucket (owner only) |
| `src/components/dashboard/PajakClient.tsx` | Dashboard KPI + reminder + 6 rekap terakhir |
| `src/components/dashboard/PajakPengaturanClient.tsx` | Form NPWP + nama WP + form SPT |
| `src/components/dashboard/PajakRekapClient.tsx` | Tabel rekap + filter tahun/status + view bukti |
| `src/components/dashboard/PajakUploadBuktiClient.tsx` | Drag-drop upload SSP + set LUNAS |
| `src/components/dashboard/PajakSPTClient.tsx` | SPT tahunan estimator + export PDF/CSV |
| `src/app/dashboard/layout.tsx` | Fetch `pajakAlert` count untuk sidebar badge |

---

## 🆘 Troubleshooting

| Gejala | Sebab | Fix |
|---|---|---|
| Tidak ada baris PPh Final bulan ini | `fn_closing_periode` belum jalan ATAU `total_income = 0` | 1) Tutup buku di `/dashboard/akunting/closing`; 2) Kalau income > 0 tapi tidak ada, klik "Generate Rekap" di halaman pajak; 3) Cek `v_laba_rugi` di SQL Editor |
| Badge reminder tidak muncul di sidebar | Bukan role owner ATAU tidak ada PPh ≤ 7 hari | Owner only. Cek `v_pajak_reminder` — pastikan `status_bayar='BELUM'` dan `sisa_hari <= 7` |
| Upload SSP gagal "Akses ditolak" | Bukan role owner ATAU tidak login | Endpoint `/api/storage/upload-bukti` & `/api/storage/get-signed-url` owner-only (D-006). Login sebagai owner |
| Upload gagal "File terlalu besar" | File > 5 MB | Compress foto atau scan ulang dengan resolusi lebih rendah. Maks 5 MB untuk JPG/PNG/WebP/PDF |
| Form SPT di PDF tidak cocok dengan format DJP | Default `1770S3` belum diverifikasi | Konfirmasi dulu ke konsultan pajak, baru ubah di `/dashboard/pajak/pengaturan`. Lihat D-009 |
| `nilai_pajak` di rekap tidak sesuai | Salah hitung dasar pengenaan ATAU tarif | Cek `dasar_pengenaan = v_laba_rugi.total_income`. Pastikan = net omzet (bukan bruto). Lihat D-008 |
| `fn_generate_pph_final_rekap` duplicate | (Seharusnya tidak — function idempotent) | Cek `pajak_rekap` — kalau ada 2 row untuk periode yang sama, hapus salah satu manual. Function pakai `on conflict do update` |
| Close period tidak trigger PPh | Patch `006_pajak_closing_trigger.sql` belum dijalankan | Jalankan migration 006 di Supabase SQL Editor |
| Upload bukti tidak muncul di list | `bukti_url` tidak ter-set di `pajak_rekap` | Cek apakah `PajakUploadBuktiClient` save flow benar: upload file → API return path → save rekap dengan `bukti_url: path`. Cek `pajak/bayar/route.ts` |
| SPT tahunan PDF blank / error layout | `@react-pdf/renderer` perlu SSR=false | Cek `dynamic import` dengan `{ ssr: false }` di `PajakSPTClient` & `AkuntingLaporanClient` |

---

## 📌 Status Implementasi

| Fitur | Status | Sprint |
|---|---|---|
| Tabel `pajak_config` + `pajak_rekap` | ✅ | Sprint 3 |
| View `v_spt_tahunan_estimator` + `v_pajak_reminder` | ✅ | Sprint 3 |
| Function `fn_generate_pph_final_rekap` | ✅ | Sprint 3 |
| Auto-trigger dari closing | ✅ | Sprint 3 + patch 006 |
| RLS owner-only | ✅ | Sprint 3 (D-006) |
| Dashboard pajak | ✅ | Sprint 3 |
| Pengaturan pajak (NPWP, form SPT) | ✅ | Sprint 3 |
| Rekap bulanan + filter | ✅ | Sprint 3 |
| Upload bukti SSP | ✅ | Sprint 4 |
| SPT tahunan estimator | ✅ | Sprint 3 |
| Export PDF (via Print) + CSV | ✅ | Sprint 3 + Sprint 5 |
| Reminder badge di sidebar | ✅ | Sprint 3 (D-019) |
| Alert count `pajakAlert` di layout | ✅ | Sprint 3 |
| Export PDF proper (PDFDownloadLink) | ⚠️ Sebagian | Sprint 5 (belum di-export SPT, masih pakai Print → Save as PDF) |
| Migration P-001 (verifikasi form SPT aktual) | ⏳ Pending | — |