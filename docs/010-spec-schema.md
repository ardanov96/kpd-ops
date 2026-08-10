# 🗄️ Schema SQL Final — 3 Modul

> **Dokumen ini adalah single source of truth untuk schema database.** Jika ada konflik dengan migration file, **dokumen ini yang menang** sampai migration di-update.

---

## 📑 Daftar Migration

| # | File | Isi | Dependensi |
|---|---|---|---|
| 001 | `001_init.sql` | Outlet, Profile, Kurir, Transaksi, UploadLogs | — |
| 002 | `002_daily_summary.sql` | View harian | 001 |
| 003 | `003_inventaris.sql` | Modul Inventaris | 001 |
| 004 | `004_akunting.sql` | Modul Akunting (tabel + trigger) | 003 |
| 005 | `005_pajak.sql` | Modul Pajak | 004 |
| 006 | `006_storage_recurring.sql` | Recurring transaction + RLS storage | 004 |

> **Urutan penting**: Migration harus dijalankan berurutan. Jangan skip nomor.

---

## 📦 Migration 003 — Inventaris

```sql
-- ============================================================
-- 003_inventaris.sql
-- Modul Inventaris — Barang Habis Pakai
-- ============================================================

-- Kategori barang habis pakai
create table if not exists kategori_inventaris (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id),  -- nullable: global category
  kode text unique not null,              -- 'PKG', 'ATK', 'PRL'
  nama text not null,                    -- 'Packaging', 'ATK', 'Perlengkapan'
  deskripsi text,
  created_at timestamptz default now()
);

-- Master barang
create table if not exists barang (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  kategori_id uuid references kategori_inventaris(id) not null,
  sku text,                              -- opsional, untuk auto-scan nanti
  nama text not null,
  satuan text not null default 'pcs',     -- pcs, box, roll, lembar, meter, pack
  stok_min numeric default 0,            -- alert jika di bawah
  harga_beli numeric default 0,          -- untuk avg price expense
  aktif boolean default true,
  created_at timestamptz default now()
);

-- Pergerakan stok
create table if not exists stok_movement (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  barang_id uuid references barang(id) not null,
  tipe text not null check (tipe in ('IN','OUT','ADJ')),
  qty numeric not null,
  harga_satuan numeric default 0,
  total numeric default 0,               -- qty * harga_satuan
  ref_type text,                         -- MANUAL | OPNAME | INVENTARIS_AUTO
  ref_id uuid,                           -- pointer ke opname / transaksi_keuangan
  keterangan text,
  tanggal date not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Header opname bulanan
create table if not exists opname (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  periode text not null,                 -- 'YYYY-MM'
  tanggal_opname date not null,
  status text default 'DRAFT',           -- DRAFT | FINAL
  catatan text,
  created_by uuid references profiles(id),
  finalized_at timestamptz,
  created_at timestamptz default now(),
  unique(outlet_id, periode)
);

-- Detail opname per barang
create table if not exists opname_item (
  id uuid primary key default gen_random_uuid(),
  opname_id uuid references opname(id) on delete cascade not null,
  barang_id uuid references barang(id) not null,
  qty_sistem numeric not null,           -- hasil hitungan view v_stok_aktual
  qty_fisik numeric not null,            -- input owner
  selisih numeric,                       -- fisik - sistem
  harga_satuan numeric,
  catatan text,
  unique(opname_id, barang_id)
);

-- View: stok terkini per barang
create or replace view v_stok_aktual as
select
  b.id as barang_id,
  b.outlet_id,
  b.nama,
  b.satuan,
  b.stok_min,
  coalesce(sum(
    case
      when m.tipe = 'IN'  then m.qty
      when m.tipe = 'OUT' then -m.qty
      when m.tipe = 'ADJ' then m.qty  -- bisa +/-
    end
  ), 0) as stok,
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
group by b.id, b.outlet_id, b.nama, b.satuan, b.stok_min;

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
  m.created_at
from stok_movement m
order by m.tanggal desc, m.created_at desc;

-- RLS
alter table kategori_inventaris enable row level security;
alter table barang           enable row level security;
alter table stok_movement    enable row level security;
alter table opname           enable row level security;
alter table opname_item      enable row level security;

-- Owner bisa semua
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

-- Staff read-only outlet sendiri
create policy "staff_read_kategori_inv" on kategori_inventaris
  for select using (true);  -- kategori global, semua bisa baca
create policy "staff_read_barang" on barang
  for select using (
    exists (select 1 from profiles where id = auth.uid() and outlet_id = barang.outlet_id)
  );
create policy "staff_read_stok" on stok_movement
  for select using (
    exists (select 1 from profiles where id = auth.uid() and outlet_id = stok_movement.outlet_id)
  );

-- Seed kategori default
insert into kategori_inventaris (kode, nama, deskripsi) values
  ('PKG', 'Packaging',         'Karton, lakban, plastik packing, bubble wrap'),
  ('ATK', 'ATK',               'Kertas print, tinta, label, dokumen'),
  ('PRL', 'Perlengkapan',      'Tali, strapping, alat packing lainnya'),
  ('LNN', 'Lain-lain',         'Kategori umum untuk barang lain')
on conflict (kode) do nothing;
```

---

## � Migration 004 — Akunting

```sql
-- ============================================================
-- 004_akunting.sql
-- Modul Akunting — Income, Expense, Closing
-- ============================================================

-- Master kategori akun (chart of accounts)
create table if not exists kategori_akun (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id),       -- nullable: global seed
  kode text unique not null,                   -- '4100', '5100'
  nama text not null,
  tipe text not null check (tipe in ('INCOME','EXPENSE','ASSET','LIABILITY','EQUITY')),
  parent_id uuid references kategori_akun(id),
  is_system boolean default false,             -- true = tidak bisa diedit
  urutan int default 0,
  created_at timestamptz default now()
);

-- Jurnal umum (semua transaksi keuangan)
create table if not exists transaksi_keuangan (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  tanggal date not null,
  tipe text not null check (tipe in ('MASUK','KELUAR','TRANSFER')),
  kategori_id uuid references kategori_akun(id) not null,
  sumber text not null check (sumber in (
    'MANUAL','INVENTARIS','KURIR','RECURRING','CLOSING','PRIVE'
  )),
  ref_id uuid,                                 -- pointer ke sumber
  nominal numeric not null,
  metode text check (metode in ('CASH','BANK','EWALLET')),
  keterangan text,
  lampiran_url text,                           -- path di Supabase Storage
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Periode closing (lock per bulan)
create table if not exists periode_closing (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  periode text not null,                       -- 'YYYY-MM'
  total_income numeric default 0,
  total_expense numeric default 0,
  laba numeric default 0,
  is_locked boolean default false,
  closed_at timestamptz,
  closed_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(outlet_id, periode)
);

-- View: Laba-Rugi per outlet per bulan
create or replace view v_laba_rugi as
select
  outlet_id,
  to_char(tanggal, 'YYYY-MM') as periode,
  sum(case when tipe = 'MASUK' then nominal else 0 end) as total_income,
  sum(case when tipe = 'KELUAR' then nominal else 0 end) as total_expense,
  sum(case when tipe = 'MASUK' then nominal
           when tipe = 'KELUAR' then -nominal
           else 0 end) as laba_kotor
from transaksi_keuangan
group by outlet_id, to_char(tanggal, 'YYYY-MM');

-- View: Cashflow per outlet per bulan per metode
create or replace view v_cashflow as
select
  outlet_id,
  to_char(tanggal, 'YYYY-MM') as periode,
  metode,
  sum(case when tipe = 'MASUK' then nominal
           when tipe = 'KELUAR' then -nominal
           else 0 end) as cashflow
from transaksi_keuangan
where metode is not null
group by outlet_id, to_char(tanggal, 'YYYY-MM'), metode;

-- View: Neraca sederhana (hanya Kas + Laba Ditahan di awal)
-- Akan lebih kompleks setelah ada aset/hutang
create or replace view v_neraca as
select
  outlet_id,
  -- Aset: kas & bank (sum dari cashflow)
  (select sum(case when tipe='MASUK' then nominal when tipe='KELUAR' then -nominal end)
   from transaksi_keuangan tk2
   where tk2.outlet_id = tk.outlet_id
   and tk2.metode is not null
  ) as total_aset,
  -- Equity: laba ditahan + modal (input manual)
  (select coalesce(sum(laba), 0) from periode_closing pc where pc.outlet_id = tk.outlet_id)
  as total_laba_ditahan,
  -- Liability: belum ada di MVP
  0 as total_liability
from transaksi_keuangan tk
group by outlet_id;

-- Function: hitung ulang laba untuk satu periode (idempotent)
create or replace function fn_closing_periode(p_outlet_id uuid, p_periode text)
returns void as $$
declare
  v_income numeric;
  v_expense numeric;
  v_laba numeric;
begin
  select
    coalesce(sum(case when tipe='MASUK' then nominal else 0 end), 0),
    coalesce(sum(case when tipe='KELUAR' then nominal else 0 end), 0)
  into v_income, v_expense
  from transaksi_keuangan
  where outlet_id = p_outlet_id
    and to_char(tanggal, 'YYYY-MM') = p_periode;

  v_laba := v_income - v_expense;

  insert into periode_closing (outlet_id, periode, total_income, total_expense, laba, is_locked, closed_at)
  values (p_outlet_id, p_periode, v_income, v_expense, v_laba, true, now())
  on conflict (outlet_id, periode) do update
    set total_income = excluded.total_income,
        total_expense = excluded.total_expense,
        laba = excluded.laba,
        is_locked = true,
        closed_at = now();
end;
$$ language plpgsql;

-- Trigger: auto-journal income dari transaksi (re-class omzet bulanan)
-- Catatan: ini aggregate, jadi tidak pakai trigger per-row.
-- Solusi: panggil function `fn_aggregate_income(outlet_id, periode)` setelah import.
-- Function ini idempotent: kalau sudah ada, skip.
create or replace function fn_aggregate_income(p_outlet_id uuid, p_periode text)
returns void as $$
declare
  v_kategori_id uuid;
  v_total numeric;
begin
  -- Ambil kategori Pendapatan Ekspedisi (kode 4100)
  select id into v_kategori_id from kategori_akun where kode = '4100' limit 1;
  if v_kategori_id is null then return; end if;

  -- Hitung net omzet dari transaksi
  select coalesce(sum(
    coalesce(total_biaya, 0) - coalesce(diskon_booking, 0)
    - coalesce(diskon_asuransi, 0) - coalesce(diskon_forward_rate, 0)
    - coalesce(diskon_pickup, 0)
  ), 0)
  into v_total
  from transaksi
  where outlet_id = p_outlet_id
    and to_char(tanggal, 'YYYY-MM') = p_periode;

  -- Idempotent: cek apakah sudah ada baris untuk periode ini
  if exists (
    select 1 from transaksi_keuangan
    where outlet_id = p_outlet_id
    and sumber = 'KURIR'
    and to_char(tanggal, 'YYYY-MM') = p_periode
  ) then return; end if;

  if v_total > 0 then
    insert into transaksi_keuangan (outlet_id, tanggal, tipe, kategori_id, sumber, nominal, metode, keterangan)
    values (
      p_outlet_id,
      (p_periode || '-01')::date,
      'MASUK',
      v_kategori_id,
      'KURIR',
      v_total,
      'BANK',  -- default; bisa di-edit manual
      'Auto-income dari import XLSX franchise, periode ' || p_periode
    );
  end if;
end;
$$ language plpgsql;

-- Trigger: auto-expense dari stok keluar (per row)
create or replace function fn_auto_expense_from_stok_out()
returns trigger as $$
declare
  v_kategori_id uuid;
begin
  if NEW.tipe <> 'OUT' then return NEW; end if;
  if NEW.ref_type = 'INVENTARIS_AUTO' then return NEW; end if;  -- hindari loop

  select id into v_kategori_id from kategori_akun where kode = '5100' limit 1;
  if v_kategori_id is null then return NEW; end if;

  insert into transaksi_keuangan (
    outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
  ) values (
    NEW.outlet_id,
    NEW.tanggal,
    'KELUAR',
    v_kategori_id,
    'INVENTARIS',
    NEW.id,
    NEW.total,
    'CASH',
    'Auto-expense dari stok keluar: ' || coalesce(NEW.keterangan, '')
  );

  NEW.ref_type := 'INVENTARIS_AUTO';
  return NEW;
end;
$$ language plpgsql;

create trigger trg_auto_expense_stok_out
after insert on stok_movement
for each row execute function fn_auto_expense_from_stok_out();

-- RLS
alter table kategori_akun     enable row level security;
alter table transaksi_keuangan enable row level security;
alter table periode_closing   enable row level security;

-- Owner full access
create policy "owner_all_kategori_akun" on kategori_akun
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));
create policy "owner_all_transaksi_keuangan" on transaksi_keuangan
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));
create policy "owner_all_periode_closing" on periode_closing
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));

-- Staff read outlet sendiri
create policy "staff_read_kategori_akun" on kategori_akun
  for select using (outlet_id is null or exists (
    select 1 from profiles where id=auth.uid() and outlet_id=kategori_akun.outlet_id
  ));
create policy "staff_read_transaksi_keuangan" on transaksi_keuangan
  for select using (exists (
    select 1 from profiles where id=auth.uid() and outlet_id=transaksi_keuangan.outlet_id
  ));
create policy "staff_read_periode_closing" on periode_closing
  for select using (exists (
    select 1 from profiles where id=auth.uid() and outlet_id=periode_closing.outlet_id
  ));

-- Seed kategori akun default
insert into kategori_akun (kode, nama, tipe, is_system, urutan) values
  -- Income
  ('4100', 'Pendapatan Ekspedisi',           'INCOME',  true, 1),
  ('4900', 'Pendapatan Lain-lain',           'INCOME',  true, 2),
  -- Expense
  ('5100', 'Beban ATK & Packaging',          'EXPENSE', true, 10),
  ('5200', 'Beban Internet (WiFi)',          'EXPENSE', true, 11),
  ('5300', 'Beban Listrik',                  'EXPENSE', true, 12),
  ('5400', 'Beban Perlengkapan Kantor',      'EXPENSE', true, 13),
  ('5500', 'Beban Sewa',                     'EXPENSE', true, 14),
  ('5900', 'Beban Lain-lain',                'EXPENSE', true, 99),
  -- Equity
  ('3100', 'Modal Pemilik',                  'EQUITY',  true, 1),
  ('3200', 'Prive',                          'EQUITY',  true, 2),
  ('3900', 'Laba Ditahan',                   'EQUITY',  true, 99)
on conflict (kode) do nothing;
```

---

## 🧾 Migration 005 — Pajak

```sql
-- ============================================================
-- 005_pajak.sql
-- Modul Pajak — PPh Final 0,5% (Non-PKP)
-- ============================================================

-- Config NPWP per outlet
create table if not exists pajak_config (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  npwp text,
  nama_wp text,
  metode_pph text default 'FINAL_05',   -- FINAL_05 (saja untuk MVP)
  pkp boolean default false,            -- selalu false untuk MVP
  omzet_tahunan numeric default 0,
  form_spt text default '1770S3',       -- asumsi, bisa diubah owner
  updated_at timestamptz default now()
);

-- Rekap pajak per bulan
create table if not exists pajak_rekap (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  periode text not null,                -- 'YYYY-MM'
  jenis_pajak text not null,            -- 'PPH_FINAL_05'
  dasar_pengenaan numeric default 0,
  tarif numeric default 0.5,            -- 0,5% (0.005) untuk PPh Final
  nilai_pajak numeric default 0,
  status_bayar text default 'BELUM' check (status_bayar in ('BELUM','LUNAS','BEAS')),
  tanggal_bayar date,
  bukti_url text,                       -- path di Supabase Storage bucket 'bukti-pajak'
  catatan text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique(outlet_id, periode, jenis_pajak)
);

-- View: SPT Tahunan Estimator (akumulasi 12 bulan)
create or replace view v_spt_tahunan_estimator as
select
  outlet_id,
  substring(periode, 1, 4) as tahun,
  sum(dasar_pengenaan) as total_omzet,
  sum(nilai_pajak) as total_pph_final,
  count(*) filter (where status_bayar = 'LUNAS') as bulan_lunas,
  count(*) as total_bulan
from pajak_rekap
where jenis_pajak = 'PPH_FINAL_05'
group by outlet_id, substring(periode, 1, 4);

-- RLS: owner only (data sensitif)
alter table pajak_config enable row level security;
alter table pajak_rekap  enable row level security;

create policy "owner_all_pajak_config" on pajak_config
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));
create policy "owner_all_pajak_rekap" on pajak_rekap
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));

-- Seed config default untuk outlet existing
insert into pajak_config (outlet_id, npwp, nama_wp)
select id, null, nama from outlets
on conflict (outlet_id) do nothing;
```

---

## 🔁 Migration 006 — Storage & Recurring

```sql
-- ============================================================
-- 006_storage_recurring.sql
-- Recurring transaction + Storage RLS
-- ============================================================

-- Template transaksi yang auto-generate tiap bulan
create table if not exists recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  kategori_id uuid references kategori_akun(id) not null,
  nama_template text not null,           -- 'WiFi Bulanan', 'Listrik'
  nominal numeric not null,
  metode text check (metode in ('CASH','BANK','EWALLET')),
  tanggal_setiap_bulan int check (tanggal_setiap_bulan between 1 and 31),
  tipe text not null check (tipe in ('MASUK','KELUAR')),
  aktif boolean default true,
  last_run timestamptz,
  created_at timestamptz default now()
);

-- Function: jalankan recurring (dipanggil cron tiap hari)
create or replace function fn_run_recurring()
returns void as $$
declare
  r record;
  v_tanggal date;
  v_periode text;
begin
  -- Loop semua template aktif yang jatuh tempo hari ini
  for r in
    select * from recurring_transactions
    where aktif = true
      and tanggal_setiap_bulan = extract(day from current_date)
  loop
    v_tanggal := current_date;
    v_periode := to_char(v_tanggal, 'YYYY-MM');

    -- Idempotent: skip jika sudah pernah generate bulan ini
    if exists (
      select 1 from transaksi_keuangan
      where outlet_id = r.outlet_id
      and sumber = 'RECURRING'
      and ref_id = r.id
      and to_char(tanggal, 'YYYY-MM') = v_periode
    ) then continue; end if;

    insert into transaksi_keuangan (
      outlet_id, tanggal, tipe, kategori_id, sumber, ref_id, nominal, metode, keterangan
    ) values (
      r.outlet_id, v_tanggal, r.tipe, r.kategori_id, 'RECURRING', r.id,
      r.nominal, r.metode, 'Auto dari recurring: ' || r.nama_template
    );

    update recurring_transactions set last_run = now() where id = r.id;
  end loop;
end;
$$ language plpgsql;

-- RLS
alter table recurring_transactions enable row level security;
create policy "owner_all_recurring" on recurring_transactions
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));

-- Storage RLS (jalankan via Supabase Dashboard SQL editor)
-- Asumsi bucket 'nota-expense' dan 'bukti-pajak' sudah dibuat manual

-- Policy untuk bucket nota-expense
-- (owner-only write, all auth read based on outlet_id)
create policy "owner_upload_nota" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nota-expense'
    and exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );

create policy "read_nota" on storage.objects
  for select to authenticated
  using (bucket_id = 'nota-expense');

-- Policy untuk bucket bukti-pajak (owner-only)
create policy "owner_upload_bukti_pajak" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bukti-pajak'
    and exists (select 1 from profiles where id = auth.uid() and role = 'owner')
  );
create policy "read_bukti_pajak" on storage.objects
  for select to authenticated
  using (bucket_id = 'bukti-pajak');
```

---

## 🔗 Hubungan Antar Tabel

```
┌──────────┐      ┌──────────┐      ┌────────────────────┐
│ outlets  │◄─────┤ barang   │◄─────┤ stok_movement      │
└──────────┘      └──────────┘      │ (IN/OUT/ADJ)       │
     ▲                              └─────────┬──────────┘
     │                                        │ trigger
     │                              ┌─────────▼──────────�
     │                              │ transaksi_keuangan │
     │                              │ (auto: INVENTARIS) │
     │                              └─────────┬──────────┘
     │                                        │
     │                  ┌─────────────────────┼─────────────────┐
     │                  │                     │                 │
     │          ┌───────▼──────┐      ┌───────▼─────�   ┌──────▼──────┐
     │          │ recurring_   │      │ manual      │   │ closing     │
     │          │ transactions │      │ expense     │   │ function    │
     │          └──────────────┘      └─────────────┘   └──────┬───────┘
     │                                                             │
     ▼                                                             ▼
┌──────────�                                             ┌────────────────┐
│ profiles │                                             │ periode_closing│
└──────────┘                                             └────────────────┘
                                                                 │
                                                                 ▼
                                                       ┌──────────────────┐
                                                       │ fn_aggregate_     │
                                                       │ income (from      │
                                                       │ transaksi)        │
                                                       └─────────┬────────┘
                                                                 ▼
                                                       ┌──────────────────┐
                                                       │ transaksi_       │
                                                       │ keuangan (KURIR)  │
                                                       └─────────┬────────┘
                                                                 │
                                                                 ▼
                                                       ┌──────────────────┐
                                                       │ fn_generate_     │
                                                       │ pph_final        │
                                                       └─────────┬────────┘
                                                                 ▼
                                                       ┌──────────────────�
                                                       │ pajak_rekap      │
                                                       └──────────────────┘
```
