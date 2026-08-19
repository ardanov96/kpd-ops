# 📦 Modul Inventaris — Dokumentasi Fitur

> **Status:** ✅ Implemented (Sprint 1 selesai, commit `d9d7867`)
> **Path singkat di UI:** Sidebar → 📦 Inventaris
> **Untuk owner/backoffice**, bukan untuk customer.

Dokumen ini menjelaskan **modul Inventaris** sebagai fitur aplikasi (bukan progres sprint). Untuk task breakdown & DoD sprint, lihat [`001-sprint-modul-inventaris.md`](./001-sprint-modul-inventaris.md). Untuk detail schema, lihat [`010-spec-schema.md`](./010-spec-schema.md).

---

## 🎯 Tujuan

Mengelola **stok barang habis pakai (consumables)** outlet ekspedisi: karton, lakban, kertas print, plastik packing, thermal paper, dll.

Modul ini adalah fondasi untuk modul Akunting (Sprint 2): setiap stok keluar akan otomatis menjadi expense `5100 Beban ATK & Packaging` lewat trigger DB.

---

## ✨ Fitur

| Fitur | Lokasi UI | Kapan Dipakai |
|---|---|---|
| **CRUD master barang** | `/dashboard/inventaris` | Tambah/ubah/soft-delete barang baru |
| **Catat stok masuk** (belanja/restock) | Modal dari halaman inventaris | Setiap beli karton/lakban/dll |
| **Catat stok keluar** (pemakaian) | Modal dari halaman inventaris | Setiap hari ada operasional |
| **Alert stok minimum** | Banner merah di halaman + badge 🔴 di sidebar | Real-time via view `v_stok_aktual` |
| **Opname bulanan** | `/dashboard/inventaris/opname` | Sekali per bulan, akhiri bulan |
| **Kartu stok per barang** | `/dashboard/inventaris/[id]` | Drill-down history + export XLSX |
| **Export XLSX** | Tombol di halaman kartu stok | Laporan ke owner/akuntan |

> **Out-of-scope** (sengaja ditunda):
> - Aset tetap (printer, timbangan) → gunakan modul terpisah nanti
> - Transfer antar outlet → tidak relevan (1 outlet)
> - Barcode scanner → input SKU manual dulu

---

## 🗂️ Schema (ringkas)

Lihat SQL lengkap di `supabase/migrations/003_inventaris.sql` dan spec di `010-spec-schema.md`.

```
kategori_inventaris ─► barang ─► stok_movement (IN | OUT | ADJ)
                                  │
                                  ▼
                              opname ─► opname_item
                                        (qty_sistem vs qty_fisik → ADJ auto)
```

### 5 Tabel

| Tabel | Isi | Catatan |
|---|---|---|
| `kategori_inventaris` | Packaging, ATK, Perlengkapan, dll | Global + bisa override per outlet |
| `barang` | Master per barang (SKU, nama, satuan, stok_min, harga_beli, aktif) | Soft-delete via `aktif=false` |
| `stok_movement` | Setiap perubahan stok (tanggal, qty, harga, tipe, ref_type) | Immutable (audit trail) |
| `opname` | Header opname per periode (YYYY-MM) | Status: DRAFT → FINAL |
| `opname_item` | Detail per barang (qty_sistem, qty_fisik, selisih, harga, catatan) | Cascade delete dari opname |

### 2 View

| View | Output | Dipakai Di |
|---|---|---|
| `v_stok_aktual` | Stok terkini per barang + flag `is_below_min` + `total_nilai_masuk` | Halaman list, sidebar badge, alert |
| `v_kartu_stok` | Semua movement urut tanggal desc | Halaman detail barang |

### Tipe Movement (`stok_movement.tipe`)

| Tipe | Arti | Contoh |
|---|---|---|
| `IN` | Stok masuk (restock) | Beli 100 karton, masuk 50 lakban |
| `OUT` | Stok keluar (pemakaian) | Dipakai 3 karton hari ini |
| `ADJ` | Adjustment dari opname | Selisih opname ±10 |

### `ref_type` (sumber movement)

| Value | Sumber |
|---|---|
| `MANUAL` | Input dari UI (stok masuk/keluar) |
| `OPNAME` | Auto-generate dari opname bulanan |
| `INVENTARIS_AUTO` | Auto-generate dari trigger DB (Sprint 2) |

---

## 🔌 API Reference

Semua endpoint ada di `src/app/api/inventaris/`, pakai `createAdminClient()` (server-side, bypass RLS — authorisasi via `profiles.role='owner'` dicek di layout/dashboard). Response format: JSON.

### Barang (CRUD)

| Method | Path | Body | Output |
|---|---|---|---|
| `GET` | `/api/inventaris/barang` | — | List barang + join kategori |
| `GET` | `/api/inventaris/barang/[id]` | — | Detail 1 barang |
| `POST` | `/api/inventaris/barang` | `{outlet_id, kategori_id, sku?, nama, satuan, stok_min?, harga_beli?, aktif?}` | Barang baru |
| `PATCH` | `/api/inventaris/barang/[id]` | Partial barang fields | Barang updated |
| `DELETE` | `/api/inventaris/barang/[id]` | — | Soft-delete (set `aktif=false`) |

**Validasi POST/PATCH:** `nama` & `satuan` wajib non-empty; `stok_min` & `harga_beli` numeric ≥ 0.

### Stok Movement

| Method | Path | Body | Output |
|---|---|---|---|
| `POST` | `/api/inventaris/stok-masuk` | `{barang_id, qty, harga_satuan?, tanggal, keterangan?}` | Movement IN baru |
| `POST` | `/api/inventaris/stok-keluar` | `{barang_id, qty, harga_satuan?, tanggal, keterangan?}` | Movement OUT baru |

**Validasi:**
- `barang_id` wajib exist & `aktif=true`
- `qty > 0`
- `tanggal` wajib (format ISO date `YYYY-MM-DD`)
- Stok keluar **cek kecukupan** via `v_stok_aktual.stok` — return `400` kalau kurang

**Catatan penting:** Setelah migration `004_akunting.sql` aktif, setiap `OUT` dengan `ref_type='MANUAL'` akan **auto-insert** row `transaksi_keuangan.tipe='KELUAR'`, `sumber='INVENTARIS'`, `kategori_id=5100`. Setelah itu `ref_type` di-update jadi `'INVENTARIS_AUTO'` untuk mencegah loop.

### Opname

| Method | Path | Body | Output |
|---|---|---|---|
| `POST` | `/api/inventaris/opname` | `{outlet_id, periode (YYYY-MM), tanggal_opname, catatan?, items: [{barang_id, qty_sistem, qty_fisik, selisih, harga_satuan?, catatan?}]}` | `{ok, opname_id, items_count, adj_count}` |

**Logic atomic:**
1. Validasi periode & items
2. Block kalau opname periode ini sudah `FINAL`
3. Upsert header opname (status `FINAL`, `finalized_at=now()`)
4. Hapus `opname_item` lama + insert baru (replace strategy)
5. Untuk tiap item dengan `selisih ≠ 0`, **auto-insert** ADJ movement `ref_type='OPNAME'`, `ref_id=opname_id`
6. Rollback header jika items insert gagal

---

## 🖥️ Halaman & Komponen

| Path | Server Component | Client Component | Catatan |
|---|---|---|---|
| `/dashboard/inventaris` | `inventaris/page.tsx` | `InventarisClient.tsx` | List + search/filter/alert + modal CRUD & stok |
| `/dashboard/inventaris/[id]` | `inventaris/[id]/page.tsx` | `InventarisDetailClient.tsx` | Kartu stok + export XLSX |
| `/dashboard/inventaris/opname` | `inventaris/opname/page.tsx` | `InventarisOpnameClient.tsx` | Input opname + summary + history |

**Global:** `Sidebar.tsx` punya entry `📦 Inventaris` dengan `alertKey='inventaris'`. Badge `⚠ X` muncul kalau ada barang di bawah `stok_min` (di-fetch di `dashboard/layout.tsx` dari `v_stok_aktual WHERE is_below_min=true`).

---

## 🔁 Alur Kerja (Workflow Owner)

### 1. Setup Awal (sekali)
1. Tambah kategori di `kategori_inventaris` (seed: PKG, ATK, PRL, LNN sudah ada)
2. Tambah barang via **+ Tambah Barang** → pilih kategori → isi nama/satuan/stok_min/harga_beli

### 2. Operasional Harian
- **Beli barang**: klik **➕ Stok Masuk** → pilih barang → qty + harga + tanggal
- **Pakai barang**: klik **➖ Stok Keluar** → pilih barang → qty

### 3. Bulanan (akhir bulan)
1. Klik **📋 Opname Bulanan** → pilih periode (default bulan ini)
2. Untuk tiap barang, isi **Qty Fisik** dari hasil cek gudang
3. Sistem tampilkan **Selisih** otomatis (`fisik - sistem`)
4. Klik **✅ Simpan Opname (Final)** → status FINAL, ADJ movement auto-tercatat, stok terkoreksi

### 4. Laporan
- Klik nama barang di tabel → masuk ke **Kartu Stok**
- Klik **📥 Export XLSX** → download 2 sheet (`Kartu Stok` + `Summary`)

---

## ⚙️ Konvensi

- **Satuan**: Gunakan satuan konsisten per barang (`pcs`, `box`, `roll`, `lembar`, `meter`, `pack`, `botol`, `rim`). Jangan campur (`pcs` + `box` + `roll` di barang berbeda boleh, tapi konsisten untuk 1 barang).
- **Soft delete**: `DELETE /barang/[id]` tidak benar-benar hapus — set `aktif=false`. Data movement historis tetap aman untuk audit.
- **Harga beli**: Disimpan di `barang.harga_beli` sebagai default untuk input movement (bisa di-override per movement). Akan dipakai sebagai dasar expense `5100 Beban ATK` di Sprint 2 via avg price strategy.
- **qty_sistem vs qty_fisik**: `qty_sistem` adalah snapshot dari `v_stok_aktual.stok` saat opname dibuat — walaupun ada IN/OUT setelahnya, snapshot ini tidak berubah (immutable).

---

## 🔗 Integrasi dengan Sprint Lain

### Tergantung pada
- **Modul Outlet** (`001_init.sql`) — `barang.outlet_id` → `outlets.id`

### Digunakan oleh
- **Sprint 2 — Modul Akunting (`004_akunting.sql`)**:
  - Trigger `trg_auto_expense_stok_out` pada `stok_movement` (after insert)
  - Hanya fire untuk `OUT` dengan `ref_type='MANUAL'` (bukan `INVENTARIS_AUTO`)
  - Auto-insert `transaksi_keuangan` dengan `sumber='INVENTARIS'`, `kategori='5100'`, nominal=`total` (= qty × harga_satuan)
  - Update `ref_type` jadi `'INVENTARIS_AUTO'` → mencegah loop di re-trigger
- **Sprint 5 — Export PDF/XLSX**: kartu stok sudah exportable, tinggal dibuat versi PDF untuk laporan bulanan

### Catatan Risiko
- **Struktur `stok_movement` harus stabil** sebelum `004`. Jangan rename kolom `total` atau `qty` setelah Sprint 2 aktif.
- **Satuan konsisten** wajib dijaga — Sprint 2 akan aggregate expense per barang, satuan beda = total kacau.
- **Harga beli**: strategi avg moving akan dipasang di Sprint 2 (mungkin sebagai materialized view atau trigger). Untuk sekarang, harga per movement dipakai langsung.

---

## 🛠️ Cara Menjalankan (untuk Developer Baru)

### 1. Install dependency
Pastikan sudah Next.js + Supabase client sudah setup (`npm install`).

### 2. Jalankan migration
Supabase SQL Editor (berurutan):
1. `001_init.sql`
2. `002_daily_summary.sql`
3. `003_inventaris.sql` ← **modul ini**

Akan terbentuk 5 tabel + 2 view + RLS + 4 kategori seed (PKG, ATK, PRL, LNN).

### 3. Akses UI
Login sebagai owner → Sidebar → **📦 Inventaris**. Tambah barang, catat stok masuk, lihat alert di sidebar.

### 4. Build & verifikasi
```bash
npm run build
```
Harus sukses tanpa TypeScript error.

---

## 📚 File Reference

| Path | Isi |
|---|---|
| `supabase/migrations/003_inventaris.sql` | Migration 210 baris |
| `src/types/index.ts` | Types: `Barang`, `KategoriInventaris`, `StokMovement`, `StokAktual`, `KartuStok`, `Opname`, `OpnameItem` |
| `src/app/dashboard/inventaris/page.tsx` | Server component list |
| `src/app/dashboard/inventaris/[id]/page.tsx` | Server component detail |
| `src/app/dashboard/inventaris/opname/page.tsx` | Server component opname |
| `src/components/dashboard/InventarisClient.tsx` | Client list + modal CRUD & stok |
| `src/components/dashboard/InventarisDetailClient.tsx` | Client kartu stok + export XLSX |
| `src/components/dashboard/InventarisOpnameClient.tsx` | Client form opname |
| `src/app/api/inventaris/barang/route.ts` | GET list + POST baru |
| `src/app/api/inventaris/barang/[id]/route.ts` | GET + PATCH + DELETE |
| `src/app/api/inventaris/stok-masuk/route.ts` | POST IN movement |
| `src/app/api/inventaris/stok-keluar/route.ts` | POST OUT movement (cek stok cukup) |
| `src/app/api/inventaris/opname/route.ts` | POST opname (atomic + ADJ auto) |
| `src/components/Sidebar.tsx` | Entry + alert badge |
| `src/app/dashboard/layout.tsx` | Fetch alert count dari `v_stok_aktual` |

---

## 🆘 Troubleshooting

| Gejala | Sebab | Fix |
|---|---|---|
| Sidebar tidak ada badge peringatan | Tidak ada barang dengan `stok <= stok_min` | Tambah barang dengan `stok_min > 0`, atau lakukan opname untuk koreksi stok |
| Stok keluar gagal "Stok tidak cukup" | Stok sistem minus padahal fisik masih ada | Lakukan **opname** untuk adjust |
| Export XLSX download file kosong | Browser block download dari JS | Pastikan popup/download allowed; library `xlsx` dipakai via `XLSX.writeFile()` |
| Opname periode sama FINAL error | Status FINAL → tidak bisa diedit | Pilih periode lain, atau buat feature "re-open opname" (belum ada) |
| `v_stok_aktual` tidak muncul | Migration 003 belum jalan | Jalankan `003_inventaris.sql` di Supabase SQL Editor |
