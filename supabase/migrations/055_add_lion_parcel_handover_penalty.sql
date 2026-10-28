-- ============================================================
-- 055_add_lion_parcel_handover_penalty.sql
-- Pencatatan beban penalti pengiriman paket Lion Parcel (Late Handover SLA BOSSPACK)
-- Berdasarkan file rekap: Rekap_Penalti_POS_LION_PARCEL_KEPUNDUNG.xlsx
--
-- Detail Penalti:
-- - Nomor STT: 11LP1790929804126
-- - Kode / Nama POS: POS16204 / POS LION PARCEL KEPUNDUNG
-- - Produk: BOSSPACK (Non-COD)
-- - Tipe Penalti: BOSSPACK
-- - Booking Date (BKD): 2026-10-02 16:30:03
-- - Target Handover: 2026-10-02 23:59:59
-- - Handover Date: 2026-10-03 08:22:26
-- - Nominal Penalti: Rp 4.650
-- - Tanggal Pencatatan: 2026-10-03 (saat serah terima fisik paket dilakukan melewati SLA)
-- - Kategori: 5900 (Beban Lain-lain)
-- - Metode Pembayaran: BANK (pemotongan saldo deposit/bank kurir Lion Parcel)
-- - Sumber: MANUAL (sesuai format penalti operasional paket non-omzet sebelumnya)
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
  v_owner_id UUID;
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

  -- 4. Insert transaksi beban penalti pengiriman paket jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2026-10-03'
      AND kategori_id = v_kat_id
      AND nominal = 4650
      AND keterangan ILIKE '%11LP1790929804126%'
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
      '2026-10-03',
      'KELUAR',
      v_kat_id,
      4650,
      'BANK',
      'Rekap Penalty Handover Lion Parcel BOSSPACK Oktober 2026 (STT: 11LP1790929804126)',
      'MANUAL',
      v_owner_id
    );
  END IF;
END $$;
