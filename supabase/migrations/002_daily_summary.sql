-- ============================================================
-- EKSPEDISI MULTI-FRANCHISE DASHBOARD
-- Migration: Daily Aggregation Views untuk Dashboard Harian
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- View 1: Rekap harian per outlet per kurir
create or replace view v_summary_harian as
select
  o.nama as outlet,
  k.kode as kurir_kode,
  k.nama as kurir_nama,
  k.warna as kurir_warna,
  t.tanggal,
  count(*) as total_paket,
  sum(coalesce(t.koli, 0)) as total_koli,
  sum(coalesce(t.total_biaya, 0)) as total_omzet,
  sum(
    coalesce(t.diskon_booking, 0) +
    coalesce(t.diskon_asuransi, 0) +
    coalesce(t.diskon_forward_rate, 0) +
    coalesce(t.diskon_pickup, 0)
  ) as total_diskon,
  sum(
    coalesce(t.total_biaya, 0)
    - coalesce(t.diskon_booking, 0)
    - coalesce(t.diskon_asuransi, 0)
    - coalesce(t.diskon_forward_rate, 0)
    - coalesce(t.diskon_pickup, 0)
  ) as net_omzet,
  sum(case when t.status = 'POD' then 1 else 0 end) as pod_count,
  sum(case when t.status = 'CNX' then 1 else 0 end) as cnx_count,
  sum(case when t.jenis_kiriman = 'COD' then 1 else 0 end) as cod_count,
  sum(case when coalesce(t.jenis_kiriman, 'NON-COD') = 'NON-COD' then 1 else 0 end) as noncod_count
from transaksi t
join outlets o on o.id = t.outlet_id
join kurir k   on k.id = t.kurir_id
group by o.nama, k.kode, k.nama, k.warna, t.tanggal;

-- View 2: Top tujuan harian (untuk leaderboard kota tujuan)
create or replace view v_top_tujuan_harian as
select
  t.tanggal,
  k.kode as kurir,
  k.warna as kurir_warna,
  t.kota_tujuan,
  count(*) as jumlah,
  sum(coalesce(t.total_biaya, 0)) as total_omzet
from transaksi t
join kurir k on k.id = t.kurir_id
where t.kota_tujuan is not null and t.kota_tujuan <> ''
group by t.tanggal, k.kode, k.warna, t.kota_tujuan
order by jumlah desc;