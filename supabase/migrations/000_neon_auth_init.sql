-- ============================================================
-- 000_neon_auth_init.sql
-- Penyesuaian tabel Profiles untuk PostgreSQL (Neon.tech)
-- tanpa dependensi Supabase Auth (auth.users)
-- ============================================================

-- Outlets (Master Cabang)
create table if not exists outlets (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,
  nama text not null,
  alamat text,
  kota text,
  created_at timestamptz default now()
);

-- Profiles (User Management terpusat di Postgres)
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  nama text not null,
  role text not null default 'staff' check (role in ('owner','admin','staff')),
  outlet_id uuid references outlets(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_profiles_outlet on profiles(outlet_id);
