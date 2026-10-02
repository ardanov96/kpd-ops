-- ============================================================
-- 029_add_bubble_wrap_expenses.sql
-- Rekap pengeluaran operasional: Pembelian 1 roll bubble wrap (@ Rp 110.000)
-- Pola pemakaian habis setiap 4 bulan sekali sejak awal operasional (Jan 2024 - Sep 2026)
-- Terintegrasi ke Modul Inventaris (Metode A) & Akunting (Beban 5100)
-- Metode Pembayaran: CASH
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_pkg_kat_id UUID;
  v_kat_5100_id UUID;
  v_barang_id UUID;
  v_sm_in_id UUID;
  v_sm_out_id UUID;
  v_dates DATE[] := ARRAY[
    '2024-01-10'::DATE,
    '2024-05-10'::DATE,
    '2024-09-10'::DATE,
    '2025-01-10'::DATE,
    '2025-05-10'::DATE,
    '2025-09-10'::DATE,
    '2026-01-10'::DATE,
    '2026-05-10'::DATE,
    '2026-09-10'::DATE
  ];
  v_date DATE;
  v_idx INT := 1;
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

  -- 4. Pastikan Master Barang Bubble Wrap terdaftar di tabel barang
  SELECT id INTO v_barang_id 
  FROM barang 
  WHERE outlet_id = v_outlet_id AND nama = 'Bubble Wrap 1.25m x 50m'
  LIMIT 1;

  IF v_barang_id IS NULL THEN
    INSERT INTO barang (
      outlet_id, kategori_id, nama, satuan, harga_beli, stok_min, aktif
    ) VALUES (
      v_outlet_id, v_pkg_kat_id, 'Bubble Wrap 1.25m x 50m', 'roll', 110000, 1, true
    ) RETURNING id INTO v_barang_id;
  END IF;

  -- 5. Catat pergerakan stok dan transaksi keuangan untuk setiap periode
  FOREACH v_date IN ARRAY v_dates
  LOOP
    -- A. Stok Masuk (Pembelian 1 roll)
    SELECT id INTO v_sm_in_id
    FROM stok_movement
    WHERE outlet_id = v_outlet_id
      AND barang_id = v_barang_id
      AND tipe = 'IN'
      AND tanggal = v_date
    LIMIT 1;

    IF v_sm_in_id IS NULL THEN
      INSERT INTO stok_movement (
        outlet_id, barang_id, tipe, qty, harga_satuan, total,
        ref_type, keterangan, tanggal
      ) VALUES (
        v_outlet_id, v_barang_id, 'IN', 1, 110000, 110000,
        'MANUAL', 'Pembelian 1 roll bubble wrap packaging (Roll #' || v_idx || ')', v_date
      ) RETURNING id INTO v_sm_in_id;
    END IF;

    -- B. Stok Keluar (Pemakaian operasional packing)
    SELECT id INTO v_sm_out_id
    FROM stok_movement
    WHERE outlet_id = v_outlet_id
      AND barang_id = v_barang_id
      AND tipe = 'OUT'
      AND tanggal = v_date
    LIMIT 1;

    IF v_sm_out_id IS NULL THEN
      INSERT INTO stok_movement (
        outlet_id, barang_id, tipe, qty, harga_satuan, total,
        ref_type, keterangan, tanggal
      ) VALUES (
        v_outlet_id, v_barang_id, 'OUT', 1, 110000, 110000,
        'MANUAL', 'Pemakaian operasional packing paket (Roll #' || v_idx || ')', v_date
      ) RETURNING id INTO v_sm_out_id;
    END IF;

    -- C. Transaksi Keuangan (Beban 5100 dengan sumber INVENTARIS sesuai Metode A)
    IF NOT EXISTS (
      SELECT 1 FROM transaksi_keuangan
      WHERE outlet_id = v_outlet_id
        AND tanggal = v_date
        AND kategori_id = v_kat_5100_id
        AND nominal = 110000
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
        v_date,
        'KELUAR',
        v_kat_5100_id,
        110000,
        'CASH',
        'Pembelian 1 roll bubble wrap packaging (Roll #' || v_idx || ')',
        'INVENTARIS',
        v_sm_out_id
      );
    END IF;

    v_idx := v_idx + 1;
  END LOOP;
END $$;
