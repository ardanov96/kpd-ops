-- ============================================================
-- 028_add_renovasi_gang_expense.sql
-- Pencatatan beban renovasi gang untuk lahan parkir motor
-- Nominal: Rp 5.000.000 dikeluarkan pada 31 Oktober 2025
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
      AND tanggal = '2025-10-31'
      AND kategori_id = v_kat_id
      AND nominal = 5000000
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
      '2025-10-31',
      'KELUAR',
      v_kat_id,
      5000000,
      'BANK',
      'Biaya renovasi gang untuk lahan parkir motor di sebelah outlet',
      'MANUAL'
    );
  END IF;
END $$;
