-- ============================================================
-- 016_fix_accounting_views.sql
-- Memperbaiki definisi views akunting: v_keuangan_per_kategori dan v_neraca
-- ============================================================

-- 1. View Breakdown per kategori per bulan (drill-down Laba-Rugi)
create or replace view v_keuangan_per_kategori as
select
  tk.outlet_id,
  to_char(tk.tanggal, 'YYYY-MM') as periode,
  tk.kategori_id,
  k.kode as kategori_kode,
  k.nama as kategori_nama,
  k.tipe as kategori_tipe,
  sum(case when tk.tipe = 'MASUK' then tk.nominal else 0 end) as nominal_income,
  sum(case when tk.tipe = 'KELUAR' then tk.nominal else 0 end) as nominal_expense,
  count(*) as jumlah_transaksi
from transaksi_keuangan tk
join kategori_akun k on k.id = tk.kategori_id
group by tk.outlet_id, to_char(tk.tanggal, 'YYYY-MM'), tk.kategori_id, k.kode, k.nama, k.tipe;

-- 2. View Neraca sederhana
create or replace view v_neraca as
with kas as (
  select outlet_id,
    sum(case when tipe='MASUK' then nominal when tipe='KELUAR' then -nominal else 0 end) as total_kas
  from transaksi_keuangan
  where metode is not null
  group by outlet_id
),
laba_ditahan as (
  select outlet_id, sum(laba) as total_laba_ditahan
  from periode_closing
  group by outlet_id
),
modal as (
  select outlet_id, sum(case when tipe='PRIVE' then -nominal else 0 end) as total_modal
  from transaksi_keuangan
  where sumber in ('MANUAL','CLOSING') and kategori_id in (
    select id from kategori_akun where kode = '3100'
  )
  group by outlet_id
)
select
  o.id as outlet_id,
  o.kode as outlet_kode,
  o.nama as outlet_nama,
  coalesce(k.total_kas, 0) as total_aset_kas,
  0 as total_aset_lain,
  coalesce(k.total_kas, 0) as total_aset,
  0 as total_liability,
  coalesce(m.total_modal, 0) as total_modal_pemilik,
  coalesce(ld.total_laba_ditahan, 0) as total_laba_ditahan,
  coalesce(m.total_modal, 0) + coalesce(ld.total_laba_ditahan, 0) as total_equity,
  coalesce(k.total_kas, 0) - (coalesce(m.total_modal, 0) + coalesce(ld.total_laba_ditahan, 0)) as selisih
from outlets o
left join kas k on k.outlet_id = o.id
left join laba_ditahan ld on ld.outlet_id = o.id
left join modal m on m.outlet_id = o.id;
