# 🔄 Workflow & Otomasi — 3 Modul

> **Dokumen ini merangkum alur kerja owner + proses otomatis yang terjadi di background.** Setiap workflow punya langkah manual (owner) dan otomatis (sistem).

---

## 🎯 Prinsip Otomasi

1. **Owner tidak perlu input ulang data yang sudah ada** — income auto dari XLSX, expense auto dari inventaris.
2. **Owner cukup input yang unik** — expense manual, opname, prive.
3. **Closing bulanan = 1 klik** — sistem hitung laba, lock periode, trigger auto-journal ke pajak.
4. **Reminder otomatis** — jatuh tempo PPh Final tgl 15, recurring jatuh tempo tgl X.

---

## 📋 Workflow 1: Siklus Bulanan Normal

### Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│  AWAL BULAN (tgl 1-10)                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ • Owner upload laporan XLSX dari 4 portal franchise     │    │
│  │   (LION, JNE, J&T, WAHANA)                              │    │
│  │ • Sistem: parse → insert ke tabel `transaksi`           │    │
│  │ • Sistem: trigger `fn_aggregate_income(outlet, periode)` │    │
│  │   → insert baris income ke `transaksi_keuangan`         │    │
│  │   (sumber: KURIR, kategori: 4100)                       │    │
│  │ • Cron harian: jalankan `fn_run_recurring`              │    │
│  │   → WiFi tgl 5, PLN tgl 10 → expense auto               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  TENGAH BULAN (tgl 11-25)                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ • Stok keluar harian (karton dipakai, lakban, dll)      │    │
│  │ • Sistem: trigger `trg_auto_expense_stok_out`           │    │
│  │   → insert expense ATK ke `transaksi_keuangan`          │    │
│  │ • Owner bisa input expense manual lain (opsional)       │    │
│  │ • Reminder: bayar PPh Final bulan lalu (jika BELUM)     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  AKHIR BULAN (tgl 26-31)                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ • Opname bulanan: hitung fisik semua barang              │    │
│  │   → sistem insert ADJ movement → stok auto-update       │    │
│  │ • Closing bulanan: klik "Tutup Buku Bulan Ini"          │    │
│  │   → sistem: hitung laba, lock periode, insert laba      │    │
│  │     ditahan                                             │    │
│  │   → trigger generate PPh Final 0,5% ke `pajak_rekap`    │    │
│  │ • Owner: flag PPh Final sebagai LUNAS setelah bayar     │    │
│  │   di e-Billing DJP + upload bukti SSP                   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Workflow 2: Input Expense Manual (Misal: WiFi Diubah Nominalnya)

```
Owner buka /dashboard/akunting/expense
   ↓
Klik "Tambah Transaksi"
   ↓
Form:
  - Tanggal: [default: hari ini]
  - Tipe: [dropdown] → KELUAR
  - Kategori: [dropdown] → 5200 Beban Internet (WiFi)
  - Nominal: [input]
  - Metode: [radio] → BANK / CASH / EWALLET
  - Lampiran: [drag-drop JPG/PDF] → upload ke bucket nota-expense
  - Keterangan: [textarea opsional]
   ↓
Submit → POST /api/akunting/transaksi
   ↓
API: validasi owner role + insert ke `transaksi_keuangan`
   ↓
Toast: "✅ Expense tersimpan"
   ↓
Tabel update otomatis
```

---

## 📋 Workflow 3: Stok Keluar Trigger Expense Otomatis

```
Owner buka /dashboard/inventaris
   ↓
Klik barang "Karton Box M" → klik "Catat Stok Keluar"
   ↓
Form:
  - Qty: [input] (default: 1)
  - Harga satuan: [auto dari barang.harga_beli]
  - Total: [auto qty × harga]
  - Tanggal: [default: hari ini]
  - Keterangan: [opsional, misal "untuk paket Lion #STT12345"]
   ↓
Submit → POST /api/inventaris/stok-keluar
   ↓
API: insert ke `stok_movement` (tipe: OUT)
   ↓
Trigger DB: `trg_auto_expense_stok_out`
   ↓
Auto-insert ke `transaksi_keuangan`:
  - tipe: KELUAR
  - kategori: 5100 Beban ATK & Packaging
  - sumber: INVENTARIS
  - nominal: qty × harga
  - ref_id: ID movement
   ↓
Toast: "✅ Stok keluar tercatat, expense otomatis ke Beban ATK"
```

---

## 📋 Workflow 4: Closing Bulanan

```
Owner buka /dashboard/akunting/closing
   ↓
Pilih periode: [YYYY-MM]
   ↓
Tampil preview:
  - Total Income: Rp X
  - Total Expense: Rp Y
  - Laba Kotor: Rp (X-Y)
  - List income & expense dalam 1 bulan
   ↓
Klik "Tutup Buku Bulan Ini"
   ↓
Konfirmasi: "Periode YYYY-MM akan di-LOCK. Yakin?"
   ↓
Submit → POST /api/akunting/closing
   ↓
API panggil `fn_closing_periode(outlet_id, periode)`
   ↓
DB:
  - Insert/update `periode_closing` dengan is_locked=true
  - Hitung ulang income, expense, laba
   ↓
Trigger lanjutan: `fn_generate_pph_final(outlet_id, periode)`
   ↓
DB:
  - Hitung dasar pengenaan = net omzet bulan tsb
  - Nilai PPh Final = dasar × 0.5%
  - Insert ke `pajak_rekap` (status: BELUM)
   ↓
Toast: "✅ Bulan YYYY-MM ditutup. PPh Final Rp X auto-generated."
   ↓
Redirect ke halaman pajak
```

---

## 📋 Workflow 5: Bayar PPh Final

```
Owner buka /dashboard/pajak/rekap
   ↓
Lihat tabel:
  | Periode | PPh Final | Status | Aksi |
  | 2026-03 | Rp 50.000 | BELUM  | [Bayar] [Edit] |
   ↓
Klik "Bayar"
   ↓
Modal:
  - Tanggal bayar: [input]
  - Bukti SSP: [drag-drop JPG/PDF]
  - Catatan: [opsional, misal "NTPN: 1234567890"]
   ↓
Submit → POST /api/pajak/bayar
   ↓
API:
  - Upload bukti ke bucket `bukti-pajak`
  - Update `pajak_rekap` set status_bayar=LUNAS, tanggal_bayar, bukti_url
   ↓
Toast: "✅ Pembayaran dicatat"
```

---

## 📋 Workflow 6: SPT Tahunan (Akhir Tahun)

```
Owner buka /dashboard/pajak/spt
   ↓
Pilih tahun: [YYYY]
   ↓
Tampil:
  - Akumulasi omzet 12 bulan: Rp X
  - Akumulasi PPh Final yang sudah dibayar: Rp Y
  - Daftar bulan (lunas vs belum)
   ↓
Klik "Export PDF untuk Konsultan Pajak"
   ↓
Generate PDF:
  - Header: Nama WP, NPWP
  - Tabel bulanan: omzet, PPh Final, status bayar, tanggal bayar
  - Footer: total & tanda tangan placeholder
   ↓
Download: SPT_Tahunan_YYYY_NamaWP.pdf
   ↓
Owner kirim ke konsultan pajak via WA/email
```

---

## 📋 Workflow 7: Recurring Transaction (WiFi Bulanan)

### Setup (sekali, di awal pakai)

```
Owner buka /dashboard/akunting/recurring
   ↓
Klik "Tambah Template"
   ↓
Form:
  - Nama: "WiFi Bulanan"
  - Kategori: 5200 Beban Internet (WiFi)
  - Nominal: 300000
  - Metode: BANK
  - Tanggal setiap bulan: 5
  - Aktif: ✓
   ↓
Submit → POST /api/akunting/recurring
   ↓
Simpan ke `recurring_transactions`
```

### Run (otomatis, tiap hari)

```
Cron harian (00:01):
  - Panggil `fn_run_recurring()`
  - Loop semua template aktif
  - Filter: tanggal_setiap_bulan = hari ini
  - Cek idempotent: sudah ada transaksi bulan ini? → skip
  - Insert ke `transaksi_keuangan` (sumber: RECURRING)
   ↓
Pada tanggal 5 setiap bulan:
  - Auto-insert expense WiFi Rp 300rb
   ↓
Owner lihat di list transaksi: "Auto dari recurring: WiFi Bulanan"
```

---

## � Workflow 8: Opname Bulanan

```
Owner buka /dashboard/inventaris/opname
   ↓
Pilih periode: [YYYY-MM]
   ↓
Klik "Buat Opname Baru"
   ↓
Tampil tabel:
  | Barang | Qty Sistem | Qty Fisik (input) | Selisih |
  | Karton M | 50 | [___] | auto |
  | Lakban | 20 | [___] | auto |
   ↓
Owner isi qty fisik untuk tiap barang
   ↓
Submit → POST /api/inventaris/opname (atomic)
   ↓
DB (semua dalam 1 transaction):
  - Insert `opname` (status: FINAL)
  - Insert `opname_item` per barang
  - Untuk tiap item dengan selisih ≠ 0:
    - Insert `stok_movement` (tipe: ADJ, qty: selisih)
   ↓
Stok auto-terupdate via view `v_stok_aktual`
```

---

## 📋 Workflow 9: Alert Stok Minimum (Real-time)

```
Setiap kali sidebar render:
   ↓
Query: SELECT COUNT(*) FROM v_stok_aktual WHERE is_below_min = true
   ↓
Jika > 0:
   - Tampilkan badge "⚠️ X barang minimum" di menu Inventaris
   - Tooltip: list nama barang yang di bawah minimum
```

---

## 📋 Ringkasan Trigger & Function

| Trigger/Function | When | Action |
|---|---|---|
| `fn_auto_expense_stok_out` | after insert `stok_movement` (tipe=OUT) | Auto-insert expense ke `transaksi_keuangan` |
| `fn_aggregate_income(outlet, periode)` | after import XLSX selesai | Insert rekap income bulanan |
| `fn_closing_periode(outlet, periode)` | saat owner klik "Tutup Buku" | Lock periode + simpan laba |
| `fn_generate_pph_final(outlet, periode)` | after closing | Insert PPh Final 0,5% ke `pajak_rekap` |
| `fn_run_recurring()` | cron harian | Generate transaksi dari template |

---

## 🔗 Referensi

- Schema detail → `010-spec-schema.md`
- Task list tiap modul → `001-sprint-modul-*.md`
- Alasan keputusan → `030-decision-log.md`
