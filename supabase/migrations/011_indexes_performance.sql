-- ============================================================
-- 011_indexes_performance.sql
-- Fix Bug #10: Missing index untuk view summary
-- Sprint 5 polish
-- ============================================================

-- Sebelumnya: index di transaksi_keuangan, stok_movement, dll. sudah cukup
--   (lihat migration 004_akunting.sql line ~120-130).
-- Tapi ada beberapa index yang MISSING untuk performa dashboard summary:

-- 1. Index untuk v_summary_bulanan (migration 002_daily_summary.sql)
create index if not exists idx_transaksi_summary
  on transaksi (outlet_id, kurir_id, tanggal);

-- 2. Index untuk v_laba_rugi (transaksi_keuangan, sudah ada idx_tk_periode)
--    Tapi query dashboard sering filter by (outlet_id, tipe, tanggal) — tambahkan composite
create index if not exists idx_tk_outlet_tipe_tanggal
  on transaksi_keuangan (outlet_id, tipe, tanggal);

-- 3. Index untuk v_pajak_reminder (sudah ada di 005 tapi tambahkan composite untuk filter outlet)
create index if not exists idx_pajak_rekap_outlet_periode_status
  on pajak_rekap (outlet_id, periode, status_bayar);

-- 4. Index untuk v_keuangan_per_kategori (dashboard drill-down)
create index if not exists idx_tk_outlet_kategori_tanggal
  on transaksi_keuangan (outlet_id, kategori_id, tanggal);

-- 5. Index untuk opname_item (sudah ada unique, tapi tambah non-unique untuk query by barang)
create index if not exists idx_opname_item_barang
  on opname_item (barang_id);

-- 6. Index untuk stok_movement by ref_type (untuk query "ADJ movements" di dashboard inventaris)
create index if not exists idx_stok_movement_ref_type
  on stok_movement (ref_type, ref_id);

-- ============================================================
-- CATATAN:
-- 1. Index ini idempotent (`IF NOT EXISTS`) — aman untuk multiple deploy
-- 2. Untuk 1 outlet + 1K-10K rows/bulan, gain performa minimal terlihat
--    di dashboard TTFB (Time to First Byte)
-- 3. Index composite dipilih sesuai pola query dashboard (where clause paling sering)
-- 4. Tidak menambah index terlalu banyak — akan memperlambat INSERT
-- ============================================================