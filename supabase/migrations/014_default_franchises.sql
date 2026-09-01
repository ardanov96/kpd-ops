-- ============================================================
-- 014_default_franchises.sql
-- Inisialisasi Default Franchise Ekspedisi (Lion Parcel & JNE)
-- ============================================================

-- 1. Pastikan tabel kurir dan kolom-kolomnya siap
create table if not exists kurir (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  warna text default '#f97316',
  telepon text,
  portal_url text,
  keterangan text,
  aktif boolean default true,
  created_at timestamptz default now()
);

alter table if exists kurir add column if not exists telepon text;
alter table if exists kurir add column if not exists portal_url text;
alter table if exists kurir add column if not exists keterangan text;
alter table if exists kurir add column if not exists aktif boolean default true;

-- 2. Pastikan tabel outlets minimal punya 1 default outlet jika belum ada
create table if not exists outlets (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  alamat text,
  kota text,
  created_at timestamptz default now()
);

insert into outlets (id, kode, nama, alamat, kota)
values (
  '00000000-0000-0000-0000-000000000001',
  'DEFAULT-OUTLET',
  'Outlet Utama',
  'Pusat Operasional',
  'Denpasar'
)
on conflict (kode) do nothing;

-- 3. Inisialisasi default franchise: Lion Parcel & JNE Express
insert into kurir (id, kode, nama, warna, portal_url, keterangan, aktif)
values
  (
    '00000000-0000-0000-0000-000000000010',
    'LION',
    'Lion Parcel',
    '#f97316',
    'https://genesis.lionparcel.com',
    'Franchise Ekspedisi Lion Parcel (Genesis)',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000020',
    'JNE',
    'JNE Express',
    '#ef4444',
    'https://myjne.jne.co.id',
    'Franchise Ekspedisi JNE Express (MyJNE)',
    true
  )
on conflict (kode) do update set
  nama = excluded.nama,
  warna = excluded.warna,
  portal_url = coalesce(kurir.portal_url, excluded.portal_url),
  keterangan = coalesce(kurir.keterangan, excluded.keterangan),
  aktif = true;
