-- ============================================================
-- 020_jne_drop_periode_column.sql
-- Fix BUG JNE-8: kolom `periode` di jne_packing_list inkonsisten
-- dgn `tanggal`. Parser menyimpan periode = end date of range,
-- padahal page filter query by tanggal. Untuk cross-month PDF
-- (mis. "15-SEP s/d 14-OCT"), row dgn tanggal September disimpan
-- dgn periode Oktober → hilang saat filter Oktober.
--
-- Fix: drop kolom periode, derive semuanya dari tanggal via
-- to_char(tanggal, 'YYYY-MM'). Konsisten antara upload, query,
-- summary, dan pagination.
-- ============================================================

-- 1. Drop index pada kolom periode
DROP INDEX IF EXISTS idx_jne_pl_periode;

-- 2. Drop kolom periode (aman — backfill ke tanggal sudah inherent)
ALTER TABLE jne_packing_list DROP COLUMN IF EXISTS periode;

-- 3. Update fn_aggregate_income_jne — pakai to_char(tanggal, 'YYYY-MM')
CREATE OR REPLACE FUNCTION fn_aggregate_income_jne(p_outlet_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_kategori_income uuid;
  v_jne_kurir_id uuid;
  v_total numeric;
BEGIN
  SELECT id INTO v_kategori_income FROM kategori_akun WHERE kode = '4100' LIMIT 1;
  IF v_kategori_income IS NULL THEN RETURN; END IF;

  SELECT id INTO v_jne_kurir_id FROM kurir WHERE kode = 'JNE' LIMIT 1;
  IF v_jne_kurir_id IS NULL THEN RETURN; END IF;

  -- Hitung total komisi franchise = discount + disc_others
  -- Filter by tanggal YYYY-MM (derived, bukan kolom terpisah)
  SELECT COALESCE(SUM(discount + COALESCE(disc_others, 0)), 0)
  INTO v_total
  FROM jne_packing_list
  WHERE outlet_id = p_outlet_id
    AND kurir_id = v_jne_kurir_id
    AND to_char(tanggal, 'YYYY-MM') = p_periode;

  IF v_total IS NULL OR v_total <= 0 THEN
    DELETE FROM transaksi_keuangan
    WHERE outlet_id = p_outlet_id
      AND tipe = 'MASUK'
      AND sumber = 'JNE'
      AND to_char(tanggal, 'YYYY-MM') = p_periode;
    RETURN;
  END IF;

  INSERT INTO transaksi_keuangan (
    outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
  ) VALUES (
    p_outlet_id,
    (p_periode || '-01')::date,
    'MASUK',
    v_kategori_income,
    'JNE',
    NULL,
    v_total,
    'BANK',
    'Auto-income JNE Packing List PDF, periode ' || p_periode
  )
  ON CONFLICT (outlet_id, tanggal) WHERE sumber = 'JNE' AND tipe = 'MASUK'
  DO UPDATE SET
    nominal = excluded.nominal,
    keterangan = excluded.keterangan;
END;
$$ LANGUAGE plpgsql;

-- 4. Update v_summary_bulanan — replace j.periode dengan to_char(tanggal, 'YYYY-MM')
CREATE OR REPLACE VIEW v_summary_bulanan AS
-- ── Branch 1: Lion Parcel (dan kurir lain dgn table transaksi)
SELECT
  o.nama as outlet,
  k.nama as kurir,
  k.warna as kurir_warna,
  to_char(t.tanggal, 'YYYY-MM') as periode,
  count(*) as total_paket,
  sum(t.koli) as total_koli,
  sum(t.total_biaya) as total_omzet,
  sum(t.diskon_booking) as total_diskon,
  CASE
    WHEN to_char(t.tanggal, 'YYYY-MM') >= '2024-04'
         AND k.kode = 'LION'
         AND sum(t.total_biaya) < 3000000 THEN 500000
    ELSE 0
  END as penalty,
  sum(t.total_biaya - t.diskon_booking) -
  (CASE
    WHEN to_char(t.tanggal, 'YYYY-MM') >= '2024-04'
         AND k.kode = 'LION'
         AND sum(t.total_biaya) < 3000000 THEN 500000
    ELSE 0
  END) as net_omzet,
  sum(case when t.status = 'POD' then 1 else 0 end) as pod_count,
  sum(case when t.status = 'CNX' then 1 else 0 end) as cnx_count,
  ROUND(
    sum(case when t.status = 'POD' then 1 else 0 end)::numeric
    / nullif(count(*), 0) * 100, 1
  ) as pod_rate
FROM transaksi t
JOIN outlets o ON o.id = t.outlet_id
JOIN kurir k ON k.id = t.kurir_id
GROUP BY o.nama, k.nama, k.kode, k.warna, to_char(t.tanggal, 'YYYY-MM')
UNION ALL
-- ── Branch 2: JNE (dari table jne_packing_list)
SELECT
  o.nama as outlet,
  k.nama as kurir,
  k.warna as kurir_warna,
  to_char(j.tanggal, 'YYYY-MM') as periode,
  sum(j.cnote_count) as total_paket,
  sum(j.coly) as total_koli,
  sum(j.amount) as total_omzet,
  sum(j.discount + coalesce(j.disc_others, 0)) as total_diskon,
  0::numeric as penalty,
  sum(j.total_net) as net_omzet,
  0::int as pod_count,
  0::int as cnx_count,
  0::numeric as pod_rate
FROM jne_packing_list j
JOIN outlets o ON o.id = j.outlet_id
JOIN kurir k ON k.id = j.kurir_id
GROUP BY o.nama, k.nama, k.kode, k.warna, to_char(j.tanggal, 'YYYY-MM');
