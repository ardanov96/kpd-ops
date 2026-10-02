-- ============================================================
-- 026_fix_income_franchise_commission.sql
-- Fix Accounting Module:
-- Mengubah perhitungan akun 4100 Pendapatan Ekspedisi di fn_aggregate_income
-- agar murni mencatat KOMISI HAK MITRA (Diskon Booking POS + Diskon Asuransi + Diskon Forward + Diskon Pickup),
-- bukan Total Biaya Kirim dikurangi komisi (yang sebenarnya merupakan porsi setoran ke kantor pusat ekspedisi).
--
-- Sekaligus melakukan re-aggregate otomatis untuk seluruh periode transaksi yang ada di database.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_aggregate_income(p_outlet_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_kategori_income uuid;
  v_total numeric;
  v_locked boolean;
BEGIN
  -- Lock check: tolak aggregate ulang jika period sudah di-closing
  SELECT is_locked INTO v_locked
  FROM periode_closing
  WHERE outlet_id = p_outlet_id AND periode = p_periode;
  IF v_locked IS TRUE THEN
    RAISE EXCEPTION 'Periode % sudah di-closing dan tdk bisa di-aggregate ulang. Buka periode (closing=false) terlebih dahulu jika perlu update data.', p_periode;
  END IF;

  -- Ambil kategori Pendapatan Ekspedisi (kode 4100)
  SELECT id INTO v_kategori_income FROM kategori_akun WHERE kode = '4100' LIMIT 1;
  IF v_kategori_income IS NULL THEN RETURN; END IF;

  -- Hitung total komisi franchise / hak mitra riil
  -- (Diskon Booking POS + Diskon Asuransi POS + Diskon Forward Rate + Diskon Pickup POS)
  SELECT COALESCE(SUM(
    COALESCE(diskon_booking, 0)
    + COALESCE(diskon_asuransi, 0)
    + COALESCE(diskon_forward_rate, 0)
    + COALESCE(diskon_pickup, 0)
  ), 0)
  INTO v_total
  FROM transaksi
  WHERE outlet_id = p_outlet_id
    AND to_char(tanggal, 'YYYY-MM') = p_periode
    AND status NOT IN ('CNX');

  IF v_total IS NULL OR v_total <= 0 THEN
    DELETE FROM transaksi_keuangan
    WHERE outlet_id = p_outlet_id
      AND tipe = 'MASUK'
      AND sumber = 'KURIR'
      AND to_char(tanggal, 'YYYY-MM') = p_periode;
    RETURN;
  END IF;

  -- UPSERT income komisi franchise ke transaksi_keuangan
  INSERT INTO transaksi_keuangan (
    outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
  ) VALUES (
    p_outlet_id,
    (p_periode || '-01')::date,
    'MASUK',
    v_kategori_income,
    'KURIR',
    NULL,
    v_total,
    'BANK',
    'Auto-income komisi franchise dari import XLSX, periode ' || p_periode
  )
  ON CONFLICT (outlet_id, tanggal) WHERE sumber = 'KURIR' AND tipe = 'MASUK'
  DO UPDATE SET
    nominal = excluded.nominal,
    keterangan = excluded.keterangan;

  -- Penalty Lion Parcel (probation mulai April 2024)
  PERFORM fn_aggregate_lion_penalty(p_outlet_id, p_periode);
END;
$$ LANGUAGE plpgsql;

-- Otomatis re-aggregate seluruh periode transaksi yang ada di database
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT DISTINCT outlet_id, to_char(tanggal, 'YYYY-MM') as periode
    FROM transaksi
    WHERE status NOT IN ('CNX')
    ORDER BY periode ASC
  ) LOOP
    PERFORM fn_aggregate_income(rec.outlet_id, rec.periode);
  END LOOP;
END $$;
