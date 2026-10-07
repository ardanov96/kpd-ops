-- ============================================================
-- 044_add_usb_docking_expense.sql
-- Pencatatan pembelian 1 unit USB docking station untuk operasional PC outlet
-- Tanggal: 10 Mei 2025 (2025-05-10)
-- Nominal: Rp 1.600.000
-- Kategori: 5400 (Beban Perlengkapan Kantor)
-- Metode Pembayaran: BANK
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

  -- Ambil kategori 5400 (Beban Perlengkapan Kantor)
  SELECT id INTO v_kat_id 
  FROM kategori_akun 
  WHERE kode = '5400' 
  LIMIT 1;

  -- Insert jika belum ada transaksi serupa pada tanggal tersebut
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-05-10'
      AND kategori_id = v_kat_id
      AND nominal = 1600000
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
      '2025-05-10',
      'KELUAR',
      v_kat_id,
      1600000,
      'BANK',
      'Pembelian 1 unit USB docking station untuk komputer operasional outlet',
      'MANUAL'
    );
  END IF;
END $$;
