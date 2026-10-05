-- ============================================================
-- 039_add_barcode_scanner_expense.sql
-- Pencatatan pembelian alat scanning barcode kasir / scanner resi operasional
-- Nominal: Rp 202.000 dikeluarkan pada 12 Agustus 2025
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
      AND tanggal = '2025-08-12'
      AND kategori_id = v_kat_id
      AND nominal = 202000
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
      '2025-08-12',
      'KELUAR',
      v_kat_id,
      202000,
      'BANK',
      'Pembelian barcode scanner untuk operasional kasir dan scan resi paket',
      'MANUAL'
    );
  END IF;
END $$;
