-- ============================================================
-- 041_add_plastik_dokumen_recurring_expense.sql
-- Rekap pengeluaran & otomasi recurring: Plastik Dokumen Packing
-- Siklus 1 dibeli pada 28 Desember 2023 (100 pcs, Rp 199.200 via Tokopedia LILO Official Store).
-- Habis setiap 1 tahun sekali.
-- Siklus 2 (28 Des 2024) dan Siklus 3 (28 Des 2025) menggunakan nominal baru Rp 60.000.
-- Otomasi recurring diset tahunan (interval 12 bulan) setiap tanggal 28 Desember senilai Rp 60.000.
-- Terintegrasi ke Modul Inventaris (Metode A) & Akunting (Beban 5100).
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_pkg_kat_id UUID;
  v_kat_5100_id UUID;
  v_barang_id UUID;
  v_sm_in_id UUID;
  v_sm_out_id UUID;
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

  -- 4. Pastikan Master Barang Plastik Dokumen terdaftar di tabel barang
  SELECT id INTO v_barang_id 
  FROM barang 
  WHERE outlet_id = v_outlet_id AND (nama ILIKE '%plastik dokumen%' OR nama ILIKE '%plastik document%')
  LIMIT 1;

  IF v_barang_id IS NULL THEN
    INSERT INTO barang (
      outlet_id, kategori_id, nama, satuan, harga_beli, stok_min, aktif
    ) VALUES (
      v_outlet_id, v_pkg_kat_id, 'Plastik Dokumen Packing (1 Pack)', 'pack', 60000, 1, true
    ) RETURNING id INTO v_barang_id;
  END IF;

  -- 5. Hubungkan stok Siklus 1 (28 Desember 2023 - Rp 199.200) ke inventaris
  -- Stok Masuk Siklus 1
  IF NOT EXISTS (
    SELECT 1 FROM stok_movement 
    WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id AND tanggal = '2023-12-28' AND tipe = 'IN'
  ) THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'IN', 1, 199200, 199200,
      'INVENTARIS_AUTO', 'Pembelian 100 pcs plastik document A3 (Siklus 1 Awal Operasional)', '2023-12-28'
    );
  END IF;

  -- Stok Keluar Siklus 1 (habis sebelum Siklus 2 pada akhir 2024)
  IF NOT EXISTS (
    SELECT 1 FROM stok_movement 
    WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id AND tanggal = '2024-12-27' AND tipe = 'OUT'
  ) THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'OUT', 1, 199200, 199200,
      'INVENTARIS_AUTO', 'Pemakaian habis plastik dokumen Siklus 1 periode 2024', '2024-12-27'
    );
  END IF;

  -- 6. Siklus 2 (28 Desember 2024 - Rp 60.000)
  -- Stok Masuk Siklus 2
  SELECT id INTO v_sm_in_id
  FROM stok_movement
  WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id AND tanggal = '2024-12-28' AND tipe = 'IN'
  LIMIT 1;

  IF v_sm_in_id IS NULL THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'IN', 1, 60000, 60000,
      'INVENTARIS_AUTO', 'Pembelian 1 pack plastik dokumen packing (Siklus 2 Tahun 2024)', '2024-12-28'
    ) RETURNING id INTO v_sm_in_id;
  END IF;

  -- Stok Keluar Siklus 2 (habis sebelum Siklus 3 pada akhir 2025)
  IF NOT EXISTS (
    SELECT 1 FROM stok_movement 
    WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id AND tanggal = '2025-12-27' AND tipe = 'OUT'
  ) THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'OUT', 1, 60000, 60000,
      'INVENTARIS_AUTO', 'Pemakaian habis plastik dokumen Siklus 2 periode 2025', '2025-12-27'
    );
  END IF;

  -- Transaksi Keuangan Siklus 2
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id AND tanggal = '2024-12-28' AND nominal = 60000 AND kategori_id = v_kat_5100_id
  ) THEN
    INSERT INTO transaksi_keuangan (
      outlet_id, tanggal, tipe, kategori_id, nominal, metode, keterangan, sumber, ref_id
    ) VALUES (
      v_outlet_id, '2024-12-28', 'KELUAR', v_kat_5100_id, 60000, 'CASH',
      'Pembelian 1 pack plastik dokumen packing (Siklus 2)', 'INVENTARIS', v_sm_in_id
    );
  END IF;

  -- 7. Siklus 3 (28 Desember 2025 - Rp 60.000)
  -- Stok Masuk Siklus 3 (sedang aktif dipakai di outlet untuk tahun 2026)
  SELECT id INTO v_sm_in_id
  FROM stok_movement
  WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id AND tanggal = '2025-12-28' AND tipe = 'IN'
  LIMIT 1;

  IF v_sm_in_id IS NULL THEN
    INSERT INTO stok_movement (
      outlet_id, barang_id, tipe, qty, harga_satuan, total,
      ref_type, keterangan, tanggal
    ) VALUES (
      v_outlet_id, v_barang_id, 'IN', 1, 60000, 60000,
      'INVENTARIS_AUTO', 'Pembelian 1 pack plastik dokumen packing (Siklus 3 Tahun 2025/2026)', '2025-12-28'
    ) RETURNING id INTO v_sm_in_id;
  END IF;

  -- Transaksi Keuangan Siklus 3
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id AND tanggal = '2025-12-28' AND nominal = 60000 AND kategori_id = v_kat_5100_id
  ) THEN
    INSERT INTO transaksi_keuangan (
      outlet_id, tanggal, tipe, kategori_id, nominal, metode, keterangan, sumber, ref_id
    ) VALUES (
      v_outlet_id, '2025-12-28', 'KELUAR', v_kat_5100_id, 60000, 'CASH',
      'Pembelian 1 pack plastik dokumen packing (Siklus 3)', 'INVENTARIS', v_sm_in_id
    );
  END IF;

  -- 8. Daftarkan Template Recurring Transaksi (Setiap 12 Bulan / 1 Tahun Sekali, Nominal Rp 60.000, Metode CASH)
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
      'Pembelian Plastik Dokumen Packing (Restock Tahunan)',
      60000,
      'CASH',
      28,
      12,
      v_barang_id,
      'KELUAR',
      true,
      '2025-12-28'
    );
  END IF;

END $$;
