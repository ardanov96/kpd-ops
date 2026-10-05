-- ============================================================
-- 038_add_plester_fragile_initial_expense.sql
-- Pencatatan pembelian Dus #1 Plester Fragile Merah pada awal berdiri outlet (25 November 2023)
-- Nominal: Rp 249.000
-- Pemakaian habis pada Juli 2025 sebelum pembelian Dus #2 (11 Juli 2025).
-- Terintegrasi ke Modul Inventaris (Metode A) & Akunting (Beban 5100).
-- Metode Pembayaran: CASH (bersamaan dengan Dus #1 Plester Bening)
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_5100_id UUID;
  v_barang_id UUID;
  v_sm_in_id UUID;
BEGIN
  -- 1. Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id 
  FROM outlets 
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- 2. Ambil kategori akun 5100 (Beban ATK & Packaging)
  SELECT id INTO v_kat_5100_id 
  FROM kategori_akun 
  WHERE kode = '5100' 
  LIMIT 1;

  -- 3. Ambil Master Barang Plester Fragile Merah
  SELECT id INTO v_barang_id 
  FROM barang 
  WHERE outlet_id = v_outlet_id AND (nama ILIKE '%fragile%' OR nama ILIKE '%plester merah%')
  LIMIT 1;

  -- 4. Catat Stok Masuk Dus #1 (25 November 2023)
  SELECT id INTO v_sm_in_id
  FROM stok_movement
  WHERE outlet_id = v_outlet_id
    AND barang_id = v_barang_id
    AND tanggal = '2023-11-25'
    AND tipe = 'IN'
  LIMIT 1;

  IF v_sm_in_id IS NULL THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'IN', 1, 249000, 249000,
      'INVENTARIS_AUTO', 'Pembelian 1 dus plester fragile merah isi 72 pcs packaging (Dus #1 Awal Operasional)', '2023-11-25'
    ) RETURNING id INTO v_sm_in_id;
  END IF;

  -- 5. Catat Stok Keluar Dus #1 (Habis sebelum restock Dus #2 pada Juli 2025)
  IF NOT EXISTS (
    SELECT 1 FROM stok_movement 
    WHERE outlet_id = v_outlet_id 
      AND barang_id = v_barang_id 
      AND tanggal = '2025-07-10' 
      AND tipe = 'OUT'
  ) THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'OUT', 1, 249000, 249000,
      'INVENTARIS_AUTO', 'Pemakaian habis 1 dus plester fragile merah stok awal Dus #1 periode Nov 2023 - Jul 2025', '2025-07-10'
    );
  END IF;

  -- 6. Catat Transaksi Keuangan Beban 5100 pada 25 November 2023
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2023-11-25'
      AND kategori_id = v_kat_5100_id
      AND nominal = 249000
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
      ref_id
    ) VALUES (
      v_outlet_id,
      '2023-11-25',
      'KELUAR',
      v_kat_5100_id,
      249000,
      'CASH',
      'Pembelian 1 dus plester fragile merah isi 72 pcs packaging (Dus #1)',
      'INVENTARIS',
      v_sm_in_id
    );
  END IF;

END $$;
