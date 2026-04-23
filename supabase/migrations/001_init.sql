-- ============================================================
-- EKSPEDISI MULTI-FRANCHISE DASHBOARD
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. OUTLETS (cabang/agen)
create table if not exists outlets (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  alamat text,
  kota text,
  created_at timestamptz default now()
);

-- 2. USERS (sudah dihandle Supabase Auth, ini untuk profile)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  role text not null default 'staff' check (role in ('owner','admin','staff')),
  outlet_id uuid references outlets(id),
  created_at timestamptz default now()
);

-- 3. KURIR
create table if not exists kurir (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,  -- 'LION', 'JNE', 'WAHANA', 'JNT'
  nama text not null,
  warna text default '#f97316', -- hex color untuk UI
  created_at timestamptz default now()
);

-- 4. TRANSAKSI (tabel utama, normalisasi dari semua laporan kurir)
create table if not exists transaksi (
  id uuid primary key default gen_random_uuid(),
  
  -- Identitas
  outlet_id uuid references outlets(id) not null,
  kurir_id  uuid references kurir(id) not null,
  nomor_stt text not null,
  tanggal   date not null,
  
  -- Pengiriman
  jenis_kiriman text default 'NON-COD',  -- NON-COD / COD
  kota_tujuan   text,
  kecamatan_tujuan text,
  nama_produk   text,   -- REGPACK, BOSSPACK, JAGOPACK, dll
  komoditas     text,
  koli          int default 1,
  berat_volume  numeric(10,3) default 0,
  berat_kotor   numeric(10,3) default 0,
  berat_kena_biaya numeric(10,3) default 0,
  
  -- Biaya
  publish_rate        bigint default 0,
  shipping_surcharge  bigint default 0,
  forward_rate        bigint default 0,
  biaya_asuransi      bigint default 0,
  biaya_cod           bigint default 0,
  total_sebelum_potongan bigint default 0,
  potongan            bigint default 0,
  total_biaya         bigint default 0,
  total_cod           bigint default 0,
  
  -- Diskon
  diskon_booking      bigint default 0,
  diskon_pickup       bigint default 0,
  diskon_asuransi     bigint default 0,
  diskon_forward_rate bigint default 0,
  
  -- Pajak
  bm  bigint default 0,
  ppn bigint default 0,
  pph bigint default 0,
  
  -- Status
  status text default 'PENDING', -- POD, CNX, PENDING, TRANSIT, dll
  
  -- Meta
  raw_data jsonb, -- simpan row asli untuk audit
  created_at timestamptz default now(),
  
  unique(kurir_id, nomor_stt)
);

-- 5. UPLOAD LOG (track history import file)
create table if not exists upload_logs (
  id uuid primary key default gen_random_uuid(),
  outlet_id   uuid references outlets(id),
  kurir_id    uuid references kurir(id),
  uploaded_by uuid references profiles(id),
  filename    text not null,
  periode     text,  -- e.g. '2026-03'
  total_rows  int default 0,
  success_rows int default 0,
  error_rows  int default 0,
  errors      jsonb,
  created_at  timestamptz default now()
);

-- ============================================================
-- INDEXES untuk performa query dashboard
-- ============================================================
create index if not exists idx_transaksi_outlet   on transaksi(outlet_id);
create index if not exists idx_transaksi_kurir    on transaksi(kurir_id);
create index if not exists idx_transaksi_tanggal  on transaksi(tanggal);
create index if not exists idx_transaksi_status   on transaksi(status);
create index if not exists idx_transaksi_tgl_outlet on transaksi(tanggal, outlet_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table outlets    enable row level security;
alter table profiles   enable row level security;
alter table transaksi  enable row level security;
alter table upload_logs enable row level security;

-- Owner bisa lihat semua
create policy "owner_all" on transaksi
  for all using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'owner'
    )
  );

-- Staff hanya lihat outlet sendiri
create policy "staff_own_outlet" on transaksi
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.outlet_id = transaksi.outlet_id
    )
  );

-- Profile: user hanya lihat diri sendiri
create policy "profiles_self" on profiles
  for all using (auth.uid() = id);

-- Owner lihat semua profile
create policy "owner_see_all_profiles" on profiles
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- ============================================================
-- SEED DATA AWAL
-- ============================================================

-- Insert outlet contoh
insert into outlets (kode, nama, alamat, kota) values
  ('KEPUNDUNG-1', 'Outlet Kepundung', 'Jl. Kepundung No. 1', 'Denpasar')
on conflict (kode) do nothing;

-- Insert kurir
insert into kurir (kode, nama, warna) values
  ('LION',   'Lion Parcel',   '#f97316'),
  ('JNE',    'JNE Express',   '#ef4444'),
  ('WAHANA', 'Wahana Express','#3b82f6'),
  ('JNT',    'J&T Express',   '#22c55e')
on conflict (kode) do nothing;

-- ============================================================
-- VIEWS untuk kemudahan query dashboard
-- ============================================================

-- Summary per kurir per bulan
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
  sum(t.total_biaya - t.diskon_booking) as net_omzet,
  sum(case when t.status = 'POD' then 1 else 0 end) as pod_count,
  sum(case when t.status = 'CNX' then 1 else 0 end) as cnx_count,
  round(
    sum(case when t.status = 'POD' then 1 else 0 end)::numeric
    / nullif(count(*), 0) * 100, 1
  ) as pod_rate
from transaksi t
join outlets o on o.id = t.outlet_id
join kurir k   on k.id = t.kurir_id
group by o.nama, k.nama, k.warna, to_char(t.tanggal, 'YYYY-MM');

-- Top tujuan
create or replace view v_top_tujuan as
select
  k.kode as kurir,
  t.kota_tujuan,
  to_char(t.tanggal, 'YYYY-MM') as periode,
  count(*) as jumlah,
  sum(t.total_biaya) as total_omzet
from transaksi t
join kurir k on k.id = t.kurir_id
group by k.kode, t.kota_tujuan, to_char(t.tanggal, 'YYYY-MM')
order by jumlah desc;
