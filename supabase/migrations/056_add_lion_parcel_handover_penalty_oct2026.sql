-- ============================================================
-- 056_add_lion_parcel_handover_penalty_oct2026.sql
-- Pencatatan beban penalti handover pengiriman paket Lion Parcel
-- POS LION PARCEL KEPUNDUNG (batch 27-28 Oktober 2026)
--
-- Sumber data: Rekap_Penalti_POS_LION_PARCEL_KEPUNDUNG.xlsx
-- (Sheet1, 1 baris header + 3 baris data)
--
-- Detail Penalti (semua penalty_type = 'Handover', cod_type = 'Non-COD',
-- last_status = 'POD', pos_code = 'POS16204'):
-- 1. STT 11LP1793100087267 | JAGOPACK | BKD 2026-10-27 19:21:27
--    | Target 2026-10-28 19:21:27 | Handover 2026-10-28 19:34:44 | Rp 12.000
-- 2. STT 11LP1793100341185 | REGPACK  | BKD 2026-10-27 19:25:40
--    | Target 2026-10-28 19:25:40 | Handover 2026-10-28 19:34:44 | Rp 6.000
-- 3. STT 11LP1793100500933 | JAGOPACK | BKD 2026-10-27 19:28:20
--    | Target 2026-10-28 19:28:20 | Handover 2026-10-28 19:34:44 | Rp 3.325
--
-- Total penalti: Rp 21.325
--
-- Perlakuan akunting (SAMA dengan penalti operasional non-pemotongan
-- omzet yang sudah pernah diinput — lihat 055_add_lion_parcel_handover_penalty.sql):
-- - Outlet           : OUTLET-KEPUNDUNG
-- - Tanggal catat    : 2026-10-28 (tanggal serah terima fisik paket,
--                       saat SLA BOSSPACK/JAGOPACK/REGPACK terlampaui)
-- - Tipe             : KELUAR (beban / pengeluaran)
-- - Kategori         : 5900 (Beban Lain-lain)
-- - Metode pembayaran : BANK (pemotongan saldo deposit/bank kurir Lion Parcel)
-- - Sumber           : MANUAL (bukan auto-penalty omzet < 3 Juta / sumber KURIR)
--
-- Idempotent: setiap baris di-skip bila nomor STT yg sama sudah tercatat.
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
  v_owner_id UUID;
  v_penalty RECORD;
BEGIN
  -- 1. Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id
  FROM outlets
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- 2. Ambil kategori 5900 (Beban Lain-lain)
  SELECT id INTO v_kat_id
  FROM kategori_akun
  WHERE kode = '5900'
  LIMIT 1;

  -- 3. Ambil owner profile id
  SELECT id INTO v_owner_id
  FROM profiles
  WHERE role = 'owner'
  LIMIT 1;

  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Outlet KEPUNDUNG tidak ditemukan';
  END IF;

  IF v_kat_id IS NULL THEN
    RAISE EXCEPTION 'Kategori akun 5900 (Beban Lain-lain) tidak ditemukan';
  END IF;

  -- 4. Insert transaksi beban penalti handover per STT
  FOR v_penalty IN
    SELECT * FROM (VALUES
      ('11LP1793100087267', 'JAGOPACK', 12000::numeric),
      ('11LP1793100341185', 'REGPACK',   6000::numeric),
      ('11LP1793100500933', 'JAGOPACK',  3325::numeric)
    ) AS t(stt_no, product_type, penalty_amount)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM transaksi_keuangan
      WHERE outlet_id = v_outlet_id
        AND kategori_id = v_kat_id
        AND keterangan ILIKE '%' || v_penalty.stt_no || '%'
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
        created_by
      ) VALUES (
        v_outlet_id,
        '2026-10-28',
        'KELUAR',
        v_kat_id,
        v_penalty.penalty_amount,
        'BANK',
        'Rekap Penalty Handover Lion Parcel ' || v_penalty.product_type
          || ' Oktober 2026 (STT: ' || v_penalty.stt_no || ')',
        'MANUAL',
        v_owner_id
      );
    END IF;
  END LOOP;
END $$;