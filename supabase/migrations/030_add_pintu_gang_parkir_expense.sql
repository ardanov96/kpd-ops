-- ============================================================
-- 030_add_pintu_gang_parkir_expense.sql
-- Pencatatan beban renovasi pemasangan pintu masuk baru untuk gang parkir motor
-- Nominal: Rp 2.000.000 dikeluarkan pada 1 Desember 2025
-- Kategori: 5750 (Beban Renovasi Outlet)
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
BEGIN
  -- Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id 
  FROM outlets 
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- Ambil kategori 5750 (Beban Renovasi Outlet)
  SELECT id INTO v_kat_id 
  FROM kategori_akun 
  WHERE kode = '5750' 
  LIMIT 1;

  -- Insert jika belum ada transaksi serupa pada tanggal tersebut
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-12-01'
      AND kategori_id = v_kat_id
      AND nominal = 2000000
  ) THEN
    INSERT INTO transaksi_keuangan (
      outlet_id,
      tanggal,
      tipe,
      kategori_id,
      nominal,
      metode,
      keterangan,
      sumber
    ) VALUES (
      v_outlet_id,
      '2025-12-01',
      'KELUAR',
      v_kat_id,
      2000000,
      'BANK',
      'Biaya renovasi pemasangan pintu masuk baru untuk gang parkir motor',
      'MANUAL'
    );
  END IF;
END $$;
