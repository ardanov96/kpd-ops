-- ============================================================
-- 054_update_tax_entity_split.sql
-- Penyesuaian aturan PPh Final berdasarkan entitas kontrak keagenan:
-- 1. Keagenan Lion Parcel (sumber = 'KURIR'):
--    Kontrak atas nama Pribadi (WPOP). Berdasarkan UU HPP No. 7/2021
--    & PP 55/2022 Pasal 60, omzet tahunan di bawah Rp 500.000.000
--    BEBAS PPh Final (Tarif 0%, Nilai Pajak Rp 0, status 'BEAS').
-- 2. Keagenan JNE (sumber = 'JNE'):
--    Kontrak menggunakan NIB PT Perorangan (Wajib Pajak Badan).
--    Dikenakan PPh Final 0,5% dari omzet komisi franchise JNE
--    sejak rupiah pertama (mulai aktif September 2025).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_generate_pph_final_rekap(p_outlet_id uuid, p_periode text)
RETURNS TABLE (
  id uuid,
  dasar_pengenaan numeric,
  nilai_pajak numeric,
  status text
) AS $$
DECLARE
  v_jne_income numeric;
  v_lion_income numeric;
  v_dasar numeric;
  v_tarif_persen numeric := 0.5;
  v_tarif_desimal numeric := 0.005;
  v_nilai numeric;
  v_id uuid;
  v_status text;
  v_catatan text;
BEGIN
  -- Ambil income komisi JNE (PT Perorangan)
  SELECT COALESCE(SUM(nominal), 0) INTO v_jne_income
  FROM transaksi_keuangan
  WHERE outlet_id = p_outlet_id
    AND to_char(tanggal, 'YYYY-MM') = p_periode
    AND tipe = 'MASUK'
    AND sumber = 'JNE';

  -- Ambil income Lion Parcel (Pribadi)
  SELECT COALESCE(SUM(nominal), 0) INTO v_lion_income
  FROM transaksi_keuangan
  WHERE outlet_id = p_outlet_id
    AND to_char(tanggal, 'YYYY-MM') = p_periode
    AND tipe = 'MASUK'
    AND sumber = 'KURIR';

  -- Jika ada JNE, maka dasar pengenaan PPh Final PT Perorangan adalah JNE
  IF v_jne_income > 0 THEN
    v_dasar := v_jne_income;
    v_nilai := ROUND(v_dasar * v_tarif_desimal, 2);
    v_status := 'BELUM';
    v_catatan := 'PPh Final 0,5% PT Perorangan (Keagenan JNE)';
  ELSIF v_lion_income > 0 THEN
    -- Hanya ada Lion Parcel (Pribadi): Bebas fasilitas PP 55 (omzet < 500jt)
    v_dasar := v_lion_income;
    v_nilai := 0;
    v_status := 'BEAS';
    v_catatan := 'Fasilitas WPOP PP 55/2022 (Omzet < 500 Juta Bebas PPh Final)';
  ELSE
    -- Tidak ada income
    RETURN QUERY SELECT NULL::uuid, 0::numeric, 0::numeric, 'SKIP_NO_INCOME'::text;
    RETURN;
  END IF;

  -- Upsert ke pajak_rekap
  INSERT INTO pajak_rekap (
    outlet_id, periode, jenis_pajak, dasar_pengenaan, tarif, nilai_pajak, status_bayar, catatan
  ) VALUES (
    p_outlet_id, p_periode, 'PPH_FINAL_05', v_dasar,
    CASE WHEN v_status = 'BEAS' THEN 0 ELSE v_tarif_persen END,
    v_nilai, v_status, v_catatan
  )
  ON CONFLICT (outlet_id, periode, jenis_pajak) DO UPDATE
    SET dasar_pengenaan = excluded.dasar_pengenaan,
        tarif = excluded.tarif,
        nilai_pajak = excluded.nilai_pajak,
        catatan = excluded.catatan,
        status_bayar = CASE
          WHEN pajak_rekap.status_bayar = 'LUNAS' THEN 'LUNAS'
          ELSE excluded.status_bayar
        END
  RETURNING pajak_rekap.id INTO v_id;

  RETURN QUERY
    SELECT v_id, v_dasar, v_nilai, 'OK'::text;
END;
$$ LANGUAGE plpgsql;
