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
