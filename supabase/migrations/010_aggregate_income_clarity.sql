-- ============================================================
-- 010_aggregate_income_clarity.sql
-- Fix Bug #3: Diskon calculation precedence clarity
-- Sprint 5 polish
-- ============================================================

-- Sebelumnya: function `fn_aggregate_income` di 004_akunting.sql (dan di-replace oleh 009)
-- Logika: total_biaya - diskon_booking - diskon_asuransi - diskon_forward_rate - diskon_pickup
-- Logika ini sebenarnya BENAR di SQL (evaluasi left-to-right: A - B - C - D - E)
-- Contoh: 1000 - 200 - 100 - 50 - 20 = 630
--   Step 1: 1000 - 200 = 800
--   Step 2: 800 - 100 = 700
--   Step 3: 700 - 50 = 650
--   Step 4: 650 - 20 = 630 ✓

-- Bug: kalau ada diskon negatif (refund/penambah biaya), hasilnya bisa salah
-- Contoh: 1000 - 200 - (-100) - 50 - 20 = 1000 - 200 + 100 - 50 - 20 = 830
--   Step 1: 1000 - 200 = 800
--   Step 2: 800 - (-100) = 800 + 100 = 900
--   Step 3: 900 - 50 = 850
--   Step 4: 850 - 20 = 830 ✓ (masih benar)

-- Tapi tanpa parentheses, READABILITY-nya buruk dan developer bisa salah paham.
-- Solusi: tambahkan explicit parentheses di setiap subtraction untuk clarity.

create or replace function fn_aggregate_income(p_outlet_id uuid, p_periode text)
returns void as $$
declare
  v_kategori_id uuid;
  v_total numeric;
begin
  -- Ambil kategori Pendapatan Ekspedisi (kode 4100)
  select id into v_kategori_id from kategori_akun where kode = '4100' limit 1;
  if v_kategori_id is null then return; end if;

  -- Hitung net omzet dengan parentheses eksplisit (Fix Bug #3: clarity)
  select coalesce(sum(
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
  into v_total
  from transaksi
  where outlet_id = p_outlet_id
    and to_char(tanggal, 'YYYY-MM') = p_periode
    and status not in ('CNX');

  if v_total is null or v_total <= 0 then return; end if;

  -- INSERT ... ON CONFLICT DO UPDATE (idempotent atomic) - dari migration 009
  insert into transaksi_keuangan (
    outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
  ) values (
    p_outlet_id,
    (p_periode || '-01')::date,
    'MASUK',
    v_kategori_id,
    'KURIR',
    null,
    v_total,
    'BANK',
    'Auto-income dari import XLSX franchise, periode ' || p_periode
  )
  on conflict (outlet_id, tanggal) where sumber = 'KURIR'
  do update set
    nominal = excluded.nominal,
    metode = excluded.metode,
    keterangan = excluded.keterangan;

end;
$$ language plpgsql;

-- ============================================================
-- CATATAN:
-- 1. Function ini sama persis dengan 009_aggregate_income_idempotent.sql
--    (idempotent + ON CONFLICT), hanya tambahkan explicit parentheses
-- 2. Readability lebih baik → developer tidak salah paham
-- 3. Logic hasil 100% sama dengan function sebelumnya
--    (parentheses tidak mengubah hasil, hanya grouping evaluasi)
-- ============================================================