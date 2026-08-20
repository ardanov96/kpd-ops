-- ============================================================
-- 005_pajak.sql
-- Modul Pajak — PPh Final 0,5% (Non-PKP)
-- Jalankan SETELAH 004_akunting.sql di Supabase SQL Editor
-- ============================================================

-- 1. CONFIG PAJAK per outlet (1 row per outlet)
create table if not exists pajak_config (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  npwp text,
  nama_wp text,
  metode_pph text default 'FINAL_05',       -- FINAL_05 (saja untuk MVP)
  pkp boolean default false,                -- selalu false untuk MVP (Non-PKP)
  omzet_tahunan numeric default 0,
  form_spt text default '1770S3',           -- asumsi, bisa diubah owner
  updated_at timestamptz default now()
);

-- 2. REKAP PAJAK per bulan per jenis pajak
create table if not exists pajak_rekap (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  periode text not null,                    -- 'YYYY-MM'
  jenis_pajak text not null,                -- 'PPH_FINAL_05'
  dasar_pengenaan numeric default 0,
  tarif numeric default 0.5,                -- 0,5% (0.005) untuk PPh Final — disimpan sebagai 0.5 (persen)
  nilai_pajak numeric default 0,
  status_bayar text default 'BELUM' check (status_bayar in ('BELUM','LUNAS','BEAS')),
  tanggal_bayar date,
  bukti_url text,                           -- path/url bukti SSP (upload UI di Sprint 4)
  catatan text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(outlet_id, periode, jenis_pajak)
);
create index if not exists idx_pajak_rekap_outlet on pajak_rekap(outlet_id);
create index if not exists idx_pajak_rekap_periode on pajak_rekap(outlet_id, periode);
create index if not exists idx_pajak_rekap_status on pajak_rekap(status_bayar);

-- ============================================================
-- VIEWS
-- ============================================================

-- View: SPT Tahunan Estimator (akumulasi 12 bulan per tahun)
create or replace view v_spt_tahunan_estimator as
select
  outlet_id,
  substring(periode, 1, 4) as tahun,
  sum(dasar_pengenaan) as total_omzet,
  sum(nilai_pajak) as total_pph_final,
  count(*) filter (where status_bayar = 'LUNAS') as bulan_lunas,
  count(*) filter (where status_bayar = 'BELUM') as bulan_belum,
  count(*) as total_bulan
from pajak_rekap
where jenis_pajak = 'PPH_FINAL_05'
group by outlet_id, substring(periode, 1, 4);

-- View: reminder jatuh tempo (bulan sebelumnya yang BELUM bayar)
-- Menandai row pajak_rekap yang status='BELUM' dan jatuh tempo <= hari ini
create or replace view v_pajak_reminder as
select
  pr.id,
  pr.outlet_id,
  pr.periode,
  pr.jenis_pajak,
  pr.nilai_pajak,
  pr.status_bayar,
  -- Jatuh tempo = tanggal 15 bulan setelahnya (YYYY-MM+1, day=15)
  (
    (substring(pr.periode, 1, 4)::int
     + case when substring(pr.periode, 6, 2)::int = 12 then 1 else 0 end
    )::text || '-' ||
    lpad(
      case when substring(pr.periode, 6, 2)::int = 12 then 1
           else substring(pr.periode, 6, 2)::int + 1
      end::text, 2, '0'
    ) || '-15'
  )::date as tanggal_jatuh_tempo,
  -- Sisa hari sampai jatuh tempo (negatif = sudah lewat)
  (
    (substring(pr.periode, 1, 4)::int
     + case when substring(pr.periode, 6, 2)::int = 12 then 1 else 0 end
    )::text || '-' ||
    lpad(
      case when substring(pr.periode, 6, 2)::int = 12 then 1
           else substring(pr.periode, 6, 2)::int + 1
      end::text, 2, '0'
    ) || '-15'
  )::date - current_date as sisa_hari
from pajak_rekap pr
where pr.status_bayar = 'BELUM'
  and pr.jenis_pajak = 'PPH_FINAL_05';

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function: generate / update rekap PPh Final 0,5% per outlet per periode
-- Logika:
--   1. Ambil total_income bulan ini dari v_laba_rugi
--   2. Hitung nilai_pajak = dasar * 0.005
--   3. Insert/update idempotent (unique outlet+periode+jenis_pajak)
-- Dipanggil dari:
--   - fn_closing_periode (auto, di migration 006 patch)
--   - API POST /api/pajak/generate-rekap (manual)
create or replace function fn_generate_pph_final_rekap(p_outlet_id uuid, p_periode text)
returns table (
  id uuid,
  dasar_pengenaan numeric,
  nilai_pajak numeric,
  status text
) as $$
declare
  v_dasar numeric;
  v_tarif_persen numeric := 0.5;        -- 0.5%
  v_tarif_desimal numeric := 0.005;     -- 0.005 untuk hitung
  v_nilai numeric;
  v_id uuid;
begin
  -- Ambil income bulan ini dari v_laba_rugi (idempotent — sumber tunggal)
  select total_income into v_dasar
  from v_laba_rugi
  where outlet_id = p_outlet_id
    and periode = p_periode;

  v_dasar := coalesce(v_dasar, 0);

  -- Kalau tidak ada income, skip (tidak generate rekap kosong)
  if v_dasar <= 0 then
    return query select null::uuid, 0::numeric, 0::numeric, 'SKIP_NO_INCOME'::text;
    return;
  end if;

  v_nilai := v_dasar * v_tarif_desimal;

  -- Idempotent insert/update
  insert into pajak_rekap (
    outlet_id, periode, jenis_pajak, dasar_pengenaan, tarif, nilai_pajak, status_bayar
  ) values (
    p_outlet_id, p_periode, 'PPH_FINAL_05', v_dasar, v_tarif_persen, v_nilai, 'BELUM'
  )
  on conflict (outlet_id, periode, jenis_pajak) do update
    set dasar_pengenaan = excluded.dasar_pengenaan,
        tarif = excluded.tarif,
        nilai_pajak = excluded.nilai_pajak,
        -- Jangan reset status_bayar jika sudah LUNAS (preserve manual edit)
        status_bayar = case
          when pajak_rekap.status_bayar in ('LUNAS', 'BEAS') then pajak_rekap.status_bayar
          else 'BELUM'
        end
  returning pajak_rekap.id into v_id;

  return query
    select v_id, v_dasar, v_nilai, 'OK'::text;
end;
$$ language plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table pajak_config  enable row level security;
alter table pajak_rekap   enable row level security;

-- Owner only — data pajak sensitif
create policy "owner_all_pajak_config" on pajak_config
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'owner'));
create policy "owner_all_pajak_rekap" on pajak_rekap
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'owner'));

-- ============================================================
-- SEED: default config untuk outlet existing
-- ============================================================
insert into pajak_config (outlet_id, npwp, nama_wp)
select id, null, nama from outlets
on conflict (outlet_id) do nothing;

-- ============================================================
-- CATATAN:
-- 1. Rekap PPh Final di-generate OTOMATIS oleh fn_closing_periode
--    (lihat migration 006 patch). Manual trigger via API juga tersedia.
-- 2. Upload bukti SSP ke Supabase Storage bucket 'bukti-pajak' adalah Sprint 4.
--    Saat ini field bukti_url = TEXT (nullable) — Owner bisa paste URL manual.
-- 3. Status 'BEAS' digunakan untuk bulan yang dibebaskan (misal omset < 4.8M,
--    sesuai PP 23/2018 — tapi saat ini owner tidak wajib bayar).
-- 4. PDF SPT generator adalah Sprint 5; saat ini hanya export XLSX.
-- ============================================================
