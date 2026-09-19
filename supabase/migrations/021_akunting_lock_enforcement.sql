-- ============================================================
-- 021_akunting_lock_enforcement.sql
-- Cegah modifikasi data transaksi_keuangan setelah closing.
--
-- Bug: fn_aggregate_income, fn_aggregate_income_jne, dan
-- fn_auto_expense_from_stok_out tidak cek periode_closing.is_locked
-- sehingga upload XLSX/PDF atau stok keluar ke period yg sudah
-- di-closing ttp bisa UPSERT/INSERT income/expense. Ini menyebabkan
-- v_laba_rugi (live) vs periode_closing.laba (snapshot) jadi
-- inkonsisten — owner bingung kenapa closing page show angka lama
-- tapi laporan laba-rugi real-time show angka baru.
--
-- Fix: tambah lock check di semua function auto-generated.
-- ============================================================

-- ─── 1. fn_aggregate_income: skip aggregate jika locked ────
CREATE OR REPLACE FUNCTION fn_aggregate_income(p_outlet_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_kategori_income uuid;
  v_total numeric;
  v_locked boolean;
BEGIN
  -- Lock check: tolak aggregate ulang jika period sudah di-closing
  SELECT is_locked INTO v_locked
  FROM periode_closing
  WHERE outlet_id = p_outlet_id AND periode = p_periode;
  IF v_locked IS TRUE THEN
    RAISE EXCEPTION 'Periode % sudah di-closing dan tdk bisa di-aggregate ulang. Buka periode (closing=false) terlebih dahulu jika perlu update data.', p_periode;
  END IF;

  -- Ambil kategori Pendapatan Ekspedisi (kode 4100)
  SELECT id INTO v_kategori_income FROM kategori_akun WHERE kode = '4100' LIMIT 1;
  IF v_kategori_income IS NULL THEN RETURN; END IF;

  -- Hitung net omzet dengan parentheses eksplisit (Fix Bug #3: clarity)
  SELECT COALESCE(SUM(
    (
      (
        (
          (
            coalesce(total_biaya, 0)
            - coalesce(diskon_booking, 0)
          ) - coalesce(diskon_asuransi, 0)
        ) - coalesce(diskon_forward_rate, 0)
      ) - coalesce(diskon_pickup, 0)
    )
  ), 0)
  INTO v_total
  FROM transaksi
  WHERE outlet_id = p_outlet_id
    AND to_char(tanggal, 'YYYY-MM') = p_periode
    AND status NOT IN ('CNX');

  IF v_total IS NULL OR v_total <= 0 THEN
    DELETE FROM transaksi_keuangan
    WHERE outlet_id = p_outlet_id
      AND tipe = 'MASUK'
      AND sumber = 'KURIR'
      AND to_char(tanggal, 'YYYY-MM') = p_periode;
    RETURN;
  END IF;

  -- UPSERT income
  INSERT INTO transaksi_keuangan (
    outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
  ) VALUES (
    p_outlet_id,
    (p_periode || '-01')::date,
    'MASUK',
    v_kategori_income,
    'KURIR',
    NULL,
    v_total,
    'BANK',
    'Auto-income dari import XLSX franchise, periode ' || p_periode
  )
  ON CONFLICT (outlet_id, tanggal) WHERE sumber = 'KURIR' AND tipe = 'MASUK'
  DO UPDATE SET
    nominal = excluded.nominal,
    keterangan = excluded.keterangan;

  -- Penalty Lion Parcel (probation mulai April 2024)
  PERFORM fn_aggregate_lion_penalty(p_outlet_id, p_periode);
END;
$$ LANGUAGE plpgsql;

-- ─── 2. fn_aggregate_lion_penalty: extracted sub-function ──
-- Sebelumnya inline di fn_aggregate_income, sekarang punya lock check sendiri
CREATE OR REPLACE FUNCTION fn_aggregate_lion_penalty(p_outlet_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_kategori_expense uuid;
  v_lion_kurir_id uuid;
  v_lion_omzet numeric;
  v_probation_start text := '2024-04';
  v_should_penalty boolean;
BEGIN
  SELECT id INTO v_kategori_expense FROM kategori_akun WHERE kode = '5900' LIMIT 1;
  SELECT id INTO v_lion_kurir_id FROM kurir WHERE kode = 'LION' LIMIT 1;
  IF v_kategori_expense IS NULL OR v_lion_kurir_id IS NULL THEN RETURN; END IF;

  -- Hitung Lion omzet bruto untuk bulan ini
  SELECT COALESCE(SUM(discount + COALESCE(disc_others, 0)), 0)
  INTO v_lion_omzet
  FROM transaksi
  WHERE outlet_id = p_outlet_id
    AND to_char(tanggal, 'YYYY-MM') = p_periode
    AND status NOT IN ('CNX');

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
    -- Hapus penalty existing (covers: omzet naik ≥ 3jt ATAU probation period)
    DELETE FROM transaksi_keuangan
    WHERE outlet_id = p_outlet_id
      AND tipe = 'KELUAR'
      AND sumber = 'KURIR'
      AND to_char(tanggal, 'YYYY-MM') = p_periode;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ─── 3. fn_aggregate_income_jne: tambah lock check ────────────
CREATE OR REPLACE FUNCTION fn_aggregate_income_jne(p_outlet_id uuid, p_periode text)
RETURNS void AS $$
DECLARE
  v_kategori_income uuid;
  v_jne_kurir_id uuid;
  v_total numeric;
  v_locked boolean;
BEGIN
  SELECT is_locked INTO v_locked
  FROM periode_closing
  WHERE outlet_id = p_outlet_id AND periode = p_periode;
  IF v_locked IS TRUE THEN
    RAISE EXCEPTION 'Periode % sudah di-closing dan tdk bisa di-aggregate ulang. Buka periode terlebih dahulu.', p_periode;
  END IF;

  SELECT id INTO v_kategori_income FROM kategori_akun WHERE kode = '4100' LIMIT 1;
  IF v_kategori_income IS NULL THEN RETURN; END IF;

  SELECT id INTO v_jne_kurir_id FROM kurir WHERE kode = 'JNE' LIMIT 1;
  IF v_jne_kurir_id IS NULL THEN RETURN; END IF;

  -- Hitung komisi franchise JNE = discount + disc_others
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

-- ─── 4. fn_auto_expense_from_stok_out: tolak insert jika locked ──
CREATE OR REPLACE FUNCTION fn_auto_expense_from_stok_out()
RETURNS trigger AS $$
DECLARE
  v_kategori_id uuid;
  v_periode text;
  v_locked boolean;
BEGIN
  IF NEW.tipe <> 'OUT' THEN RETURN NEW; END IF;
  IF NEW.ref_type = 'INVENTARIS_AUTO' THEN RETURN NEW; END IF;  -- hindari loop

  -- Lock check: tolak stok keluar yg masuk ke period yg sudah di-closing
  v_periode := to_char(NEW.tanggal, 'YYYY-MM');
  SELECT is_locked INTO v_locked
  FROM periode_closing
  WHERE outlet_id = NEW.outlet_id AND periode = v_periode;
  IF v_locked IS TRUE THEN
    RAISE EXCEPTION 'Stok keluar ditolak: periode % sudah di-closing.', v_periode;
  END IF;

  SELECT id INTO v_kategori_id FROM kategori_akun WHERE kode = '5100' LIMIT 1;
  IF v_kategori_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO transaksi_keuangan (
    outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
  ) VALUES (
    NEW.outlet_id,
    NEW.tanggal,
    'KELUAR',
    v_kategori_id,
    'INVENTARIS',
    NEW.id,
    NEW.total,
    'CASH',
    'Auto-expense dari stok keluar: ' || coalesce(NEW.keterangan, '')
  );

  NEW.ref_type := 'INVENTARIS_AUTO';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 5. Helper: cek apakah periode locked (untuk API routes) ──
CREATE OR REPLACE FUNCTION is_periode_locked(p_outlet_id uuid, p_periode text)
RETURNS boolean AS $$
DECLARE
  v_locked boolean;
BEGIN
  SELECT is_locked INTO v_locked
  FROM periode_closing
  WHERE outlet_id = p_outlet_id AND periode = p_periode;
  RETURN COALESCE(v_locked, false);
END;
$$ LANGUAGE plpgsql STABLE;
