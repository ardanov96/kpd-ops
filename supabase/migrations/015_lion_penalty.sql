-- ============================================================
-- 015_lion_penalty.sql
-- Implementasi penalti bulanan untuk franchise Lion Parcel.
-- Jika total omzet (total_biaya) < 3.000.000, potong 500.000 (catat sbg pengeluaran)
-- ============================================================

-- 1. Update unique index agar mendukung KELUAR (Penalty) dari KURIR di hari yang sama
drop index if exists idx_unique_kurir_income;
create unique index if not exists idx_unique_kurir_income_masuk 
  on transaksi_keuangan (outlet_id, tanggal) where sumber = 'KURIR' and tipe = 'MASUK';
create unique index if not exists idx_unique_kurir_income_keluar 
  on transaksi_keuangan (outlet_id, tanggal) where sumber = 'KURIR' and tipe = 'KELUAR';

-- 2. Update view v_summary_bulanan untuk menambahkan kolom penalty
drop view if exists v_summary_bulanan cascade;

create or replace view v_summary_bulanan as
select
  o.nama as outlet,
  k.nama as kurir,
  k.warna as kurir_warna,
  to_char(t.tanggal, 'YYYY-MM') as periode,
  count(*) as total_paket,
  sum(t.koli) as total_koli,
  sum(t.total_biaya) as total_omzet,
  sum(t.diskon_booking) as total_diskon,
  case 
    when k.kode = 'LION' and sum(t.total_biaya) < 3000000 then 500000 
    else 0 
  end as penalty,
  sum(t.total_biaya - t.diskon_booking) - 
  (case when k.kode = 'LION' and sum(t.total_biaya) < 3000000 then 500000 else 0 end) as net_omzet,
  sum(case when t.status = 'POD' then 1 else 0 end) as pod_count,
  sum(case when t.status = 'CNX' then 1 else 0 end) as cnx_count,
  round(
    sum(case when t.status = 'POD' then 1 else 0 end)::numeric
    / nullif(count(*), 0) * 100, 1
  ) as pod_rate
from transaksi t
join outlets o on o.id = t.outlet_id
join kurir k   on k.id = t.kurir_id
group by o.nama, k.nama, k.kode, k.warna, to_char(t.tanggal, 'YYYY-MM');

-- 3. Update fn_aggregate_income untuk memasukkan penalty ke transaksi_keuangan
create or replace function fn_aggregate_income(p_outlet_id uuid, p_periode text)
returns void as $$
declare
  v_kategori_income uuid;
  v_kategori_expense uuid;
  v_lion_omzet numeric;
  v_total numeric;
begin
  -- Ambil kategori Pendapatan Ekspedisi (kode 4100)
  select id into v_kategori_income from kategori_akun where kode = '4100' limit 1;
  if v_kategori_income is null then return; end if;

  -- Ambil kategori Beban Lain-lain (kode 5900) untuk mencatat penalty
  select id into v_kategori_expense from kategori_akun where kode = '5900' limit 1;

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

  -- INSERT ... ON CONFLICT DO UPDATE untuk INCOME
  insert into transaksi_keuangan (
    outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
  ) values (
    p_outlet_id,
    (p_periode || '-01')::date,
    'MASUK',
    v_kategori_income,
    'KURIR',
    null,
    v_total,
    'BANK',
    'Auto-income dari import XLSX franchise, periode ' || p_periode
  )
  on conflict (outlet_id, tanggal) where sumber = 'KURIR' and tipe = 'MASUK'
  do update set
    nominal = excluded.nominal,
    metode = excluded.metode,
    keterangan = excluded.keterangan;

  -- PENALTY LOGIC UNTUK LION PARCEL
  if v_kategori_expense is not null then
    -- Hitung total kotor omzet khusus Lion Parcel
    select coalesce(sum(coalesce(total_biaya, 0)), 0)
    into v_lion_omzet
    from transaksi
    where outlet_id = p_outlet_id
      and to_char(tanggal, 'YYYY-MM') = p_periode
      and status not in ('CNX')
      and kurir_id = (select id from kurir where kode = 'LION' limit 1);

    if v_lion_omzet > 0 and v_lion_omzet < 3000000 then
      -- INSERT / UPDATE Penalty
      insert into transaksi_keuangan (
        outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
      ) values (
        p_outlet_id,
        (p_periode || '-01')::date,
        'KELUAR',
        v_kategori_expense,
        'KURIR',
        null,
        500000,
        'BANK',
        'Auto-penalty Lion Parcel (Omzet < 3 Juta), periode ' || p_periode
      )
      on conflict (outlet_id, tanggal) where sumber = 'KURIR' and tipe = 'KELUAR'
      do update set
        nominal = excluded.nominal,
        metode = excluded.metode,
        keterangan = excluded.keterangan;
    else
      -- Jika sebelumnya ada penalty tapi sekarang omzet >= 3jt (misal upload ulang), hapus penalty tersebut
      delete from transaksi_keuangan
      where outlet_id = p_outlet_id
        and tanggal = (p_periode || '-01')::date
        and sumber = 'KURIR'
        and tipe = 'KELUAR';
    end if;
  end if;

end;
$$ language plpgsql;
