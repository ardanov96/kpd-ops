-- ============================================================
-- 019_jne_akunting_integration.sql
-- Integrasi data JNE Packing List ke summary lintas franchise
-- sehingga Laba-Rugi, Dashboard, Analitik, Harian semuanya
-- include JNE (sebelumnya JNE terisolasi di tabel sendiri).
--
-- Skema perubahan:
-- 1. jne_packing_list: tambah outlet_id (multi-outlet support)
-- 2. transaksi_keuangan: tambah 'JNE' ke sumber constraint
-- 3. fn_aggregate_income_jne(): mirror fn_aggregate_income
-- 4. v_summary_bulanan: UNION Lion + JNE rows
-- 5. v_summary_harian: UNION Lion + JNE rows
-- 6. v_laba_rugi: include JNE income rows
-- ============================================================

-- ─── 1. JNE table: tambah outlet_id ─────────────────────────────
ALTER TABLE jne_packing_list
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES outlets(id);

-- Backfill outlet_id existing rows ke outlet pertama
UPDATE jne_packing_list
SET outlet_id = (SELECT id FROM outlets ORDER BY created_at ASC LIMIT 1)
WHERE outlet_id IS NULL;

-- Set NOT NULL setelah backfill
ALTER TABLE jne_packing_list
  ALTER COLUMN outlet_id SET NOT NULL;

-- Recreate unique constraint agar include outlet_id (untuk multi-outlet)
ALTER TABLE jne_packing_list DROP CONSTRAINT IF EXISTS uq_jne_packing_list_kurir_pl;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_jne_packing_list_outlet_kurir_pl'
  ) THEN
    ALTER TABLE jne_packing_list
      ADD CONSTRAINT uq_jne_packing_list_outlet_kurir_pl
      UNIQUE (outlet_id, kurir_id, nomor_pl);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jne_pl_outlet_id ON jne_packing_list(outlet_id);

-- ─── 2. transaksi_keuangan: tambah 'JNE' ke sumber constraint ──
ALTER TABLE transaksi_keuangan DROP CONSTRAINT IF EXISTS transaksi_keuangan_sumber_check;
ALTER TABLE transaksi_keuangan
  ADD CONSTRAINT transaksi_keuangan_sumber_check
  CHECK (sumber IN ('MANUAL','INVENTARIS','KURIR','RECURRING','CLOSING','PRIVE','JNE'));

-- ─── 3. Unique index untuk JNE income (sumber=JNE + tipe=MASUK)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_jne_income_masuk
  ON transaksi_keuangan (outlet_id, tanggal)
  WHERE sumber = 'JNE' AND tipe = 'MASUK';

-- ─── 4. fn_aggregate_income_jne ────────────────────────────────
-- Mirror fn_aggregate_income tapi baca dari jne_packing_list.
-- Net income = discount + disc_others (= komisi franchise, sama dgn Lion).
CREATE OR REPLACE FUNCTION fn_aggregate_income_jne(p_outlet_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_kategori_income uuid;
  v_jne_kurir_id uuid;
  v_total numeric;
BEGIN
  -- Ambil kategori Pendapatan Ekspedisi (kode 4100)
  SELECT id INTO v_kategori_income FROM kategori_akun WHERE kode = '4100' LIMIT 1;
  IF v_kategori_income IS NULL THEN RETURN; END IF;

  -- Cari kurir_id JNE
  SELECT id INTO v_jne_kurir_id FROM kurir WHERE kode = 'JNE' LIMIT 1;
  IF v_jne_kurir_id IS NULL THEN RETURN; END IF;

  -- Hitung total komisi franchise = discount + disc_others
  SELECT COALESCE(SUM(discount + COALESCE(disc_others, 0)), 0)
  INTO v_total
  FROM jne_packing_list
  WHERE outlet_id = p_outlet_id
    AND kurir_id = v_jne_kurir_id
    AND periode = p_periode;

  IF v_total IS NULL OR v_total <= 0 THEN
    -- Hapus income row existing (idempotent)
    DELETE FROM transaksi_keuangan
    WHERE outlet_id = p_outlet_id
      AND tipe = 'MASUK'
      AND sumber = 'JNE'
      AND to_char(tanggal, 'YYYY-MM') = p_periode;
    RETURN;
  END IF;

  -- UPSERT income row
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

-- ─── 5. v_summary_bulanan: include JNE via UNION ───────────────
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
  j.periode,
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
GROUP BY o.nama, k.nama, k.kode, k.warna, j.periode;

-- ─── 6. v_summary_harian: include JNE via UNION ─────────────────
CREATE OR REPLACE VIEW v_summary_harian AS
-- ── Branch 1: Lion Parcel (dan kurir lain dgn table transaksi)
SELECT
  o.nama as outlet,
  k.kode as kurir_kode,
  k.nama as kurir_nama,
  k.warna as kurir_warna,
  t.tanggal,
  count(*) as total_paket,
  sum(coalesce(t.koli, 0)) as total_koli,
  sum(coalesce(t.total_biaya, 0)) as total_omzet,
  sum(
    coalesce(t.diskon_booking, 0) +
    coalesce(t.diskon_asuransi, 0) +
    coalesce(t.diskon_forward_rate, 0) +
    coalesce(t.diskon_pickup, 0)
  ) as total_diskon,
  sum(
    coalesce(t.total_biaya, 0)
    - coalesce(t.diskon_booking, 0)
    - coalesce(t.diskon_asuransi, 0)
    - coalesce(t.diskon_forward_rate, 0)
    - coalesce(t.diskon_pickup, 0)
  ) as net_omzet,
  sum(case when t.status = 'POD' then 1 else 0 end) as pod_count,
  sum(case when t.status = 'CNX' then 1 else 0 end) as cnx_count,
  sum(case when t.jenis_kiriman = 'COD' then 1 else 0 end) as cod_count,
  sum(case when coalesce(t.jenis_kiriman, 'NON-COD') = 'NON-COD' then 1 else 0 end) as noncod_count
FROM transaksi t
JOIN outlets o ON o.id = t.outlet_id
JOIN kurir k ON k.id = t.kurir_id
GROUP BY o.nama, k.kode, k.nama, k.warna, t.tanggal
UNION ALL
-- ── Branch 2: JNE
SELECT
  o.nama as outlet,
  k.kode as kurir_kode,
  k.nama as kurir_nama,
  k.warna as kurir_warna,
  j.tanggal,
  sum(coalesce(j.cnote_count, 0)) as total_paket,
  sum(coalesce(j.coly, 0)) as total_koli,
  sum(coalesce(j.amount, 0)) as total_omzet,
  sum(coalesce(j.discount, 0) + coalesce(j.disc_others, 0)) as total_diskon,
  sum(coalesce(j.total_net, 0)) as net_omzet,
  0::int as pod_count,
  0::int as cnx_count,
  0::int as cod_count,
  0::int as noncod_count
FROM jne_packing_list j
JOIN outlets o ON o.id = j.outlet_id
JOIN kurir k ON k.id = j.kurir_id
GROUP BY o.nama, k.kode, k.nama, k.warna, j.tanggal;

-- ─── 7. v_laba_rugi: otomatis include JNE karena baca dari transaksi_keuangan
-- (Tidak perlu diubah — fn_aggregate_income_jne akan insert ke transaksi_keuangan)
-- Setelah JNE income ter-aggregate, v_laba_rugi otomatis reflect JNE income.
