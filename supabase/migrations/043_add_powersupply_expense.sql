-- ============================================================
-- 043_add_powersupply_expense.sql
-- Pencatatan pembelian 1 unit power supply (PSU) untuk operasional PC outlet
-- Tanggal: 14 September 2025 (2025-09-14) [Diralat dari 15 Oktober 2025]
-- Nominal: Rp 700.000
-- Kategori: 5400 (Beban Perlengkapan Kantor)
-- Metode Pembayaran: BANK
-- ============================================================

DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
BEGIN
  -- Ambil outlet KEPUNDUNG
  SELECT id INTO v_outlet_id 
  FROM outlets 
  WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1'
  LIMIT 1;

  -- Ambil kategori 5400 (Beban Perlengkapan Kantor)
  SELECT id INTO v_kat_id 
  FROM kategori_akun 
  WHERE kode = '5400' 
  LIMIT 1;

  -- 1. Jika sebelumnya tercatat di 2025-10-15, update tanggalnya ke 2025-09-14 (ralat tanggal)
  IF EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-10-15'
      AND kategori_id = v_kat_id
      AND nominal = 700000
      AND keterangan ILIKE '%power supply%'
  ) THEN
    UPDATE transaksi_keuangan
    SET tanggal = '2025-09-14'
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-10-15'
      AND kategori_id = v_kat_id
      AND nominal = 700000
      AND keterangan ILIKE '%power supply%';
  ELSIF NOT EXISTS (
    -- 2. Jika belum ada di 2025-09-14, insert baru
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-09-14'
      AND kategori_id = v_kat_id
      AND nominal = 700000
  ) THEN
    INSERT INTO transaksi_keuangan (
      outlet_id,
      tanggal,
      tipe,
      kategori_id,
      nominal,
      metode,
      keterangan,
      sumber
    ) VALUES (
      v_outlet_id,
      '2025-09-14',
      'KELUAR',
      v_kat_id,
      700000,
      'BANK',
      'Pembelian 1 unit power supply untuk komputer operasional outlet',
      'MANUAL'
    );
  END IF;
END $$;
