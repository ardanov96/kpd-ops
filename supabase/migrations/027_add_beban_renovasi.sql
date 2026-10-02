-- ============================================================
-- 027_add_beban_renovasi.sql
-- Tambahkan kategori akun Beban Renovasi Outlet (5750)
-- Digunakan untuk mencatat biaya renovasi, pembenahan ruko, partisi,
-- kanopi, fasad, dan pekerjaan fisik outlet yang bersifat permanen.
-- ============================================================

INSERT INTO kategori_akun (kode, nama, tipe, is_system, urutan)
VALUES ('5750', 'Beban Renovasi Outlet', 'EXPENSE', true, 75)
ON CONFLICT (kode) DO UPDATE SET
  nama = EXCLUDED.nama,
  tipe = EXCLUDED.tipe,
  is_system = EXCLUDED.is_system,
  urutan = EXCLUDED.urutan;
