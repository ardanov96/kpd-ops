-- ============================================================
-- 051_add_neon_box_jne_expense.sql
-- Pencatatan pengeluaran beban renovasi outlet: pembuatan dan pemasangan neon box JNE Express
-- Tanggal: 12 Desember 2025 (2025-12-12)
-- Nominal: Rp 3.000.000
-- Kategori: 5750 (Beban Renovasi Outlet)
-- Metode Pembayaran: BANK
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
  v_owner_id UUID;
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

  -- Ambil owner profile id jika ada
  SELECT id INTO v_owner_id
  FROM profiles
  WHERE role = 'owner'
  LIMIT 1;

  -- Insert jika belum ada transaksi serupa pada tanggal tersebut
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-12-12'
      AND kategori_id = v_kat_id
      AND nominal = 3000000
  ) THEN
    INSERT INTO transaksi_keuangan (
      outlet_id,
      tanggal,
      tipe,
      kategori_id,
      nominal,
      metode,
      keterangan,
      sumber,
      created_by
    ) VALUES (
      v_outlet_id,
      '2025-12-12',
      'KELUAR',
      v_kat_id,
      3000000,
      'BANK',
      'Biaya pembuatan dan pemasangan neon box JNE Express untuk fasad outlet',
      'MANUAL',
      v_owner_id
    );
  END IF;
END $$;
