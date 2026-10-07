-- ============================================================
-- 050_remove_powersupply_kedua_expense.sql
-- Ralat pencatatan pembelian unit power supply kedua (11 November 2025 - Rp 678.000).
-- Transaksi ini murni dibeli menggunakan uang pribadi owner dan tidak menggunakan kas outlet.
-- Sesuai konfirmasi owner, transaksi ini dihapus sepenuhnya dari pembukuan outlet
-- sehingga tidak diakui sebagai beban operasional dan tidak mengurangi kas/bank outlet.
-- ============================================================

DELETE FROM transaksi_keuangan
WHERE id = '6949cc6a-4dbe-4209-a987-77cff8f06a8d'
   OR (tanggal = '2025-11-11' AND nominal = 678000 AND keterangan ILIKE '%power supply%');
