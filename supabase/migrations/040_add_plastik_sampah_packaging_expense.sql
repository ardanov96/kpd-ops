-- ============================================================
-- 040_add_plastik_sampah_packaging_expense.sql
-- Rekap pengeluaran & otomasi recurring: Plastik Sampah Ukuran Besar (@ Rp 10.000)
-- Digunakan untuk packing tambahan paket kiriman customer yang kurang proper.
-- Pola pemakaian habis setiap 1 tahun sekali (Januari 2024, Januari 2025, Januari 2026).
-- Terintegrasi ke Modul Inventaris (Metode A) & Akunting (Beban 5100).
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
    '2025-01-10'::DATE,
    '2026-01-10'::DATE
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

  -- 4. Pastikan Master Barang Plastik Sampah Packing terdaftar di tabel barang
  SELECT id INTO v_barang_id 
  FROM barang 
  WHERE outlet_id = v_outlet_id AND (nama ILIKE '%plastik sampah%' OR nama ILIKE '%trash bag%')
  LIMIT 1;

  IF v_barang_id IS NULL THEN
    INSERT INTO barang (
      outlet_id, kategori_id, nama, satuan, harga_beli, stok_min, aktif
    ) VALUES (
      v_outlet_id, v_pkg_kat_id, 'Plastik Sampah Besar Packing (1 Pack)', 'pack', 10000, 1, true
    ) RETURNING id INTO v_barang_id;
  END IF;

  -- 5. Catat pergerakan stok dan transaksi keuangan untuk setiap periode tahunan
  FOREACH v_date IN ARRAY v_dates
  LOOP
    -- A. Stok Masuk (Pembelian 1 pack)
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
        v_outlet_id, v_barang_id, 'IN', 1, 10000, 10000,
        'INVENTARIS_AUTO', 'Pembelian 1 pack plastik sampah besar packing (Tahun ' || extract(year from v_date) || ')', v_date
      ) RETURNING id INTO v_sm_in_id;
    END IF;

    -- B. Stok Keluar (Pemakaian habis untuk tahun 2024 dan 2025)
    -- Stok tahun 2026 (2026-01-10) saat ini sedang aktif digunakan di outlet (stok: 1 pack)
    IF v_idx < 3 THEN
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
          v_outlet_id, v_barang_id, 'OUT', 1, 10000, 10000,
          'INVENTARIS_AUTO', 'Pemakaian habis plastik sampah besar packing (Tahun ' || extract(year from v_date) || ')', v_date
        ) RETURNING id INTO v_sm_out_id;
      END IF;
    END IF;

    -- C. Transaksi Keuangan Beban 5100
    IF NOT EXISTS (
      SELECT 1 FROM transaksi_keuangan
      WHERE outlet_id = v_outlet_id
        AND tanggal = v_date
        AND kategori_id = v_kat_5100_id
        AND nominal = 10000
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
        10000,
        'CASH',
        'Pembelian 1 pack plastik sampah besar packing tambahan (Tahun ' || extract(year from v_date) || ')',
        'INVENTARIS',
        v_sm_in_id
      );
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  -- 6. Daftarkan Template Recurring Transaksi (Setiap 12 Bulan / 1 Tahun Sekali, Nominal Rp 10.000, Metode CASH)
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
      'Pembelian 1 Pack Plastik Sampah Besar Packing (Restock Tahunan)',
      10000,
      'CASH',
      10,
      12,
      v_barang_id,
      'KELUAR',
      true,
      '2026-01-10'
    );
  END IF;

END $$;
