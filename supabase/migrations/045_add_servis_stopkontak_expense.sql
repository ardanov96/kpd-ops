-- ============================================================
-- 045_add_servis_stopkontak_expense.sql
-- Pencatatan pengeluaran maintenance: servis pemasangan stopkontak oleh tukang listrik
-- Tanggal: 12 September 2025 (2025-09-12)
-- Nominal: Rp 250.000
-- Kategori: 5700 (Beban Maintenance)
-- Metode Pembayaran: CASH
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

  -- Ambil kategori 5700 (Beban Maintenance)
  SELECT id INTO v_kat_id 
  FROM kategori_akun 
  WHERE kode = '5700' 
  LIMIT 1;

  -- Insert jika belum ada transaksi serupa pada tanggal tersebut
  IF NOT EXISTS (
    SELECT 1 FROM transaksi_keuangan
    WHERE outlet_id = v_outlet_id
      AND tanggal = '2025-09-12'
      AND kategori_id = v_kat_id
      AND nominal = 250000
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
      '2025-09-12',
      'KELUAR',
      v_kat_id,
      250000,
      'CASH',
      'Servis pemasangan stopkontak oleh tukang listrik untuk operasional outlet',
      'MANUAL'
    );
  END IF;
END $$;
