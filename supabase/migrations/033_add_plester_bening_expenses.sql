-- ============================================================
-- 033_add_plester_bening_expenses.sql
-- Rekap pengeluaran operasional & recurring: Pembelian 1 Dus Plester Bening (@ Rp 253.000)
-- Pola pemakaian habis setiap 4 bulan sekali sejak awal berdiri outlet (Nov 2023 - Jul 2026)
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
    '2023-11-25'::DATE,
    '2024-03-25'::DATE,
    '2024-07-25'::DATE,
    '2024-11-25'::DATE,
    '2025-03-25'::DATE,
    '2025-07-25'::DATE,
    '2025-11-25'::DATE,
    '2026-03-25'::DATE,
    '2026-07-27'::DATE
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

  -- 4. Pastikan Master Barang Plester Bening terdaftar di tabel barang
  SELECT id INTO v_barang_id 
  FROM barang 
  WHERE outlet_id = v_outlet_id AND (nama = 'Plester Bening 1 Dus' OR nama ILIKE '%plester bening%')
  LIMIT 1;

  IF v_barang_id IS NULL THEN
    INSERT INTO barang (
      outlet_id, kategori_id, nama, satuan, harga_beli, stok_min, aktif
    ) VALUES (
      v_outlet_id, v_pkg_kat_id, 'Plester Bening 1 Dus', 'dus', 253000, 1, true
    ) RETURNING id INTO v_barang_id;
  END IF;

  -- 5. Catat pergerakan stok dan transaksi keuangan untuk setiap periode historis
  FOREACH v_date IN ARRAY v_dates
  LOOP
    -- A. Stok Masuk (Pembelian 1 dus)
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
        v_outlet_id, v_barang_id, 'IN', 1, 253000, 253000,
        'INVENTARIS_AUTO', 'Pembelian 1 dus plester bening packaging (Dus #' || v_idx || ')', v_date
      ) RETURNING id INTO v_sm_in_id;
    END IF;

    -- B. Stok Keluar (Pemakaian habis paket - Dus #1 s/d Dus #8 sudah habis terpakai)
    -- Dus #9 (2026-07-27) saat ini sedang aktif dipakai dan akan di-zero otomatis oleh fn_run_recurring pada Nov 2026
    IF v_idx < 9 THEN
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
          v_outlet_id, v_barang_id, 'OUT', 1, 253000, 253000,
          'INVENTARIS_AUTO', 'Pemakaian operasional packing paket (Dus #' || v_idx || ')', v_date
        ) RETURNING id INTO v_sm_out_id;
      END IF;
    END IF;

    -- C. Transaksi Keuangan (Beban 5100 dengan sumber INVENTARIS sesuai Metode A)
    IF NOT EXISTS (
      SELECT 1 FROM transaksi_keuangan
      WHERE outlet_id = v_outlet_id
        AND tanggal = v_date
        AND kategori_id = v_kat_5100_id
        AND nominal = 253000
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
        253000,
        'CASH',
        'Pembelian 1 dus plester bening packaging (Dus #' || v_idx || ')',
        'INVENTARIS',
        v_sm_in_id
      );
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  -- 6. Daftarkan Template Recurring Transaksi (Setiap 4 Bulan, Nominal Rp 253.000, Metode CASH)
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
      'Pembelian 1 Dus Plester Bening (Restock)',
      253000,
      'CASH',
      27,
      4,
      v_barang_id,
      'KELUAR',
      true,
      '2026-07-27'
    );
  END IF;

END $$;
