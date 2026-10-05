-- ============================================================
-- 036_add_kertas_thermal_expense.sql
-- Rekap pengeluaran & otomasi recurring: Pembelian 1 Dus Kertas Thermal Printer (@ Rp 300.000)
-- Dibeli pada 17 Juli 2025 (isi 24 roll) untuk operasional printer Xprinter (dibeli 12 Juli 2025).
-- Per 5 Oktober 2026 (14,6 bulan), baru terpakai 9 roll dan masih tersisa 15 roll.
-- Laju pemakaian: ~1,62 bulan per roll -> 1 dus (24 roll) habis setiap ~39 bulan sekali.
-- Terintegrasi ke Modul Inventaris (Metode A) & Akunting (Beban 5100).
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_atk_kat_id UUID;
  v_kat_5100_id UUID;
  v_barang_id UUID;
  v_sm_in_id UUID;
BEGIN
  -- 1. Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id 
  FROM outlets 
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- 2. Ambil kategori inventaris ATK & Cetak (ATK)
  SELECT id INTO v_atk_kat_id 
  FROM kategori_inventaris 
  WHERE kode = 'ATK' 
  LIMIT 1;

  -- 3. Ambil kategori akun 5100 (Beban ATK & Packaging)
  SELECT id INTO v_kat_5100_id 
  FROM kategori_akun 
  WHERE kode = '5100' 
  LIMIT 1;

  -- 4. Pastikan Master Barang Kertas Thermal Printer terdaftar di tabel barang
  SELECT id INTO v_barang_id 
  FROM barang 
  WHERE outlet_id = v_outlet_id AND (nama ILIKE '%thermal%dus%' OR nama ILIKE '%kertas thermal%')
  LIMIT 1;

  IF v_barang_id IS NULL THEN
    INSERT INTO barang (
      outlet_id, kategori_id, nama, satuan, harga_beli, stok_min, aktif
    ) VALUES (
      v_outlet_id, v_atk_kat_id, 'Kertas Thermal Printer (1 Dus @ 24 Roll)', 'dus', 300000, 1, true
    ) RETURNING id INTO v_barang_id;
  ELSE
    UPDATE barang SET harga_beli = 300000 WHERE id = v_barang_id;
  END IF;

  -- 5. Catat Stok Masuk (Pembelian 1 dus pada 17 Juli 2025)
  SELECT id INTO v_sm_in_id
  FROM stok_movement
  WHERE outlet_id = v_outlet_id
    AND barang_id = v_barang_id
    AND tipe = 'IN'
    AND tanggal = '2025-07-17'
  LIMIT 1;

  IF v_sm_in_id IS NULL THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'IN', 1, 300000, 300000,
      'INVENTARIS_AUTO', 'Pembelian 1 dus kertas thermal printer (24 roll) untuk Xprinter (sisa 15 roll per Okt 2026)', '2025-07-17'
    ) RETURNING id INTO v_sm_in_id;
  ELSE
    UPDATE stok_movement SET harga_satuan = 300000, total = 300000 WHERE id = v_sm_in_id;
  END IF;

  -- 6. Catat Transaksi Keuangan Beban 5100 pada 17 Juli 2025
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-07-17'
      AND kategori_id = v_kat_5100_id
      AND (keterangan ILIKE '%kertas thermal printer%' OR ref_id = v_sm_in_id)
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
      '2025-07-17',
      'KELUAR',
      v_kat_5100_id,
      300000,
      'BANK',
      'Pembelian 1 dus kertas thermal printer (24 roll) untuk Xprinter',
      'INVENTARIS',
      v_sm_in_id
    );
  ELSE
    UPDATE transaksi_keuangan 
    SET nominal = 300000 
    WHERE outlet_id = v_outlet_id 
      AND tanggal = '2025-07-17' 
      AND kategori_id = v_kat_5100_id
      AND (keterangan ILIKE '%kertas thermal printer%' OR ref_id = v_sm_in_id);
  END IF;

  -- 7. Daftarkan Template Recurring Transaksi (Interval 39 Bulan, Nominal Rp 300.000, Metode BANK)
  IF NOT EXISTS (
    SELECT 1 FROM recurring_transactions 
    WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id
  ) THEN
    INSERT INTO recurring_transactions (
      outlet_id,
      kategori_id,
      nama_template,
      nominal,
      metode,
      tanggal_setiap_bulan,
      interval_bulan,
      barang_id,
      tipe,
      aktif,
      last_run
    ) VALUES (
      v_outlet_id,
      v_kat_5100_id,
      'Pembelian 1 Dus Kertas Thermal Printer (Restock)',
      300000,
      'BANK',
      17,
      39,
      v_barang_id,
      'KELUAR',
      true,
      '2025-07-17'
    );
  ELSE
    UPDATE recurring_transactions
    SET nominal = 300000
    WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id;
  END IF;

END $$;
