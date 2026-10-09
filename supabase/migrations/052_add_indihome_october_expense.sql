-- ============================================================
-- 052_add_indihome_october_expense.sql
-- Pencatatan tagihan internet IndiHome periode Oktober 2026 senilai Rp 197.025
-- Mengalami sedikit kenaikan/pembengkakan dari September (Rp 194.250) karena pemakaian lebih tinggi.
-- Update nominal template recurring IndiHome menjadi Rp 197.025 dan last_run 2026-10-20.
-- Tanggal: 20 Oktober 2026 (2026-10-20)
-- Nominal: Rp 197.025
-- Kategori: 5200 (Beban Internet (WiFi))
-- Metode Pembayaran: BANK
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
  v_owner_id UUID;
  v_rec_id UUID;
BEGIN
  -- 1. Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id 
  FROM outlets 
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- 2. Ambil kategori 5200 (Beban Internet)
  SELECT id INTO v_kat_id 
  FROM kategori_akun 
  WHERE kode = '5200' 
  LIMIT 1;

  -- 3. Ambil owner profile id
  SELECT id INTO v_owner_id
  FROM profiles
  WHERE role = 'owner'
  LIMIT 1;

  -- 4. Ambil template recurring IndiHome
  SELECT id INTO v_rec_id
  FROM recurring_transactions
  WHERE outlet_id = v_outlet_id
    AND nama_template ILIKE '%indihome%'
  LIMIT 1;

  -- 5. Perbarui template recurring IndiHome ke nominal tagihan terkini
  IF v_rec_id IS NOT NULL THEN
    UPDATE recurring_transactions
    SET nominal = 197025,
        last_run = '2026-10-20'
    WHERE id = v_rec_id;
  END IF;

  -- 6. Insert transaksi tagihan Oktober 2026 jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND to_char(tanggal, 'YYYY-MM') = '2026-10'
      AND kategori_id = v_kat_id
      AND (keterangan ILIKE '%indihome%' OR ref_id = v_rec_id)
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
      ref_id,
      created_by
    ) VALUES (
      v_outlet_id,
      '2026-10-20',
      'KELUAR',
      v_kat_id,
      197025,
      'BANK',
      'Tagihan Internet IndiHome (periode Oktober 2026)',
      'RECURRING',
      v_rec_id,
      v_owner_id
    );
  END IF;
END $$;
