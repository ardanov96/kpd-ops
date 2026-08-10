# 🏃 Sprint 3 — Modul Pelaporan Pajak

> **Tujuan:** Otomasi rekap PPh Final 0,5% per bulan + reminder bayar + export untuk konsultan pajak.

---

## 📦 Scope

### Yang DICAKUP (sesuai keputusan)
- Setup NPWP & status PKP (per outlet)
- Rekap PPh Final 0,5% otomatis per bulan (dasar: net omzet)
- Rekap pajak yang sudah dipotong kurir (`transaksi.ppn`, `pph`, `bm`)
- Status bayar (BELUM / LUNAS) + tanggal bayar + upload bukti SSP
- Reminder jatuh tempo (badge di dashboard, tgl 15 bulan berikut)
- Estimator SPT Tahunan
- Export PDF + XLSX untuk konsultan pajak

### Yang TIDAK DICAKUP (sesuai keputusan)
- PPN → Non-PKP
- PPh Pasal 21 → tidak ada karyawan tetap
- PPh Pasal 23 → tidak ada transaksi B2B vendor
- Pendaftaran NPWP → sudah ada
- Integrasi langsung e-Filing DJP → tetap manual di website DJP
- SPT Bulanan (cukup tahunan)

---

## 🗂️ Schema (migration `005_pajak.sql`)

Lihat detail lengkap di `010-spec-schema.md`. Singkat:

```
pajak_config (1 row per outlet) → pajak_rekap (bulanan)
```

Plus view: `v_spt_tahunan_estimator`.

---

## 📋 Task Breakdown

### Phase 3A — DB & Setup

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 3.1 | Tulis `supabase/migrations/005_pajak.sql` | � **Cline** | ⬜ | File SQL |
| 3.2 | Seed default `pajak_config` untuk outlet existing (NPWP kosong, akan diisi owner) | 🤖 **Cline** | ⬜ | 1 row placeholder |
| 3.3 | View `v_spt_tahunan_estimator` | 🤖 **Cline** | � | View DB |

### Phase 3B — Konfigurasi NPWP

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 3.4 | Halaman Pengaturan Pajak di `/dashboard/profil` (atau sub-page) | 🤖 **Cline** | ⬜ | Form NPWP, nama WP, PKP |
| 3.5 | API route `POST /api/pajak/config` | 🤖 **Cline** | ⬜ | Endpoint upsert |

### Phase 3C — Auto-rekap Bulanan

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 3.6 | Trigger / cron `generate_pph_final_rekap` setelah closing akunting | 🤖 **Cline** | ⬜ | Function PG atau API |
| 3.7 | API route `POST /api/pajak/generate-rekap` (manual trigger) | 🤖 **Cline** | ⬜ | Idempotent insert |

### Phase 3D — Frontend

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 3.8 | Halaman `src/app/dashboard/pajak/page.tsx` (dashboard) | 🤖 **Cline** | ⬜ | KPI: PPh Final bulan ini, status |
| 3.9 | Komponen `PajakClient.tsx` | 🤖 **Cline** | ⬜ | Cards + reminder badge |
| 3.10 | Halaman `src/app/dashboard/pajak/rekap/page.tsx` (tabel rekap bulanan) | � **Cline** | ⬜ | Tabel interaktif |
| 3.11 | Halaman `src/app/dashboard/pajak/upload-bukti/page.tsx` | 🤖 **Cline** | ⬜ | Upload SSP + set status LUNAS |
| 3.12 | Tambah entry NAV di `Sidebar.tsx` (icon: 🧾) | 🤖 **Cline** | ⬜ | Menu sidebar |

### Phase 3E — Reminder & Estimator

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 3.13 | Badge reminder "Bayar PPh Final sebelum tgl 15" | 🤖 **Cline** | ⬜ | Indikator real-time |
| 3.14 | Halaman SPT Tahunan Estimator | 🤖 **Cline** | ⬜ | Akumulasi 12 bulan |
| 3.15 | Export PDF SPT Tahunan | 🤖 **Cline** | ⬜ | Tombol download |

---

## ✅ Definition of Done (Sprint 3 Selesai)

- [ ] Migration `005_pajak.sql` jalan tanpa error
- [ ] Owner bisa input NPWP & status PKP
- [ ] Setelah closing akunting bulan X → baris PPh Final 0,5% auto-generated di `pajak_rekap`
- [ ] Owner bisa flag "LUNAS" + upload bukti SSP (JPG/PDF)
- [ ] Badge reminder muncul di dashboard saat mendekati tgl 15
- [ ] Halaman SPT Tahunan menampilkan akumulasi omzet + PPh Final
- [ ] Export PDF SPT Tahunan siap diberikan ke konsultan pajak
- [ ] Build `npm run build` sukses

---

## 🔗 Dependencies

- **Tergantung**: Sprint 2 (Akunting) — untuk data omzet & closing
- **Tergantung**: Sprint 4 (Storage) — untuk upload bukti SSP

> **Catatan**: Storage di Sprint 4 sudah harus siap sebelum upload SSP bisa jalan. Kalau Sprint 4 belum kelar, upload SSP bisa ditunda atau pakai URL external dulu.

---

## �️ Risiko & Catatan

- **Risiko**: Form SPT yang dipakai (1770S3 vs 1771) masih **belum terkonfirmasi** — lihat `030-decision-log.md`. Default: asumsikan Form 1770S3 untuk sementara.
- **Catatan**: PPh Final 0,5% dibayar tanggal 15 bulan berikutnya. Sistem hanya remind, **tidak generate kode billing DJP** (manual di e-Billing DJP).
- **Catatan**: Rekap pajak kurir (`transaksi.ppn/pph/bm`) hanya untuk dokumentasi internal, **tidak dibayar lagi** oleh outlet — sudah dibayar kurir.
- **Catatan**: Upload SSP maks 5 MB (JPG/PNG/PDF). Bucket `bukti-pajak` di Sprint 4.
