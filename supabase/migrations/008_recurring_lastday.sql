-- ============================================================
-- 008_recurring_lastday.sql
-- Fix Bug #1: Recurring transaction tgl 31 di bulan pendek
-- Sprint 5 polish
-- ============================================================

-- Sebelumnya: function `fn_run_recurring` di migration 004_akunting.sql
-- filter `where tanggal_setiap_bulan = extract(day from current_date)`
-- → Kalau owner set recurring tgl 31, di bulan dengan 30 hari (April, Juni, dll)
--   ATAU Feb (28/29 hari), tgl 31 TIDAK ADA → function generate tidak pernah firing
-- → Owner baru sadar setelah cek transaksi di bulan-bulan tersebut

-- Solusi: tambahkan OR clause untuk handle case "tanggal > last day of month"
-- Jika tanggal_setiap_bulan > last day of current month, fire pada last day of month

create or replace function fn_run_recurring(p_target_date date default current_date)
returns int as $$
declare
  r record;
  v_tanggal date;
  v_periode text;
  v_last_day_of_month date;
  v_target_day int := extract(day from p_target_date)::int;
  v_count int := 0;
begin
  -- Hitung last day of current month
  v_last_day_of_month := (date_trunc('month', p_target_date) + interval '1 month - 1 day')::date;

  for r in
    select * from recurring_transactions
    where aktif = true
      and (
        tanggal_setiap_bulan = v_target_day
        or (
          v_target_day = extract(day from v_last_day_of_month)
          and tanggal_setiap_bulan > extract(day from v_last_day_of_month)
        )
      )
  loop
    v_tanggal := p_target_date;
    v_periode := to_char(v_tanggal, 'YYYY-MM');

    -- Idempotent: skip kalau sudah pernah generate bulan ini
    if exists (
      select 1 from transaksi_keuangan
      where outlet_id = r.outlet_id
      and sumber = 'RECURRING'
      and ref_id = r.id
      and to_char(tanggal, 'YYYY-MM') = v_periode
    ) then
      continue;
    end if;

    insert into transaksi_keuangan (
      outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
    ) values (
      r.outlet_id, v_tanggal, r.tipe, r.kategori_id, 'RECURRING', r.id,
      r.nominal, r.metode, 'Auto dari recurring: ' || r.nama_template
    );

    update recurring_transactions set last_run = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$ language plpgsql;

-- ============================================================
-- CATATAN:
-- 1. Logic tambahan: kalau tanggal_setiap_bulan > last_day, fire pada last day
--    Contoh: tanggal_setiap_bulan=31, current date=30 April
--    → 30 (last day) = 30 = extract(day from v_last_day_of_month) → fire
-- 2. Untuk bulan Feb (28/29 hari), recurring tgl 30 atau 31 akan fire pada tgl 28/29
-- 3. Setelah ini di-deploy, function lama di 004_akunting.sql akan ter-replace
-- 4. Update 030-decision-log.md D-016 (recurring tgl 31 di bulan pendek → di-skip)
--    jadi "fire pada last day of month" (lebih konsisten dengan ekspektasi owner)
-- ============================================================