-- ============================================================
-- 053_fix_laba_rugi_and_closing_equity_filter.sql
-- Memperbaiki v_laba_rugi dan fn_closing_periode agar HANYA
-- menghitung akun kategori bertipe 'INCOME' dan 'EXPENSE'.
--
-- Masalah sebelumnya:
-- Transaksi dengan tipe 'MASUK' dan kategori '3100 Modal Pemilik' (EQUITY)
-- sempat dihitung sebagai income/omzet usaha pada 2023-09.
-- Akibatnya:
-- 1. Modal setoran terhitung sebagai pendapatan usaha.
-- 2. fn_generate_pph_final_rekap otomatis menerbitkan tagihan PPh Final 0,5%
--    atas setoran modal pemilik (Rp 15.000).
-- 3. Di neraca (v_neraca), ekuitas modal terhitung ganda (di modal pemilik
--    dan di laba ditahan), menyebabkan selisih neraca Rp 3.000.000.
-- ============================================================

-- 1. Update v_laba_rugi
CREATE OR REPLACE VIEW v_laba_rugi AS
SELECT
  tk.outlet_id,
  to_char(tk.tanggal, 'YYYY-MM') AS periode,
  SUM(CASE WHEN ka.tipe = 'INCOME' THEN tk.nominal ELSE 0 END) AS total_income,
  SUM(CASE WHEN ka.tipe = 'EXPENSE' THEN tk.nominal ELSE 0 END) AS total_expense,
  SUM(CASE WHEN ka.tipe = 'INCOME' THEN tk.nominal
           WHEN ka.tipe = 'EXPENSE' THEN -tk.nominal
           ELSE 0 END) AS laba_kotor
FROM transaksi_keuangan tk
JOIN kategori_akun ka ON ka.id = tk.kategori_id
GROUP BY tk.outlet_id, to_char(tk.tanggal, 'YYYY-MM');

-- 2. Update fn_closing_periode
CREATE OR REPLACE FUNCTION fn_closing_periode(p_outlet_id uuid, p_periode text, p_closed_by uuid)
RETURNS void AS $$
DECLARE
  v_income numeric;
  v_expense numeric;
  v_laba numeric;
BEGIN
  -- Hitung agregat dari transaksi_keuangan (Hanya akun nominal: INCOME & EXPENSE)
  SELECT
    COALESCE(SUM(CASE WHEN ka.tipe = 'INCOME' THEN tk.nominal ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ka.tipe = 'EXPENSE' THEN tk.nominal ELSE 0 END), 0)
  INTO v_income, v_expense
  FROM transaksi_keuangan tk
  JOIN kategori_akun ka ON ka.id = tk.kategori_id
  WHERE tk.outlet_id = p_outlet_id
    AND to_char(tk.tanggal, 'YYYY-MM') = p_periode;

  v_laba := v_income - v_expense;

  -- Idempotent upsert ke periode_closing
  INSERT INTO periode_closing (
    outlet_id, periode, total_income, total_expense, laba, is_locked, closed_at, closed_by
  ) VALUES (
    p_outlet_id, p_periode, v_income, v_expense, v_laba, true, now(), p_closed_by
  )
  ON CONFLICT (outlet_id, periode) DO UPDATE
    SET total_income = excluded.total_income,
        total_expense = excluded.total_expense,
        laba = excluded.laba,
        is_locked = true,
        closed_at = now(),
        closed_by = excluded.closed_by;

  -- AUTO-GENERATE PPh Final 0,5% (idempotent, skip jika total_income = 0)
  PERFORM fn_generate_pph_final_rekap(p_outlet_id, p_periode);
END;
$$ LANGUAGE plpgsql;
