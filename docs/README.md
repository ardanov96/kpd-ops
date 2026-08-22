# 📂 Folder `docs/` — Sprint Brief & Dokumentasi

Folder ini berisi semua dokumen singkat (brief) yang terkait dengan **sprint planning**, **spesifikasi modul**, dan **panduan kolaborasi** untuk project **Ekspedisi Dashboard**.

> **Konvensi penamaan file:**
> - `000-...md` → Dokumen meta (README, glossary, index)
> - `00N-sprint-...md` → Sprint ke-N (planning + task list)
> - `MODUL-...md` → Dokumentasi fitur modul yang **sudah selesai** (cara pakai, API, alur kerja)
> - `xxx-spec-...md` → Brief spesifik (schema, workflow, referensi)

---

## 📑 Daftar Dokumen

| File | Isi | Status |
|---|---|---|
| `000-README.md` | Dokumen ini (index & konvensi) | ✅ |
| `000-glossary.md` | Istilah teknis & akunting yang dipakai | ✅ |
| `001-sprint-modul-inventaris.md` | Sprint 1 — Modul Inventaris (task list) | ✅ |
| `002-sprint-modul-akunting.md` | Sprint 2 — Modul Akunting (task list) | ✅ |
| `003-sprint-modul-pajak.md` | Sprint 3 — Modul Pelaporan Pajak | ✅ |
| `004-sprint-storage-recurring.md` | Sprint 4 — Storage + Recurring Transaction | ✅ |
| `005-sprint-export-pdf-xlsx.md` | Sprint 5 — Export PDF/XLSX & Polish | ✅ |
| `MODUL-INVENTARIS.md` | Dokumentasi fitur Modul Inventaris | ✅ |
| `MODUL-AKUNTING.md` | Dokumentasi fitur Modul Akunting | ✅ |
| `MODUL-PAJAK.md` | Dokumentasi fitur Modul Pajak | ✅ |
| `010-spec-schema.md` | Schema SQL final (gabungan semua migration) | ✅ |
| `020-spec-workflow.md` | Workflow & otomasi tiap modul | ✅ |
| `030-decision-log.md` | Log keputusan & alasan teknis (sampai Sprint 6: D-027 s/d D-034) | ✅ |

---

## 🏁 Status Sprint

| Sprint | Tema | Status |
|---|---|---|
| Sprint 0 | Setup project + dashboard + import XLSX | ✅ Done |
| Sprint 1 | Modul Inventaris (stok, opname, kartu stok) | ✅ Done |
| Sprint 2 | Modul Akunting (income/expense/recurring/closing) | ✅ Done |
| Sprint 3 | Modul Pajak (PPh Final, NPWP, SPT estimator) | ✅ Done |
| Sprint 4 | Storage (nota, SSP) + Recurring Cron | ✅ Done |
| Sprint 5 | Export PDF/XLSX + Polish UX | ✅ Done |
| Sprint 6 | Security & Robustness (API auth, atomic ops, backup S3, timezone) | ✅ Done |
| Sprint 7+ | Search STT, atomic expense+upload, multi-outlet, Harian, Analitik, Cek Ongkir | 🚧 In-flight / backlog |

**Modul tambahan yang sudah hadir pasca Sprint 5** (belum masuk sprint brief formal):
- **📅 Harian** — `/dashboard/harian` (recap harian via `/api/summary-harian`)
- **📈 Analitik** — `/dashboard/analitik` (perbandingan outlet/kurir)
- **🔍 Cek Ongkir** — `/dashboard/ongkir` + `/api/ongkir/check` & `/api/ongkir/villages`
- **📤 Import JNE (PDF)** — `/api/upload-jne` (parser terpisah di `src/lib/parsers/jnePdfParser.ts`)
- **📦 Master Ekspedisi** — `/api/ekspedisi` (CRUD data ekspedisi)
- **🔐 Backup DB → S3** — `/api/admin/backup` (Sprint 6)
- **🔑 API auth wrapper** — `src/lib/api/auth.ts` (`requireOwner()` / `requireAuth()`, Sprint 6)
- **🛡️ Centralized response** — `src/lib/api/response.ts` (Sprint 6)
- **🕐 Timezone helper (WIB)** — `src/lib/timezone.ts` (Sprint 6)
- **🧩 Type constants** — `src/types/index.ts` (`PAJAK_STATUS`, `TRANSAKSI_TIPE`, `METODE_PEMBAYARAN`, dll — Sprint 6)
- **🧱 Atomic operations** — `fn_save_opname_atomic`, `fn_stok_keluar_atomic` (migrations `007` & `012`)
- **⚡ Performance indexes** — `supabase/migrations/011_indexes_performance.sql`

---

## 🗃️ Migration Files

Semua migration harus dijalankan **berurutan** (001 → 012) di Supabase SQL Editor:

| # | File | Sprint | Isi |
|---|---|---|---|
| 001 | `001_init.sql` | 0 | Schema awal + outlets/profiles/kurir/transaksi + RLS + seed |
| 002 | `002_daily_summary.sql` | 0 | View summary harian |
| 003 | `003_inventaris.sql` | 1 | Modul Inventaris (5 tabel + 2 view) |
| 004 | `004_akunting.sql` | 2 | Modul Akunting (4 tabel + 4 view + 4 fn + 1 trigger + 16 seed) |
| 005 | `005_pajak.sql` | 3 | Modul Pajak (2 tabel + 2 view + 1 fn) |
| 006a | `006_pajak_closing_trigger.sql` | 3 | Patch closing → auto-trigger PPh Final |
| 006b | `006_storage_recurring.sql` | 4 | Recurring template + bucket RLS |
| 007 | `007_opname_atomic.sql` | 6 | `fn_save_opname_atomic` (race-safe) |
| 008 | `008_recurring_lastday.sql` | 4 | Recurring tgl 31 di Feb handled |
| 009 | `009_aggregate_income_idempotent.sql` | 6 | `fn_aggregate_income` idempotent |
| 010 | `010_aggregate_income_clarity.sql` | 6 | Kolom klarifikasi income |
| 011 | `011_indexes_performance.sql` | 6 | Index untuk query besar |
| 012 | `012_stok_keluar_atomic.sql` | 6 | `fn_stok_keluar_atomic` (race-safe) |

---

## 🧭 Menu Sidebar (Setelah Login)

`src/components/Sidebar.tsx` saat ini punya 10 entry:

| Icon | Menu | Path |
|---|---|---|
| 📅 | Harian | `/dashboard/harian` |
| 📊 | Ringkasan | `/dashboard` |
| 📦 | Transaksi | `/dashboard/transaksi` |
| 📈 | Analitik | `/dashboard/analitik` |
| 💰 | Akunting | `/dashboard/akunting` |
| 🧾 | Pajak | `/dashboard/pajak` (alertKey=pajak) |
| 🔍 | Cek Ongkir | `/dashboard/ongkir` |
| 📤 | Import Laporan | `/dashboard/upload` |
| 📦 | Inventaris | `/dashboard/inventaris` (alertKey=inventaris) |
| ⚙️ | Pengaturan | `/dashboard/profil` |

> **Badge alert** (merah `⚠ X`) muncul di:
> - **Pajak** → PPh Final `BELUM` dengan `sisa_hari ≤ 7` (dari `v_pajak_reminder`)
> - **Inventaris** → barang dengan `stok <= stok_min` (dari `v_stok_aktual`)

---

## 🔐 Keamanan (Sprint 6 Hardening)

- **API auth wrapper**: `src/lib/api/auth.ts` punya `requireOwner()` (write) & `requireAuth()` (read)
- **Sanitized response**: `src/lib/api/response.ts` (tidak bocor schema DB)
- **Storage owner-only**: `upload-bukti` & `get-signed-url` pakai `requireOwner()` (NPWP/SSP sensitif)
- **Middleware skip**: `/api/cron/*` & `/api/admin/*` (Bearer token validation di route)
- **Closing lock**: `pajak/bayar` reject edit kalau `periode_closing.is_locked = true` (lihat D-031)
- **Timezone helper**: konsisten WIB di seluruh dashboard (lihat D-032)
- **Atomic ops**: `fn_stok_keluar_atomic`, `fn_save_opname_atomic` (lihat D-029 & Sprint 6)

---

## 🔗 Cara Pakai Folder Ini

1. **Mulai sprint baru** → buka file sprint yang relevan (misal `001-sprint-modul-inventaris.md`)
2. **Paham fitur yang sudah jadi** → buka `MODUL-...md` (misal `MODUL-INVENTARIS.md` atau `MODUL-AKUNTING.md`)
3. **Cek referensi schema** → buka `010-spec-schema.md`
4. **Paham kenapa keputusan X diambil** → buka `030-decision-log.md` (sudah sampai `D-034`)
5. **Lihat setup lengkap / cara jalanin project** → buka `README.md` di root

File-file di folder ini adalah **single source of truth** untuk development.
Sebelum mulai kerja, baca file sprint yang relevan dulu.

---

## 📦 Library Utama (dari `package.json`)

- `next ^16.2.4` (App Router)
- `react ^18`
- `@supabase/ssr ^0.5.1` + `@supabase/supabase-js ^2.45.4`
- `@react-pdf/renderer ^4.6.1`
- `xlsx ^0.18.5`
- `recharts ^2.12.7`
- `pg ^8.23.0` (untuk backup S3 — Sprint 6)
- `@aws-sdk/client-s3 ^3.1116.0`
- `date-fns ^3.6.0`
- `lucide-react ^0.383.0`
- `tailwindcss ^3.4.1`
- `pdf-parse ^2.4.5`

> Dev server di port **3001** (lihat `package.json` scripts).
