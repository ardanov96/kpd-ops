-- ============================================================
-- 048_add_servis_motor_tahunan_recurring_expense.sql
-- Pencatatan beban & recurring: Servis Motor + Ganti Oli Rutin Tahunan
-- Frekuensi: 1 Tahun Sekali (12 Bulan) setiap tanggal 10 Januari
-- Nominal: Rp 60.000
-- Periode historis: 10 Januari 2024, 10 Januari 2025, 10 Januari 2026
-- Kategori: 5600 (Beban Transportasi & Bensin)
-- Metode: CASH (Kas Tunai Bengkel)
-- Sumber: RECURRING
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
  v_rec_id UUID;
  v_dates DATE[] := ARRAY[
    '2024-01-10'::DATE,
    '2025-01-10'::DATE,
    '2026-01-10'::DATE
  ];
  d DATE;
BEGIN
  -- 1. Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id 
  FROM outlets 
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- 2. Ambil kategori akun 5600 (Beban Transportasi & Bensin)
  SELECT id INTO v_kat_id 
  FROM kategori_akun 
  WHERE kode = '5600' 
  LIMIT 1;

  -- 3. Upsert / Daftarkan Template Recurring Transaksi (Tahunan - 12 Bulan)
  SELECT id INTO v_rec_id
  FROM recurring_transactions
  WHERE outlet_id = v_outlet_id 
    AND (nama_template ILIKE '%servis motor%' OR nama_template ILIKE '%ganti oli%')
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
      tipe,
      aktif,
      last_run
    ) VALUES (
      v_outlet_id,
      v_kat_id,
      'Biaya Servis Motor & Ganti Oli (Tahunan)',
      60000,
      'CASH',
      10,
      12,
      'KELUAR',
      true,
      '2026-01-10'
    ) RETURNING id INTO v_rec_id;
  ELSE
    UPDATE recurring_transactions
    SET kategori_id = v_kat_id,
        nominal = 60000,
        metode = 'CASH',
        tanggal_setiap_bulan = 10,
        interval_bulan = 12,
        aktif = true,
        last_run = '2026-01-10'
    WHERE id = v_rec_id;
  END IF;

  -- 4. Generate transaksi keuangan tahunan (2024-01-10, 2025-01-10, 2026-01-10)
  FOREACH d IN ARRAY v_dates
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM transaksi_keuangan
      WHERE outlet_id = v_outlet_id
        AND tanggal = d
        AND kategori_id = v_kat_id
        AND nominal = 60000
        AND (keterangan ILIKE '%servis motor%' OR keterangan ILIKE '%ganti oli%')
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
        60000,
        'CASH',
        'Servis Motor & Ganti Oli Rutin Tahunan (Tahun ' || extract(year from d) || ')'
      );
    END IF;
  END LOOP;

END $$;
