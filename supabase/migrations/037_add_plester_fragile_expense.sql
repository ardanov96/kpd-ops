-- ============================================================
-- 037_add_plester_fragile_expense.sql
-- Rekap pengeluaran & otomasi recurring: Pembelian 1 Dus Plester Fragile Merah (@ Rp 249.000)
-- Dibeli pada 11 Juli 2025 (isi 72 pcs) untuk perlengkapan packing paket fragile/pecah belah.
-- Per 5 Oktober 2026 (14,8 bulan), terpakai 64 pcs dan menyisakan 8 pcs.
-- Laju pemakaian: ~7 hari per pcs -> 1 dus (72 pcs) habis setiap ~16,6 bulan sekali.
-- Sisa 8 pcs diperkirakan habis pada akhir November 2026.
-- Otomasi recurring diset interval 16 bulan (jatuh pada November 2026).
-- Terintegrasi ke Modul Inventaris (Metode A) & Akunting (Beban 5100).
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_pkg_kat_id UUID;
  v_kat_5100_id UUID;
  v_barang_id UUID;
  v_sm_in_id UUID;
BEGIN
  -- 1. Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id 
  FROM outlets 
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- 2. Ambil kategori inventaris Packaging (PKG)
  SELECT id INTO v_pkg_kat_id 
  FROM kategori_inventaris 
  WHERE kode = 'PKG' 
  LIMIT 1;

  -- 3. Ambil kategori akun 5100 (Beban ATK & Packaging)
  SELECT id INTO v_kat_5100_id 
  FROM kategori_akun 
  WHERE kode = '5100' 
  LIMIT 1;

  -- 4. Pastikan Master Barang Plester Fragile Merah terdaftar di tabel barang
  SELECT id INTO v_barang_id 
  FROM barang 
  WHERE outlet_id = v_outlet_id AND (nama ILIKE '%fragile%' OR nama ILIKE '%plester merah%')
  LIMIT 1;

  IF v_barang_id IS NULL THEN
    INSERT INTO barang (
      outlet_id, kategori_id, nama, satuan, harga_beli, stok_min, aktif
    ) VALUES (
      v_outlet_id, v_pkg_kat_id, 'Plester Fragile Merah (1 Dus @ 72 Pcs)', 'dus', 249000, 1, true
    ) RETURNING id INTO v_barang_id;
  END IF;

  -- 5. Catat Stok Masuk (Pembelian 1 dus pada 11 Juli 2025)
  SELECT id INTO v_sm_in_id
  FROM stok_movement
  WHERE outlet_id = v_outlet_id
    AND barang_id = v_barang_id
    AND tipe = 'IN'
    AND tanggal = '2025-07-11'
  LIMIT 1;

  IF v_sm_in_id IS NULL THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'IN', 1, 249000, 249000,
      'INVENTARIS_AUTO', 'Pembelian 1 dus plester fragile merah isi 72 pcs (sisa 8 pcs per Okt 2026)', '2025-07-11'
    ) RETURNING id INTO v_sm_in_id;
  END IF;

  -- 6. Catat Transaksi Keuangan Beban 5100 pada 11 Juli 2025 (Nominal Pemakaian Riil 64 pcs: Rp 221.333)
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-07-11'
      AND kategori_id = v_kat_5100_id
      AND (keterangan ILIKE '%fragile%' OR ref_id = v_sm_in_id)
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
      '2025-07-11',
      'KELUAR',
      v_kat_5100_id,
      221333,
      'BANK',
      'Pemakaian riil plester fragile merah Dus #2 (64 pcs terpakai dari 72 pcs, sisa 8 pcs)',
      'INVENTARIS',
      v_sm_in_id
    );
  ELSE
    UPDATE transaksi_keuangan 
    SET nominal = 221333,
        keterangan = 'Pemakaian riil plester fragile merah Dus #2 (64 pcs terpakai dari 72 pcs, sisa 8 pcs)'
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-07-11'
      AND kategori_id = v_kat_5100_id
      AND (keterangan ILIKE '%fragile%' OR ref_id = v_sm_in_id);
  END IF;

  -- 7. Daftarkan Template Recurring Transaksi (Interval 16 Bulan, Nominal Rp 249.000, Metode BANK)
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
      'Pembelian 1 Dus Plester Fragile Merah (Restock)',
      249000,
      'BANK',
      11,
      16,
      v_barang_id,
      'KELUAR',
      true,
      '2025-07-11'
    );
  END IF;

END $$;
