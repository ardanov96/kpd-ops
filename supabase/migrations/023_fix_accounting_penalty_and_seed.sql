-- ============================================================
-- 023_fix_accounting_penalty_and_seed.sql
-- Fix Accounting Module:
-- 1. Seed kategori_akun default Chart of Accounts (COA)
-- 2. Drop idx_unique_kurir_income & split into MASUK and KELUAR partial indexes
-- 3. Fix fn_aggregate_lion_penalty (use total_biaya & kurir_id filter instead of non-existent discount columns)
-- ============================================================

-- ─── 1. Seed Chart of Accounts (kategori_akun) ────────────────
INSERT INTO kategori_akun (kode, nama, tipe, is_system, urutan) VALUES
  -- Income (2)
  ('4100', 'Pendapatan Ekspedisi',                  'INCOME',   true,  1),
  ('4900', 'Pendapatan Lain-lain',                  'INCOME',   true,  2),
  -- Expense (9)
  ('5100', 'Beban ATK & Packaging',                 'EXPENSE',  true, 10),
  ('5150', 'Beban Operasional Harian',              'EXPENSE',  true, 11),
  ('5200', 'Beban Internet (WiFi)',                 'EXPENSE',  true, 20),
  ('5210', 'Beban Pulsa & Data Staff',              'EXPENSE',  true, 21),
  ('5300', 'Beban Listrik',                         'EXPENSE',  true, 30),
  ('5400', 'Beban Perlengkapan Kantor',             'EXPENSE',  true, 40),
  ('5500', 'Beban Sewa',                            'EXPENSE',  true, 50),
  ('5600', 'Beban Transportasi & Bensin',           'EXPENSE',  true, 60),
  ('5700', 'Beban Maintenance',                     'EXPENSE',  true, 70),
  ('5900', 'Beban Lain-lain',                       'EXPENSE',  true, 99),
  -- Equity (3)
  ('3100', 'Modal Pemilik',                         'EQUITY',   true,  1),
  ('3200', 'Prive',                                 'EQUITY',   true,  2),
  ('3900', 'Laba Ditahan',                          'EQUITY',   true, 99)
ON CONFLICT (kode) DO UPDATE SET
  nama = EXCLUDED.nama,
  tipe = EXCLUDED.tipe,
  is_system = EXCLUDED.is_system,
  urutan = EXCLUDED.urutan;

-- ─── 2. Fix Unique Partial Indexes on transaksi_keuangan ───────
-- Drop index lama yg cuma filter WHERE sumber='KURIR' tanpa membedakan MASUK/KELUAR,
-- yang menyebabkan collision saat ada Income (MASUK) dan Penalty (KELUAR) di tgl yg sama (tgl 1).
DROP INDEX IF EXISTS idx_unique_kurir_income;

-- Index unik untuk KURIR Income (MASUK)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_kurir_income_masuk
  ON transaksi_keuangan (outlet_id, tanggal)
  WHERE sumber = 'KURIR' AND tipe = 'MASUK';

-- Index unik untuk KURIR Penalty (KELUAR)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_kurir_penalty_keluar
  ON transaksi_keuangan (outlet_id, tanggal)
  WHERE sumber = 'KURIR' AND tipe = 'KELUAR';

-- Pastikan juga JNE Income unik per outlet + tanggal
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_jne_income_masuk
  ON transaksi_keuangan (outlet_id, tanggal)
  WHERE sumber = 'JNE' AND tipe = 'MASUK';

-- ─── 3. Fix fn_aggregate_lion_penalty ─────────────────────────
-- Bug di migration 021: fn_aggregate_lion_penalty mengeksekusi
-- SELECT SUM(discount + disc_others) FROM transaksi, padahal
-- kolom discount & disc_others milik jne_packing_list, bukan transaksi!
-- Pada transaksi, kolom yg tepat adalah total_biaya dengan kurir_id LION.
CREATE OR REPLACE FUNCTION fn_aggregate_lion_penalty(p_outlet_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_kategori_expense uuid;
  v_lion_kurir_id uuid;
  v_lion_omzet numeric;
  v_probation_start text := '2024-04';
  v_should_penalty boolean;
  v_locked boolean;
BEGIN
  -- Lock check
  SELECT is_locked INTO v_locked
  FROM periode_closing
  WHERE outlet_id = p_outlet_id AND periode = p_periode;
  IF v_locked IS TRUE THEN
    RAISE EXCEPTION 'Periode % sudah di-closing dan tdk bisa di-aggregate ulang.', p_periode;
  END IF;

  SELECT id INTO v_kategori_expense FROM kategori_akun WHERE kode = '5900' LIMIT 1;
  SELECT id INTO v_lion_kurir_id FROM kurir WHERE kode = 'LION' LIMIT 1;
  IF v_kategori_expense IS NULL OR v_lion_kurir_id IS NULL THEN RETURN; END IF;

  -- Hitung Lion omzet bruto (total_biaya) untuk bulan ini
  SELECT COALESCE(SUM(COALESCE(total_biaya, 0)), 0)
  INTO v_lion_omzet
  FROM transaksi
  WHERE outlet_id = p_outlet_id
    AND kurir_id = v_lion_kurir_id
    AND to_char(tanggal, 'YYYY-MM') = p_periode
    AND status NOT IN ('CNX');

  -- Syarat penalty: setelah masa probation (>= April 2024), ada transaksi (>0) tapi omzet < 3 juta
  v_should_penalty := p_periode >= v_probation_start
    AND v_lion_omzet > 0
    AND v_lion_omzet < 3000000;

  IF v_should_penalty THEN
    INSERT INTO transaksi_keuangan (
      outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
    ) VALUES (
      p_outlet_id,
      (p_periode || '-01')::date,
      'KELUAR',
      v_kategori_expense,
      'KURIR',
      NULL,
      500000,
      'BANK',
      'Auto-penalty Lion Parcel (Omzet < 3 Juta), periode ' || p_periode
    )
    ON CONFLICT (outlet_id, tanggal) WHERE sumber = 'KURIR' AND tipe = 'KELUAR'
    DO UPDATE SET
      nominal = excluded.nominal,
      keterangan = excluded.keterangan;
  ELSE
    -- Hapus penalty jika ada: covers omzet >= 3jt atau periode sebelum April 2024
    DELETE FROM transaksi_keuangan
    WHERE outlet_id = p_outlet_id
      AND tipe = 'KELUAR'
      AND sumber = 'KURIR'
      AND to_char(tanggal, 'YYYY-MM') = p_periode;
  END IF;
END;
$$ LANGUAGE plpgsql;
