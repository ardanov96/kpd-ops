-- ============================================================
-- 025_fix_v_neraca_equity.sql
-- Memperbaiki CTE modal di v_neraca agar menghitung:
-- 1. Modal Pemilik (kode 3100): MASUK (+), KELUAR (-)
-- 2. Prive (kode 3200): KELUAR (-), MASUK (+)
-- ============================================================

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
  select tk.outlet_id, 
    sum(
      case 
        when k.kode = '3100' and tk.tipe = 'MASUK' then tk.nominal
        when k.kode = '3100' and tk.tipe = 'KELUAR' then -tk.nominal
        when k.kode = '3200' and tk.tipe = 'KELUAR' then -tk.nominal
        when k.kode = '3200' and tk.tipe = 'MASUK' then tk.nominal
        else 0 
      end
    ) as total_modal
  from transaksi_keuangan tk
  join kategori_akun k on k.id = tk.kategori_id
  where k.kode in ('3100', '3200')
  group by tk.outlet_id
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
