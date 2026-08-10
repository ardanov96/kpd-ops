# 🏃 Sprint 1 — Modul Inventaris

> **Tujuan:** Kelola stok barang habis pakai (consumables) outlet: karton, lakban, kertas print, plastik packing, thermal paper, dll.

---

## 📦 Scope

### Yang DICAKUP
- Master barang per outlet (CRUD)
- Stok masuk (belanja / restock)
- Stok keluar (dipakai operasional)
- Opname bulanan (cek fisik vs sistem)
- Alert stok minimum
- Laporan kartu stok per barang

### Yang TIDAK DICAKUP (ditunda)
- Aset tetap (printer, timbangan) → bukan consumable
- Transfer barang antar outlet → tidak relevan (1 outlet)
- Barcode scanner → manual SKU dulu

---

## 🗂️ Schema (migration `003_inventaris.sql`)

Lihat detail lengkap di `010-spec-schema.md`. Singkat:

```
kategori_inventaris → barang → stok_movement (IN|OUT|ADJ) → opname → opname_item
```

---

## 📋 Task Breakdown

### Phase 1A — DB & Backend (siapapun, fondasi dulu)

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 1.1 | Tulis `supabase/migrations/003_inventaris.sql` | 🤖 **Cline** | ⬜ | File SQL siap jalan |
| 1.2 | Jalankan migration di Supabase SQL Editor | 👤 **Owner** | ⬜ | Tabel & view terbentuk |
| 1.3 | Tambah types di `src/types/index.ts` (Barang, StokMovement, Opname) | 🤖 **Cline** | � | TypeScript types |
| 1.4 | Seed kategori default (Packaging, ATK, Perlengkapan) | 🤖 **Cline** | ⬜ | 4-5 row di `kategori_inventaris` |

### Phase 1B — Master Barang

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 1.5 | Halaman `src/app/dashboard/inventaris/page.tsx` (list barang) | 🤖 **Cline** | ⬜ | Halaman list + alert stok minimum |
| 1.6 | Komponen `InventarisClient.tsx` (CRUD barang) | 🤖 **Cline** | ⬜ | Form tambah/edit/hapus |
| 1.7 | Tambah entry NAV di `Sidebar.tsx` (icon: 📦) | 🤖 **Cline** | ⬜ | Menu sidebar |

### Phase 1C — Stok Movement

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 1.8 | API route `POST /api/inventaris/stok-masuk` | 🤖 **Cline** | � | Endpoint + validasi |
| 1.9 | API route `POST /api/inventaris/stok-keluar` | 🤖 **Cline** | ⬜ | Endpoint + auto-journal placeholder |
| 1.10 | Modal form "Catat Stok Masuk/Keluar" di halaman inventaris | 🤖 **Cline** | ⬜ | UI form + integrasi API |

### Phase 1D — Opname Bulanan

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 1.11 | Halaman `src/app/dashboard/inventaris/opname/page.tsx` | 🤖 **Cline** | ⬜ | Halaman input opname |
| 1.12 | Komponen `InventarisOpnameClient.tsx` | 🤖 **Cline** | ⬜ | Form + auto-adjust |
| 1.13 | API route `POST /api/inventaris/opname` (atomic) | � **Cline** | ⬜ | Insert header + items + ADJ movements |

### Phase 1E — Laporan

| # | Task | Owner | Status | Output |
|---|---|---|---|---|
| 1.14 | View `v_stok_aktual` di migration (SUM movement per barang) | 🤖 **Cline** | ⬜ | View DB |
| 1.15 | Halaman kartu stok per barang (drill-down) | 🤖 **Cline** | ⬜ | `/dashboard/inventaris/[id]` |
| 1.16 | Alert badge di sidebar (barang di bawah `stok_min`) | 🤖 **Cline** | ⬜ | Indikator real-time |

---

## ✅ Definition of Done (Sprint 1 Selesai)

- [ ] Migration `003_inventaris.sql` jalan tanpa error
- [ ] Owner bisa tambah barang baru
- [ ] Owner bisa catat stok masuk & keluar
- [ ] Owner bisa opname bulanan → stok auto-adjusted
- [ ] Sidebar ada badge "�️ X barang minimum"
- [ ] Kartu stok per barang bisa dilihat & di-export XLSX
- [ ] Build `npm run build` sukses tanpa TypeScript error

---

## 🔗 Dependencies

- **Tergantung**: tidak ada (modul pertama)
- **Digunakan oleh**: Sprint 2 (auto-journal stok keluar → akunting)

---

## ⚠️ Risiko & Catatan

- **Risiko**: trigger `stok_keluar_ke_akunting` akan dipasang di migration `004`, jadi pastikan struktur `stok_movement` sudah stabil
- **Catatan**: satuan (pcs/box/roll/lembar) WAJIB konsisten untuk akurasi stok
- **Catatan**: harga_beli digunakan sebagai dasar expense (avg price) — perlu strategi avg moving
