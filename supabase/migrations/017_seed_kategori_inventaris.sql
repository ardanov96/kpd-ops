-- ============================================================
-- 017_seed_kategori_inventaris.sql
-- Seed kategori default untuk Modul Inventaris (Barang Habis Pakai)
-- ============================================================

INSERT INTO kategori_inventaris (id, kode, nama, deskripsi) VALUES
  ('00000000-0000-0000-0000-000000000101', 'PKG', 'Packaging', 'Karton, lakban, plastik packing, bubble wrap, polymailer'),
  ('00000000-0000-0000-0000-000000000102', 'ATK', 'ATK & Cetak', 'Kertas thermal resi, kertas HVS, label stiker, tinta printer'),
  ('00000000-0000-0000-0000-000000000103', 'PRL', 'Perlengkapan Packing', 'Dispenser lakban, gunting, cutter, timbangan, tali strapping'),
  ('00000000-0000-0000-0000-000000000104', 'OPS', 'Operasional & Kebersihan', 'Kantong sampah, pembersih lantai, hand sanitizer, tisu'),
  ('00000000-0000-0000-0000-000000000105', 'LNN', 'Lain-lain', 'Kategori umum untuk barang perlengkapan lainnya')
ON CONFLICT (kode) DO UPDATE SET
  nama = EXCLUDED.nama,
  deskripsi = EXCLUDED.deskripsi;
