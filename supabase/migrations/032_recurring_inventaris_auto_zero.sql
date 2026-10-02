-- ============================================================
-- 032_recurring_inventaris_auto_zero.sql
-- Mendukung recurring transaksi untuk barang inventaris habis pakai (ATK/Packaging)
-- Fitur:
-- 1. Tambah kolom interval_bulan & barang_id pada recurring_transactions
-- 2. Update trigger fn_prevent_recurring_atk_expense agar mengizinkan 5100 jika ditautkan ke barang inventaris
-- 3. Update fn_run_recurring untuk otomatis menolkan stok lama (auto-zero OUT) saat restock recurring dijalankan
-- 4. Daftarkan template recurring Bubble Wrap (interval 4 bulan, metode CASH)
-- ============================================================

-- 1. Tambah kolom interval_bulan & barang_id
ALTER TABLE recurring_transactions 
  ADD COLUMN IF NOT EXISTS interval_bulan INT DEFAULT 1 CHECK (interval_bulan >= 1),
  ADD COLUMN IF NOT EXISTS barang_id UUID REFERENCES barang(id) ON DELETE SET NULL;

-- 2. Update trigger validasi 5100 (izinkan jika barang_id terisi)
CREATE OR REPLACE FUNCTION fn_prevent_recurring_atk_expense()
RETURNS trigger AS $$
DECLARE
  v_kode text;
BEGIN
  IF NEW.tipe = 'KELUAR' THEN
    SELECT kode INTO v_kode FROM kategori_akun WHERE id = NEW.kategori_id;
    IF v_kode = '5100' AND NEW.barang_id IS NULL THEN
      RAISE EXCEPTION 'Kategori Beban ATK & Packaging (kode 5100) harus ditautkan ke barang inventaris (barang_id) agar pergerakan stok otomatis tersinkronisasi.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update fn_run_recurring dengan logic auto-zeroing stok lama & interval bulan
CREATE OR REPLACE FUNCTION fn_run_recurring(p_target_date date default current_date)
RETURNS int AS $$
DECLARE
  r record;
  v_tanggal date;
  v_periode text;
  v_target_day int;
  v_count int := 0;
  v_stok_lama numeric;
  v_sm_in_id uuid;
  v_sm_out_id uuid;
  v_last_run_date date;
  v_months_diff int;
BEGIN
  v_target_day := extract(day from p_target_date)::int;

  FOR r IN
    SELECT rt.*, k.kode as kat_kode
    FROM recurring_transactions rt
    JOIN kategori_akun k ON k.id = rt.kategori_id
    WHERE rt.aktif = true
      AND rt.tanggal_setiap_bulan = v_target_day
  LOOP
    v_tanggal := p_target_date;
    v_periode := to_char(v_tanggal, 'YYYY-MM');

    -- Cek interval_bulan jika > 1 (misal 3, 4, atau 6 bulan sekali)
    IF r.interval_bulan > 1 AND r.last_run IS NOT NULL THEN
      v_last_run_date := r.last_run::date;
      v_months_diff := (extract(year from v_tanggal) - extract(year from v_last_run_date)) * 12 
                     + (extract(month from v_tanggal) - extract(month from v_last_run_date));
      IF v_months_diff < r.interval_bulan THEN
        CONTINUE; -- Lewati karena belum masuk jadwal interval
      END IF;
    END IF;

    -- Idempotent check: skip jika sudah pernah di-generate pada bulan & tahun ini
    IF EXISTS (
      SELECT 1 FROM transaksi_keuangan
      WHERE outlet_id = r.outlet_id
        AND (
          (sumber = 'RECURRING' AND ref_id = r.id)
          OR (sumber = 'INVENTARIS' AND ref_id IN (SELECT id FROM stok_movement WHERE ref_id = r.id))
        )
        AND to_char(tanggal, 'YYYY-MM') = v_periode
    ) THEN 
      CONTINUE; 
    END IF;

    -- JIKA DITAUTKAN KE BARANG INVENTARIS:
    IF r.barang_id IS NOT NULL THEN
      -- A. Hitung stok aktual barang sebelum pembelian baru
      SELECT coalesce(sum(
        CASE 
          WHEN tipe = 'IN' THEN qty
          WHEN tipe = 'OUT' THEN -qty
          WHEN tipe = 'ADJ' THEN qty
          ELSE 0 
        END
      ), 0) INTO v_stok_lama
      FROM stok_movement
      WHERE barang_id = r.barang_id;

      -- B. Logic Otomatis: Nolkan sisa stok lama (karena stok lama sudah habis)
      IF v_stok_lama > 0 THEN
        INSERT INTO stok_movement (
          outlet_id, barang_id, tipe, qty, harga_satuan, total,
          ref_type, keterangan, tanggal
        ) VALUES (
          r.outlet_id, r.barang_id, 'OUT', v_stok_lama, r.nominal, v_stok_lama * r.nominal,
          'INVENTARIS_AUTO', 'Pemakaian habis stok lama sebelum restock recurring (Otomatis Nol)', v_tanggal
        );
      END IF;

      -- C. Catat stok masuk pembelian baru (1 unit/roll)
      INSERT INTO stok_movement (
        outlet_id, barang_id, tipe, qty, harga_satuan, total,
        ref_type, ref_id, keterangan, tanggal
      ) VALUES (
        r.outlet_id, r.barang_id, 'IN', 1, r.nominal, r.nominal,
        'INVENTARIS_AUTO', r.id, 'Stok masuk pembelian baru via recurring: ' || r.nama_template, v_tanggal
      ) RETURNING id INTO v_sm_in_id;

      -- D. Catat pengeluaran keuangan (sumber INVENTARIS sesuai Metode A)
      INSERT INTO transaksi_keuangan (
        outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
      ) VALUES (
        r.outlet_id, v_tanggal, r.tipe, r.kategori_id, 'INVENTARIS', v_sm_in_id,
        r.nominal, r.metode, 'Auto dari recurring inventaris: ' || r.nama_template
      );

    ELSE
      -- Transaksi recurring standar non-inventaris
      INSERT INTO transaksi_keuangan (
        outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
      ) VALUES (
        r.outlet_id, v_tanggal, r.tipe, r.kategori_id, 'RECURRING', r.id,
        r.nominal, r.metode, 'Auto dari recurring: ' || r.nama_template
      );
    END IF;

    UPDATE recurring_transactions SET last_run = v_tanggal WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 4. Daftarkan Template Recurring Bubble Wrap (Setiap 4 Bulan, Nominal Rp 110.000, Metode CASH)
DO $$
DECLARE
  v_outlet_id UUID;
  v_kat_id UUID;
  v_barang_id UUID;
BEGIN
  SELECT id INTO v_outlet_id FROM outlets WHERE kode = 'OUTLET-KEPUNDUNG' OR id = 'dd40e5bd-0bfc-4784-8e35-a15c1a94acb1' LIMIT 1;
  SELECT id INTO v_kat_id FROM kategori_akun WHERE kode = '5100' LIMIT 1;
  SELECT id INTO v_barang_id FROM barang WHERE outlet_id = v_outlet_id AND nama = 'Bubble Wrap 1.25m x 50m' LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM recurring_transactions 
    WHERE outlet_id = v_outlet_id AND barang_id = v_barang_id
  ) THEN
    INSERT INTO recurring_transactions (
      outlet_id,
      kategori_id,
      nama_template,
      nominal,
      metode,
      tanggal_setiap_bulan,
      interval_bulan,
      barang_id,
      tipe,
      aktif,
      last_run
    ) VALUES (
      v_outlet_id,
      v_kat_id,
      'Pembelian 1 Roll Bubble Wrap (Restock)',
      110000,
      'CASH',
      10,
      4,
      v_barang_id,
      'KELUAR',
      true,
      '2026-09-10'
    );
  END IF;
END $$;
