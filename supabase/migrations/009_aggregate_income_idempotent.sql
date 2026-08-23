-- ============================================================
-- 009_aggregate_income_idempotent.sql
-- Fix Bug #4: Race condition XLSX import → double income
-- Sprint 5 polish
-- ============================================================

-- Sebelumnya: function `fn_aggregate_income` di migration 004_akunting.sql
-- Logika idempotent pakai "skip if exists" (early return)
-- Bug: kalau 2 request paralel, dua-duanya bisa lewat check exists sebelum INSERT
--      → race condition → duplicate income

-- Solusi: pakai ON CONFLICT (outlet_id, periode, sumber) DO UPDATE
--         Karena unique constraint sudah ada di `transaksi_keuangan` (outlet_id, sumber, ref_id)
--         dan sumber = 'KURIR', ref_id = NULL untuk aggregate income
--         → kita perlu unique di (outlet_id, periode, sumber='KURIR') atau gunakan
--         unique partial index.

-- Pertama: tambahkan unique partial index untuk KURIR income
create unique index if not exists idx_unique_kurir_income
  on transaksi_keuangan (outlet_id, tanggal)
  where sumber = 'KURIR';

-- Kedua: replace function fn_aggregate_income agar pakai ON CONFLICT
create or replace function fn_aggregate_income(p_outlet_id uuid, p_periode text)
returns void as $$
declare
  v_kategori_id uuid;
  v_total numeric;
begin
  -- Ambil kategori Pendapatan Ekspedisi (kode 4100)
  select id into v_kategori_id from kategori_akun where kode = '4100' limit 1;
  if v_kategori_id is null then return; end if;

  -- Hitung net omzet dari transaksi bulan ini (exclude canceled)
  select coalesce(sum(
    coalesce(total_biaya, 0)
    - coalesce(diskon_booking, 0)
    - coalesce(diskon_asuransi, 0)
    - coalesce(diskon_forward_rate, 0)
    - coalesce(diskon_pickup, 0)
  ), 0)
  into v_total
  from transaksi
  where outlet_id = p_outlet_id
    and to_char(tanggal, 'YYYY-MM') = p_periode
    and status not in ('CNX');

  if v_total is null or v_total <= 0 then return; end if;

  -- INSERT ... ON CONFLICT DO UPDATE (idempotent atomic)
  -- Idempotent: kalau 2 request paralel, satu akan update, satu lagi tidak duplicate
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
-- 1. Unique partial index `idx_unique_kurir_income` di (outlet_id, tanggal) WHERE sumber='KURIR'
--    → Cuma 1 baris KURIR income per (outlet, tanggal)
-- 2. ON CONFLICT DO UPDATE → atomic, race-safe
-- 3. Function tetap idempotent: kalau dipanggil 2x, hasilnya sama
-- 4. Update 004_akunting.sql: function ini di-replace oleh migration 009
--    (Postgres pakai function definition yang paling baru, jadi aman)
-- ============================================================