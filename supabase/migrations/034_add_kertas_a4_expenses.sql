-- ============================================================
-- 034_add_kertas_a4_expenses.sql
-- Rekap pengeluaran operasional & recurring: Pembelian Kertas HVS A4 (@ Rp 30.000)
-- 2 pack awal (Rp 80.000) dibeli pada 2 Oktober 2023 habis dalam 6 bulan (Maret 2024).
-- Mulai restock rutin per 3 bulan sekali sejak 2 April 2024 s/d 2 Oktober 2026 (11 siklus).
-- Terintegrasi ke Modul Inventaris (Metode A) & Akunting (Beban 5100)
-- Metode Pembayaran: CASH
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_atk_kat_id UUID;
  v_kat_5100_id UUID;
  v_barang_id UUID;
  v_sm_in_id UUID;
  v_sm_out_id UUID;
  v_dates DATE[] := ARRAY[
    '2024-04-02'::DATE,
    '2024-07-02'::DATE,
    '2024-10-02'::DATE,
    '2025-01-02'::DATE,
    '2025-04-02'::DATE,
    '2025-07-02'::DATE,
    '2025-10-02'::DATE,
    '2026-01-02'::DATE,
    '2026-04-02'::DATE,
    '2026-07-02'::DATE,
    '2026-10-02'::DATE
  ];
  v_date DATE;
  v_idx INT := 1;
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

  -- 4. Pastikan Master Barang Kertas HVS A4 terdaftar di tabel barang
  SELECT id INTO v_barang_id 
  FROM barang 
  WHERE outlet_id = v_outlet_id AND (nama = 'Kertas HVS A4 1 Pack' OR nama ILIKE '%kertas%a4%')
  LIMIT 1;

  IF v_barang_id IS NULL THEN
    INSERT INTO barang (
      outlet_id, kategori_id, nama, satuan, harga_beli, stok_min, aktif
    ) VALUES (
      v_outlet_id, v_atk_kat_id, 'Kertas HVS A4 1 Pack', 'pack', 30000, 1, true
    ) RETURNING id INTO v_barang_id;
  END IF;

  -- 5. Hubungkan stok awal 2 pack (2 Oktober 2023) ke kartu stok inventaris
  -- Stok Masuk 2 pack awal
  IF NOT EXISTS (
    SELECT 1 FROM stok_movement 
    WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id AND tanggal = '2023-10-02' AND tipe = 'IN'
  ) THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'IN', 2, 40000, 80000,
      'INVENTARIS_AUTO', 'Stok awal 2 pack kertas A4 rintisan outlet', '2023-10-02'
    );
  END IF;

  -- Stok Keluar pemakaian 2 pack awal (habis tepat sebelum restock rutin 2 April 2024)
  IF NOT EXISTS (
    SELECT 1 FROM stok_movement 
    WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id AND tanggal = '2024-04-01' AND tipe = 'OUT'
  ) THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'OUT', 2, 40000, 80000,
      'INVENTARIS_AUTO', 'Pemakaian habis 2 pack kertas A4 stok awal periode Okt 2023 - Mar 2024', '2024-04-01'
    );
  END IF;

  -- 6. Catat pergerakan stok dan transaksi keuangan untuk 11 periode restock rutin (2024-04 s/d 2026-10)
  FOREACH v_date IN ARRAY v_dates
  LOOP
    -- A. Stok Masuk (Pembelian 1 pack @ Rp 30.000)
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
        v_outlet_id, v_barang_id, 'IN', 1, 30000, 30000,
        'INVENTARIS_AUTO', 'Pembelian 1 pack kertas HVS A4 (Restock #' || v_idx || ')', v_date
      ) RETURNING id INTO v_sm_in_id;
    END IF;

    -- B. Stok Keluar (Pemakaian habis untuk siklus 1 s/d 10)
    -- Siklus #11 (2026-10-02) saat ini sedang aktif digunakan di outlet (stok: 1 pack)
    IF v_idx < 11 THEN
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
          v_outlet_id, v_barang_id, 'OUT', 1, 30000, 30000,
          'INVENTARIS_AUTO', 'Pemakaian operasional cetak kertas A4 (Siklus #' || v_idx || ')', v_date
        ) RETURNING id INTO v_sm_out_id;
      END IF;
    END IF;

    -- C. Transaksi Keuangan (Beban 5100 dengan sumber INVENTARIS sesuai Metode A)
    IF NOT EXISTS (
      SELECT 1 FROM transaksi_keuangan
      WHERE outlet_id = v_outlet_id
        AND tanggal = v_date
        AND kategori_id = v_kat_5100_id
        AND nominal = 30000
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
        30000,
        'CASH',
        'Pembelian 1 pack kertas HVS A4 (Restock #' || v_idx || ')',
        'INVENTARIS',
        v_sm_in_id
      );
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  -- 7. Daftarkan Template Recurring Transaksi (Setiap 3 Bulan, Nominal Rp 30.000, Metode CASH)
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
      'Pembelian Kertas HVS A4 (Restock)',
      30000,
      'CASH',
      2,
      3,
      v_barang_id,
      'KELUAR',
      true,
      '2026-10-02'
    );
  END IF;

END $$;
