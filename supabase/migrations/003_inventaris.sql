-- ============================================================
-- 003_inventaris.sql
-- Modul Inventaris — Barang Habis Pakai (Consumables)
-- Jalankan SETELAH 001_init.sql di Supabase SQL Editor
-- ============================================================

-- 1. KATEGORI BARANG (consumables)
create table if not exists kategori_inventaris (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id),  -- nullable = global category
  kode text unique not null,              -- 'PKG', 'ATK', 'PRL'
  nama text not null,                     -- 'Packaging', 'ATK', 'Perlengkapan'
  deskripsi text,
  created_at timestamptz default now()
);

-- 2. MASTER BARANG
create table if not exists barang (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  kategori_id uuid references kategori_inventaris(id) not null,
  sku text,                               -- opsional, untuk auto-scan nanti
  nama text not null,
  satuan text not null default 'pcs',     -- pcs, box, roll, lembar, meter, pack
  stok_min numeric default 0,             -- alert jika di bawah
  harga_beli numeric default 0,           -- untuk avg price expense
  aktif boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_barang_outlet on barang(outlet_id);
create index if not exists idx_barang_kategori on barang(kategori_id);

-- 3. PERGERAKAN STOK (IN/OUT/ADJ)
create table if not exists stok_movement (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  barang_id uuid references barang(id) not null,
  tipe text not null check (tipe in ('IN','OUT','ADJ')),
  qty numeric not null,
  harga_satuan numeric default 0,
  total numeric default 0,                -- qty * harga_satuan
  ref_type text,                          -- MANUAL | OPNAME | INVENTARIS_AUTO
  ref_id uuid,                            -- pointer ke opname / transaksi_keuangan
  keterangan text,
  tanggal date not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_stok_movement_barang on stok_movement(barang_id);
create index if not exists idx_stok_movement_tanggal on stok_movement(tanggal);
create index if not exists idx_stok_movement_outlet on stok_movement(outlet_id);

-- 4. HEADER OPNAME BULANAN
create table if not exists opname (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  periode text not null,                  -- 'YYYY-MM'
  tanggal_opname date not null,
  status text default 'DRAFT' check (status in ('DRAFT','FINAL')),
  catatan text,
  created_by uuid references profiles(id),
  finalized_at timestamptz,
  created_at timestamptz default now(),
  unique(outlet_id, periode)
);

-- 5. DETAIL OPNAME PER BARANG
create table if not exists opname_item (
  id uuid primary key default gen_random_uuid(),
  opname_id uuid references opname(id) on delete cascade not null,
  barang_id uuid references barang(id) not null,
  qty_sistem numeric not null,            -- hasil hitungan view v_stok_aktual
  qty_fisik numeric not null,             -- input owner
  selisih numeric,                        -- fisik - sistem
  harga_satuan numeric,
  catatan text,
  unique(opname_id, barang_id)
);

-- ============================================================
-- VIEWS
-- ============================================================

-- View: stok terkini per barang (gabungan IN/OUT/ADJ)
create or replace view v_stok_aktual as
select
  b.id as barang_id,
  b.outlet_id,
  b.kategori_id,
  b.sku,
  b.nama,
  b.satuan,
  b.stok_min,
  b.harga_beli,
  b.aktif,
  coalesce(sum(
    case
      when m.tipe = 'IN'  then m.qty
      when m.tipe = 'OUT' then -m.qty
      when m.tipe = 'ADJ' then m.qty
    end
  ), 0) as stok,
  coalesce(sum(
    case
      when m.tipe = 'IN'  then m.qty * coalesce(m.harga_satuan, 0)
      else 0
    end
  ), 0) as total_nilai_masuk,
  case
    when coalesce(sum(
      case
        when m.tipe = 'IN'  then m.qty
        when m.tipe = 'OUT' then -m.qty
      end
    ), 0) <= b.stok_min then true
    else false
  end as is_below_min
from barang b
left join stok_movement m on m.barang_id = b.id
where b.aktif = true
group by b.id, b.outlet_id, b.kategori_id, b.sku, b.nama, b.satuan,
         b.stok_min, b.harga_beli, b.aktif;

-- View: kartu stok per barang
create or replace view v_kartu_stok as
select
  m.barang_id,
  m.outlet_id,
  m.tanggal,
  m.tipe,
  m.qty,
  m.harga_satuan,
  m.total,
  m.keterangan,
  m.ref_type,
  m.ref_id,
  m.created_at
from stok_movement m
order by m.tanggal desc, m.created_at desc;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table kategori_inventaris enable row level security;
alter table barang           enable row level security;
alter table stok_movement    enable row level security;
alter table opname           enable row level security;
alter table opname_item      enable row level security;

-- Owner: full access
create policy "owner_all_kategori_inv" on kategori_inventaris
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );
create policy "owner_all_barang" on barang
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );
create policy "owner_all_stok" on stok_movement
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );
create policy "owner_all_opname" on opname
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );
create policy "owner_all_opname_item" on opname_item
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );

-- Staff: read-only, scoped ke outlet sendiri
create policy "staff_read_kategori_inv" on kategori_inventaris
  for select using (true);
create policy "staff_read_barang" on barang
  for select using (
    exists (select 1 from profiles where id = auth.uid() and outlet_id = barang.outlet_id)
  );
create policy "staff_read_stok" on stok_movement
  for select using (
    exists (select 1 from profiles where id = auth.uid() and outlet_id = stok_movement.outlet_id)
  );
create policy "staff_read_opname" on opname
  for select using (
    exists (select 1 from profiles where id = auth.uid() and outlet_id = opname.outlet_id)
  );
create policy "staff_read_opname_item" on opname_item
  for select using (
    exists (
      select 1 from opname o
      join profiles p on p.id = auth.uid()
      where o.id = opname_item.opname_id and o.outlet_id = p.outlet_id
    )
  );

-- ============================================================
-- SEED KATEGORI DEFAULT
-- ============================================================
insert into kategori_inventaris (kode, nama, deskripsi) values
  ('PKG', 'Packaging',         'Karton, lakban, plastik packing, bubble wrap'),
  ('ATK', 'ATK',               'Kertas print, tinta, label, dokumen'),
  ('PRL', 'Perlengkapan',      'Tali, strapping, alat packing lainnya'),
  ('LNN', 'Lain-lain',         'Kategori umum untuk barang lain')
on conflict (kode) do nothing;

-- ============================================================
-- CATATAN:
-- Trigger auto-journal stok keluar -> transaksi_keuangan
-- akan dipasang di migration 004 (Sprint 2 — Modul Akunting).
-- ============================================================
