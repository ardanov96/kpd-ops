-- ============================================================
-- 047_add_uang_makan_recurring_expense.sql
-- Pencatatan recurring uang makan staf operasional senilai Rp 100.000 per bulan
-- Berlaku sejak 1 Januari 2025 hingga sekarang (Oktober 2026) [22 bulan].
-- Tahun kebelakang (2023 & 2024) sengaja tidak dianggarkan/kosong.
-- Kategori: 5150 (Beban Operasional Harian)
-- Metode Pembayaran: CASH
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
  v_rec_id UUID;
  d DATE;
BEGIN
  -- 1. Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id 
  FROM outlets 
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- 2. Ambil kategori akun 5150 (Beban Operasional Harian)
  SELECT id INTO v_kat_id 
  FROM kategori_akun 
  WHERE kode = '5150' 
  LIMIT 1;

  -- 3. Pastikan template recurring terdaftar di recurring_transactions
  SELECT id INTO v_rec_id
  FROM recurring_transactions
  WHERE outlet_id = v_outlet_id
    AND nama_template ILIKE '%uang makan%'
  LIMIT 1;

  IF v_rec_id IS NULL THEN
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
      v_kat_id,
      'Uang Makan Staf Operasional',
      100000,
      'CASH',
      1,
      1,
      NULL,
      'KELUAR',
      true,
      '2026-10-01'
    ) RETURNING id INTO v_rec_id;
  ELSE
    UPDATE recurring_transactions
    SET nominal = 100000,
        metode = 'CASH',
        kategori_id = v_kat_id,
        tanggal_setiap_bulan = 1,
        interval_bulan = 1,
        aktif = true,
        last_run = '2026-10-01'
    WHERE id = v_rec_id;
  END IF;

  -- 4. Generate transaksi keuangan bulanan dari 2025-01-01 s/d 2026-10-01
  FOR d IN
    SELECT generate_series('2025-01-01'::date, '2026-10-01'::date, '1 month'::interval)::date
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM transaksi_keuangan
      WHERE outlet_id = v_outlet_id
        AND tanggal = d
        AND kategori_id = v_kat_id
        AND nominal = 100000
        AND keterangan ILIKE '%uang makan%'
    ) THEN
      INSERT INTO transaksi_keuangan (
        outlet_id,
        tanggal,
        tipe,
        kategori_id,
        sumber,
        ref_id,
        nominal,
        metode,
        keterangan
      ) VALUES (
        v_outlet_id,
        d,
        'KELUAR',
        v_kat_id,
        'RECURRING',
        v_rec_id,
        100000,
        'CASH',
        'Uang Makan Staf Operasional (periode ' || to_char(d, 'YYYY-MM') || ')'
      );
    END IF;
  END LOOP;

END $$;
