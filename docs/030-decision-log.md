# 📋 Decision Log — Alasan di Balik Keputusan Teknis

> **Dokumen ini menjelaskan MENGAPA keputusan teknis diambil, bukan APA yang diputuskan.**
> Untuk "apa", lihat file sprint masing-masing.

---

## 🏛️ Keputusan Arsitektur

### D-001: 1 migration file per modul
**Tanggal:** 8 Oktober 2026
**Konteks:** Ada 3 modul (inventaris, akunting, pajak) + 1 modul tambahan (recurring+storage)
**Keputusan:** Pisah jadi 4 migration (`003`, `004`, `005`, `006`), bukan 1 file besar
**Alasan:**
- Bisa dijalankan partial (kalau modul X belum siap, Y tetap bisa jalan)
- Easier rollback kalau ada error di 1 modul
- Lebih mudah di-review per fase
- Migration existing (`001`, `002`) sudah pakai pola ini

---

### D-002: Modul inventaris sebagai pondasi auto-journal
**Tanggal:** 8 Oktober 2026
**Konteks:** Modul akunting butuh sumber otomatis untuk expense
**Keputusan:** Modul inventaris (Sprint 1) dibangun sebelum akunting (Sprint 2)
**Alasan:**
- Inventaris menghasilkan data `stok_movement OUT` yang jadi trigger auto-expense
- Akunting yang bangun duluan akan punya trigger yang reference ke tabel yang belum ada
- Urutan: Inventaris → Akunting → Pajak (natural dependency chain)

---

### D-003: Income auto-journal sebagai function, bukan trigger per-row
**Tanggal:** 8 Oktober 2026
**Konteks:** Income dihitung agregat per bulan dari `transaksi`, bukan per-row
**Keputusan:** Pakai function `fn_aggregate_income(outlet_id, periode)` yang dipanggil manual/setelah import
**Alasan:**
- Trigger per-row di `transaksi` akan insert ribuan baris income (1 per STT) — salah konsep
- Income harus diagregat per bulan × outlet
- Function idempotent: kalau dipanggil 2× untuk periode sama, tidak duplicate
- Dipanggil setelah import XLSX selesai → coupling yang jelas

---

### D-004: Recurring transaction dipisah ke migration `006`
**Tanggal:** 8 Oktober 2026
**Konteks:** Tabel `recurring_transactions` + storage RLS bisa disatukan dengan akunting atau dipisah
**Keputusan:** Dipisah ke migration `006_storage_recurring.sql`
**Alasan:**
- Storage setup butuh manual step di Supabase Dashboard (bucket creation)
- Recurring butuh cron job — terpisah concern dari akunting inti
- Memudahkan testing: bisa aktifkan/nonaktifkan recurring tanpa ganggu akunting
- Migration lebih pendek dan fokus

---

## 🔒 Keputusan RLS & Security

### D-005: Owner-only write untuk modul baru
**Tanggal:** 8 Oktober 2026
**Konteks:** Owner memutuskan tidak pakai karyawan sama sekali
**Keputusan:**
- Modul inventaris, akunting, pajak → write hanya untuk role `owner`
- Staff tetap bisa read untuk outlet sendiri (konsistensi dengan pattern existing)
**Alasan:**
- Owner adalah single user, semua input sensitif (NPWP, nominal expense, dll) owner-only
- Kalau di masa depan ada staff, dia cuma lihat (misal untuk cek stok), tidak edit
- Pattern RLS existing sudah pakai `owner_all` + `staff_own_outlet`, tinggal extend

---

### D-006: Modul pajak owner-only (bukan staff-bisa-baca)
**Tanggal:** 8 Oktober 2026
**Konteks:** Data pajak (NPWP, nominal PPh, bukti SSP) sangat sensitif
**Keputusan:** Tabel `pajak_config` & `pajak_rekap` → **tidak ada policy untuk staff**, hanya owner
**Alasan:**
- Data pajak = data pribadi owner yang sensitif
- Bukti SSP mengandung NPWP yang tidak ingin dishare ke staff
- Owner-only access konsisten dengan keputusan tidak pakai staff
- Kalau di masa depan ada staff untuk pajak (admin pajak), bisa tambah policy khusus

---

### D-007: Upload file lewat server-side API route
**Tanggal:** 8 Oktober 2026
**Konteks:** Supabase Storage butuh service_role key untuk bypass RLS
**Keputusan:** Upload lewat API route (`src/app/api/upload/route.ts`), bukan client-side langsung
**Alasan:**
- Service_role key **tidak boleh** terexpose di client (baca `README.md` bagian Security)
- API route bisa validasi owner role sebelum upload
- Bisa resize/compress image sebelum simpan (future enhancement)
- Konsisten dengan pattern existing (import XLSX juga lewat API route)

---

## 💰 Keputusan Bisnis

### D-008: Tarif PPh Final 0,5% (bukan tarif lain)
**Tanggal:** 8 Oktober 2026
**Konteks:** Owner adalah Perseroan Perorangan Non-PKP, omzet < 4.8 M
**Keputusan:** Hardcode tarif 0,5% di `pajak_rekap.tarif`
**Alasan:**
- Syarat PPh Final UMKM: WPOP + omzet bruto ≤ 4.8 M/tahun
- Tarif sesuai PP 23/2018 (untuk pencatatan) atau PER-33/PJ/2017 (untuk pembukuan)
- Owner pilih pembukuan (ada neraca), maka tarif tetap 0,5% dari omzet bruto
- Bisa diubah nanti kalau ada perubahan regulasi (DRY: simpan di config)

---

### D-009: Form SPT diasumsikan 1770S3 (belum terkonfirmasi)
**Tanggal:** 8 Oktober 2026
**Konteks:** Owner belum konfirmasi Form SPT yang dipakai
**Keputusan:** Default `form_spt = '1770S3'` di tabel `pajak_config`
**Alasan:**
- Perseroan Perorangan yang terdaftar sebagai WPOP Badan → umumnya Form 1770S3
- Field ini bisa diedit manual oleh owner via halaman Pengaturan Pajak
- Export PDF akan kasih disclaimer: "Sesuaikan format dengan Form SPT Anda"
- Tindak lanjut: konfirmasi ke owner di sprint 3 sebelum deploy

---

### D-010: Tanpa fitur PPh Pasal 21 (karena tanpa karyawan tetap)
**Tanggal:** 8 Oktober 2026
**Konteks:** Owner memutuskan outlet single-person, tidak ada karyawan tetap
**Keputusan:** Tidak buat fitur PPh 21
**Alasan:**
- PPh 21 hanya relevan kalau ada karyawan tetap (gaji bulanan tetap)
- Owner sudah pasti tidak ada karyawan
- Mengurangi scope MVP, fokus ke PPh Final saja
- Future: kalau ada karyawan, bisa di-extend dengan tambah field di `pajak_rekap.jenis_pajak`

---

## 📊 Keputusan Reporting

### D-011: Laporan Laba-Rugi + Neraca + Cashflow (full set)
**Tanggal:** 8 Oktober 2026
**Konteks:** Owner butuh pembukuan, bukan sekadar cashflow
**Keputusan:** 3 laporan: Laba-Rugi, Neraca (sederhana), Cashflow
**Alasan:**
- Pembukuan lengkap (sesuai PER-33/PJ/2017) butuh 3 laporan minimum
- Laba-Rugi: performance (income vs expense per bulan)
- Neraca: posisi keuangan (aset = liability + equity) — di awal sederhana
- Cashflow: arus kas per metode (cash, bank, e-wallet)
- Ketiganya penting untuk konsultan pajak & SPT Tahunan

---

### D-012: Neraca di awal sangat sederhana (hanya Kas + Laba Ditahan)
**Tanggal:** 8 Oktober 2026
**Konteks:** Owner belum tentu input modal awal & belum ada hutang/piutang
**Keputusan:** Neraca MVP hanya tampilkan: Total Aset (cash + bank) + Total Equity (Laba Ditahan)
**Alasan:**
- Owner belum konfirmasi soal modal awal (belum ada field `modal_awal`)
- Tanpa hutang/piutang, neraca = cashflow kumulatif + laba ditahan
- Sederhana dulu, extend kalau ada aset tetap / hutang supplier di kemudian hari
- Catatan: akan ada todo "input modal awal" di Sprint 2

---

### D-013: Library PDF menggunakan `@react-pdf/renderer` (bukan `puppeteer`)
**Tanggal:** 8 Oktober 2026
**Konteks:** Vercel free tier punya limit function size
**Keputusan:** Pakai `@react-pdf/renderer` (~5MB) untuk export PDF di client
**Alasan:**
- `puppeteer` ~200MB → Vercel function size limit 50MB (free) → tidak muat
- `@react-pdf/renderer` ringan, render di browser
- Untuk export SPT Tahunan (1-2 halaman), perfoma cukup
- Alternative: `jsPDF` (~30KB) juga bisa, lebih ringan tapi layout lebih manual
- Future: kalau butuh PDF kompleks (multi-page dengan chart), migrate ke server-side Puppeteer

---

## �️ Keputusan Teknis Detail

### D-014: `stok_movement.ref_type` pakai string, bukan foreign key
**Tanggal:** 8 Oktober 2026
**Konteks:** Movement bisa di-reference dari opname, transaksi_keuangan, atau manual
**Keputusan:** `ref_type text` + `ref_id uuid` (polymorphic reference)
**Alasan:**
- Tidak bisa pakai FK langsung karena referensi ke banyak tabel berbeda
- String `ref_type` jadi "discriminator" untuk tau ke tabel mana `ref_id` merujuk
- Konsisten dengan pattern existing (misal `transaksi.raw_data jsonb`)
- Trade-off: integritas data dijaga di application layer

---

### D-015: `is_system = true` di kategori akun default
**Tanggal:** 8 Oktober 2026
**Konteks:** Seed kategori akun default harus ada, tapi jangan diedit sembarangan
**Keputusan:** Tambah field `is_system boolean` di `kategori_akun`
**Alasan:**
- Kategori 4100 (Pendapatan Ekspedisi) dipakai oleh trigger auto-journal
- Kalau diedit (ganti nama/kode), trigger akan gagal lookup kategori
- UI sembunyikan tombol edit/delete untuk `is_system = true`
- Owner tetap bisa tambah kategori custom (misal "Beban Marketing" baru)

---

### D-016: `recurring_transactions` dengan flag `tanggal_setiap_bulan`
**Tanggal:** 8 Oktober 2026
**Konteks:** Recurring butuh tanggal pasti tiap bulan
**Keputusan:** Pakai `tanggal_setiap_bulan int (1-31)` (bukan cron expression)
**Alasan:**
- Simpel: cukup angka 1-31
- Edge case: tgl 31 di bulan yang cuma 30 hari → di-skip atau geser ke akhir bulan? → decided di skip (lihat Sprint 4 risiko)
- Owner bisnis biasanya hafal "WiFi tanggal 5, listrik tanggal 10" — UX lebih natural
- Future: kalau butuh lebih complex (minggu ke-X), ganti ke cron expression

---

### D-017: `v_neraca` sebagai view, bukan tabel materialized
**Tanggal:** 8 Oktober 2026
**Konteks:** Neraca butuh data real-time dari transaksi + closing
**Keputusan:** Pakai VIEW biasa (bukan materialized view)
**Alasan:**
- Data transaksi_keuangan real-time, jadi view biasa otomatis update
- Materialized view harus refresh manual/scheduled → over-engineering untuk MVP
- Perfoma: query Neraca ringan (aggregate sederhana), < 100ms untuk ribuan baris
- Bisa di-upgrade ke materialized view kalau perfoma jadi masalah

---

## 🏛️ Keputusan Sprint 3 — Modul Pajak

### D-018: Auto-generate PPh Final setelah closing
**Tanggal:** 8 Oktober 2026
**Konteks:** Setiap closing bulanan harus otomatis insert PPh Final 0,5% ke `pajak_rekap`
**Keputusan:** Patch `fn_closing_periode` di migration `006_pajak_closing_trigger.sql` agar auto-call `fn_generate_pph_final_rekap`
**Alasan:**
- 1 klik closing → semua pajak bulan ini auto-generated
- Memastikan tidak lupa generate PPh (sebelumnya proses manual terpisah)
- Idempotent: jika sudah ada, function `on conflict do update` tidak duplicate
- Lihat detail di workflow 4 di `020-spec-workflow.md`

### D-019: Reminder jatuh tempo PPh Final (7 hari)
**Tanggal:** 8 Oktober 2026
**Konteks:** Owner harus bayar PPh Final tgl 15 bulan berikutnya — kalau lupa, kena denda
**Keputusan:** View `v_pajak_reminder` + badge counter di dashboard utama
**Alasan:**
- Tgl jatuh tempo selalu tgl 15 bulan setelahnya (aturan DJP)
- Badge muncul jika `sisa_hari <= 7` (minggu terakhir)
- Tampil di sidebar sebagai alert count (seperti alert inventaris)
- Lihat workflow 1 di `020-spec-workflow.md` (Siklus Bulanan)

---

## 🏛️ Keputusan Sprint 4 — Storage + Recurring

### D-020: Tambah field `lampiran_url` di `transaksi_keuangan`
**Tanggal:** 8 Oktober 2026
**Konteks:** Owner perlu simpan foto nota expense untuk dokumentasi
**Keputusan:** Field `lampiran_url text` (nullable) di `transaksi_keuangan`
**Alasan:**
- File disimpan di Supabase Storage bucket `nota-expense`
- Path disimpan sebagai string (bukan FK ke tabel lain) — fleksibel
- Nullable = expense manual boleh tanpa lampiran
- Lihat workflow 2b di `020-spec-workflow.md`

### D-021: Owner-only storage RLS untuk `bukti-pajak`
**Tanggal:** 8 Oktober 2026
**Konteks:** Bukti SSP mengandung NPWP + nominal PPh — data paling sensitif
**Keputusan:** Migration `006_storage_recurring.sql` punya policy `owner_upload_bukti_pajak` + `read_bukti_pajak` (hanya owner, semua authenticated read)
**Alasan:**
- Konsisten dengan D-006 (modul pajak owner-only)
- Bukti SSP tidak boleh dishare ke staff
- Storage RLS cek `auth.uid() exists in profiles where role='owner'`
- `nota-expense` lebih longgar: staff bisa read (untuk cek audit)

### D-022: Signed URL expired 1 jam
**Tanggal:** 8 Oktober 2026
**Konteks:** Bucket Supabase Storage private — owner butuh lihat file dari UI
**Keputusan:** Signed URL expire `3600` detik (1 jam)
**Alasan:**
- Cukup untuk owner lihat/download file
- Kalau lebih dari 1 jam, owner refresh page → generate ulang
- Lebih aman dari URL publik tanpa expired
- API endpoint `/api/storage/get-signed-url` untuk generate per-request (owner only)

### D-023: 2 bucket terpisah (`nota-expense` + `bukti-pajak`)
**Tanggal:** 8 Oktober 2026
**Konteks:** File expense (nota) vs file pajak (SSP) punya sensivitas berbeda
**Keputusan:** 2 bucket Supabase Storage terpisah dengan RLS berbeda
**Alasan:**
- `nota-expense`: foto struk/WiFi — less sensitive, staff boleh read
- `bukti-pajak`: foto/PDF SSP — NPWP + nominal, owner only
- Pemisahan memudahkan audit (siapa akses apa)
- Lihat workflow 2b & 5 di `020-spec-workflow.md`

---

## 🏛️ Keputusan Sprint 5 — Export PDF/XLSX & Polish

### D-024: Library PDF `@react-pdf/renderer` (bukan `puppeteer`)
**Tanggal:** 8 Oktober 2026
**Konteks:** Export SPT Tahunan & laporan internal ke PDF
**Keputusan:** Pakai `@react-pdf/renderer ^4.6.1` (client-side, ~5MB) via `PDFDownloadLink`
**Alasan:**
- `puppeteer` ~200MB → Vercel function size limit 50MB (free) → tidak muat
- `@react-pdf/renderer` render di browser (no server-side)
- TypeScript type-safe (React component)
- Untuk export SPT 1-2 halaman, perfoma cukup
- Future: kalau butuh PDF kompleks (chart, multi-page), migrate ke server-side Puppeteer

### D-025: Helper XLSX generic di `src/lib/export/xlsx.ts`
**Tanggal:** 8 Oktober 2026
**Konteks:** Setiap halaman laporan butuh export XLSX — perlu helper reusable
**Keputusan:** Helper generic `exportToXlsx`/`exportToXlsxBuffer` dengan multi-sheet + currency/percent format
**Alasan:**
- DRY: tidak copy-paste XLSX code di setiap halaman
- Currency format: `"Rp "#,##0` otomatis terapkan ke kolom nominal
- Bisa dipakai client-side (Blob download) atau server-side (ArrayBuffer di Response)
- Terintegrasi dengan 4 sheet: Laba-Rugi, Cashflow, Neraca, Kartu Stok

### D-026: Polish UX: `LoadingSkeleton` + `EmptyState` components
**Tanggal:** 8 Oktober 2026
**Konteks:** UX perlu lebih informatif dari sekadar spinner + teks "belum ada"
**Keputusan:** 2 komponen reusable di `src/components/dashboard/`
**Alasan:**
- `LoadingSkeleton`: shimmer animation untuk saat data dimuat
- `EmptyState`: icon + title + description + CTA button untuk list kosong
- Terpakai di Laba-Rugi, Kartu Stok, Recurring, Rekap Pajak
- Konsisten across pages

---

## ❓ Keputusan yang Masih Pending

| # | Keputusan | Status | Action |
|---|---|---|---|
| P-001 | Form SPT aktual (1770S3 atau 1771) | ⏳ Pending | Konfirmasi owner sebelum Sprint 3 |
| P-002 | Modal awal outlet (uang yang ditanam di awal) | ⏳ Pending | Tambah field di `kategori_akun` atau input manual |
| P-003 | Backup/restore database | ⏳ Pending | Belum ada strategi, belum urgent |
| P-004 | Multi-currency (untuk STT internasional?) | ⏳ Not needed | LION/JNE/J&T/WAHANA semua IDR |

---

## 🔗 Referensi

- Schema detail → `010-spec-schema.md`
- Workflow detail → `020-spec-workflow.md`
- Sprint tasks → `001-sprint-modul-*.md`
- Glossary istilah → `000-glossary.md`
