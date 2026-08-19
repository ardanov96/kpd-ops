-- ============================================================
-- 004_akunting.sql
-- Modul Akunting — Income, Expense, Closing, Recurring, Auto-journal
-- Jalankan SETELAH 003_inventaris.sql di Supabase SQL Editor
-- ============================================================

-- 1. MASTER KATEGORI AKUN (chart of accounts)
create table if not exists kategori_akun (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id),       -- nullable: global seed
  kode text unique not null,                   -- '4100', '5100'
  nama text not null,
  tipe text not null check (tipe in ('INCOME','EXPENSE','ASSET','LIABILITY','EQUITY')),
  parent_id uuid references kategori_akun(id),
  is_system boolean default false,             -- true = tidak bisa diedit owner
  urutan int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_kategori_akun_outlet on kategori_akun(outlet_id);
create index if not exists idx_kategori_akun_tipe on kategori_akun(tipe);

-- 2. JURNAL UMUM (semua transaksi keuangan)
create table if not exists transaksi_keuangan (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  tanggal date not null,
  tipe text not null check (tipe in ('MASUK','KELUAR','TRANSFER')),
  kategori_id uuid references kategori_akun(id) not null,
  sumber text not null check (sumber in (
    'MANUAL','INVENTARIS','KURIR','RECURRING','CLOSING','PRIVE'
  )),
  ref_id uuid,                                 -- pointer ke sumber (opsional)
  nominal numeric not null check (nominal >= 0),
  metode text check (metode in ('CASH','BANK','EWALLET')),
  keterangan text,
  lampiran_url text,                           -- path di Supabase Storage (Sprint 4)
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_tk_outlet on transaksi_keuangan(outlet_id);
create index if not exists idx_tk_tanggal on transaksi_keuangan(tanggal);
create index if not exists idx_tk_kategori on transaksi_keuangan(kategori_id);
create index if not exists idx_tk_sumber on transaksi_keuangan(sumber);
create index if not exists idx_tk_periode on transaksi_keuangan(outlet_id, tanggal);

-- 3. PERIODE CLOSING (lock per bulan + simpan laba)
create table if not exists periode_closing (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  periode text not null,                       -- 'YYYY-MM'
  total_income numeric default 0,
  total_expense numeric default 0,
  laba numeric default 0,                      -- income - expense
  is_locked boolean default false,
  closed_at timestamptz,
  closed_by uuid references profiles(id),
  catatan text,
  created_at timestamptz default now(),
  unique(outlet_id, periode)
);

-- 4. RECURRING TRANSACTIONS (template, auto-generate via cron)
create table if not exists recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) not null,
  kategori_id uuid references kategori_akun(id) not null,
  nama_template text not null,                 -- 'WiFi Bulanan', 'Listrik'
  nominal numeric not null,
  metode text check (metode in ('CASH','BANK','EWALLET')),
  tanggal_setiap_bulan int not null check (tanggal_setiap_bulan between 1 and 31),
  tipe text not null check (tipe in ('MASUK','KELUAR')),
  aktif boolean default true,
  last_run timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_recurring_outlet on recurring_transactions(outlet_id);
create index if not exists idx_recurring_aktif on recurring_transactions(aktif, tanggal_setiap_bulan);

-- ============================================================
-- VIEWS
-- ============================================================

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

-- View: Breakdown per kategori per bulan (untuk drill-down Laba-Rugi)
create or replace view v_keuangan_per_kategori as
select
  outlet_id,
  to_char(tanggal, 'YYYY-MM') as periode,
  kategori_id,
  k.kode as kategori_kode,
  k.nama as kategori_nama,
  k.tipe as kategori_tipe,
  sum(case when tipe = 'MASUK' then nominal else 0 end) as nominal_income,
  sum(case when tipe = 'KELUAR' then nominal else 0 end) as nominal_expense,
  count(*) as jumlah_transaksi
from transaksi_keuangan tk
join kategori_akun k on k.id = tk.kategori_id
group by outlet_id, to_char(tanggal, 'YYYY-MM'), kategori_id, k.kode, k.nama, k.tipe;

-- View: Neraca sederhana (MVP: Aset = Kas + Laba Ditahan)
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
  0 as total_aset_lain,        -- placeholder, belum ada piutang/inventaris-aset
  coalesce(k.total_kas, 0) as total_aset,
  0 as total_liability,        -- belum ada hutang di MVP
  coalesce(m.total_modal, 0) as total_modal_pemilik,
  coalesce(ld.total_laba_ditahan, 0) as total_laba_ditahan,
  coalesce(m.total_modal, 0) + coalesce(ld.total_laba_ditahan, 0) as total_equity,
  coalesce(k.total_kas, 0) - (coalesce(m.total_modal, 0) + coalesce(ld.total_laba_ditahan, 0)) as selisih
from outlets o
left join kas k on k.outlet_id = o.id
left join laba_ditahan ld on ld.outlet_id = o.id
left join modal m on m.outlet_id = o.id;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Function: hitung ulang closing per periode (idempotent via UPSERT)
create or replace function fn_closing_periode(p_outlet_id uuid, p_periode text, p_closed_by uuid)
returns void as $$
declare
  v_income numeric;
  v_expense numeric;
  v_laba numeric;
begin
  -- Hitung agregat
  select
    coalesce(sum(case when tipe='MASUK' then nominal else 0 end), 0),
    coalesce(sum(case when tipe='KELUAR' then nominal else 0 end), 0)
  into v_income, v_expense
  from transaksi_keuangan
  where outlet_id = p_outlet_id
    and to_char(tanggal, 'YYYY-MM') = p_periode;

  v_laba := v_income - v_expense;

  -- Idempotent upsert
  insert into periode_closing (
    outlet_id, periode, total_income, total_expense, laba, is_locked, closed_at, closed_by
  ) values (
    p_outlet_id, p_periode, v_income, v_expense, v_laba, true, now(), p_closed_by
  )
  on conflict (outlet_id, periode) do update
    set total_income = excluded.total_income,
        total_expense = excluded.total_expense,
        laba = excluded.laba,
        is_locked = true,
        closed_at = now(),
        closed_by = excluded.closed_by;
end;
$$ language plpgsql;

-- Function: aggregate income dari tabel transaksi per periode (idempotent)
-- Dipanggil manual dari API upload setelah XLSX sukses, atau dari cron harian.
create or replace function fn_aggregate_income(p_outlet_id uuid, p_periode text)
returns void as $$
declare
  v_kategori_id uuid;
  v_total numeric;
  v_exists int;
begin
  -- Ambil kategori Pendapatan Ekspedisi (kode 4100)
  select id into v_kategori_id from kategori_akun where kode = '4100' limit 1;
  if v_kategori_id is null then return; end if;

  -- Hitung net omzet dari transaksi bulan ini
  select coalesce(sum(
    coalesce(total_biaya::numeric, 0)
    - coalesce(diskon_booking::numeric, 0)
    - coalesce(diskon_asuransi::numeric, 0)
    - coalesce(diskon_forward_rate::numeric, 0)
    - coalesce(diskon_pickup::numeric, 0)
  ), 0)
  into v_total
  from transaksi
  where outlet_id = p_outlet_id
    and to_char(tanggal, 'YYYY-MM') = p_periode
    and status not in ('CNX');          -- exclude canceled

  if v_total is null or v_total <= 0 then
    return;                            -- tidak ada income, skip
  end if;

  -- Idempotent: cek apakah sudah ada baris KURIR untuk outlet+periode ini
  select count(*) into v_exists
  from transaksi_keuangan
  where outlet_id = p_outlet_id
    and sumber = 'KURIR'
    and kategori_id = v_kategori_id
    and to_char(tanggal, 'YYYY-MM') = p_periode;

  if v_exists > 0 then
    -- Update existing (hapus dulu supaya net omzet terbaru yang dipakai)
    delete from transaksi_keuangan
    where outlet_id = p_outlet_id
      and sumber = 'KURIR'
      and kategori_id = v_kategori_id
      and to_char(tanggal, 'YYYY-MM') = p_periode;
  end if;

  insert into transaksi_keuangan (
    outlet_id, tanggal, tipe, kategori_id, sumber, nominal, metode, keterangan
  ) values (
    p_outlet_id,
    (p_periode || '-01')::date,
    'MASUK',
    v_kategori_id,
    'KURIR',
    v_total,
    'BANK',                             -- default; bisa diedit manual
    'Auto-income dari XLSX periode ' || p_periode
  );
end;
$$ language plpgsql;

-- Function: auto-create EXPENSE saat stok keluar dicatat
-- Hanya fire untuk OUT dengan ref_type='MANUAL' (hindari loop)
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

drop trigger if exists trg_auto_expense_stok_out on stok_movement;
create trigger trg_auto_expense_stok_out
after insert on stok_movement
for each row execute function fn_auto_expense_from_stok_out();

-- Function: jalankan recurring (untuk cron job)
-- Aturan: tanggal_setiap_bulan yang lebih besar dari jumlah hari di bulan tsb → generate di last day
create or replace function fn_run_recurring(p_target_date date default current_date)
returns int as $$
declare
  r record;
  v_tanggal date;
  v_periode text;
  v_target_day int;
  v_count int := 0;
begin
  v_target_day := extract(day from p_target_date)::int;

  for r in
    select * from recurring_transactions
    where aktif = true
      and tanggal_setiap_bulan = v_target_day
  loop
    v_tanggal := p_target_date;
    v_periode := to_char(v_tanggal, 'YYYY-MM');

    -- Idempotent: skip kalau sudah pernah generate bulan ini
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
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$ language plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table kategori_akun       enable row level security;
alter table transaksi_keuangan  enable row level security;
alter table periode_closing     enable row level security;
alter table recurring_transactions enable row level security;

-- Owner: full access
create policy "owner_all_kategori_akun" on kategori_akun
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));
create policy "owner_all_transaksi_keuangan" on transaksi_keuangan
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));
create policy "owner_all_periode_closing" on periode_closing
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));
create policy "owner_all_recurring" on recurring_transactions
  for all using (exists (select 1 from profiles where id=auth.uid() and role='owner'));

-- Staff: read-only, scoped ke outlet sendiri (kecuali kategori_akun: global)
create policy "staff_read_kategori_akun" on kategori_akun
  for select using (outlet_id is null or exists (
    select 1 from profiles where id = auth.uid() and outlet_id = kategori_akun.outlet_id
  ));
create policy "staff_read_transaksi_keuangan" on transaksi_keuangan
  for select using (exists (
    select 1 from profiles where id = auth.uid() and outlet_id = transaksi_keuangan.outlet_id
  ));
create policy "staff_read_periode_closing" on periode_closing
  for select using (exists (
    select 1 from profiles where id = auth.uid() and outlet_id = periode_closing.outlet_id
  ));
create policy "staff_read_recurring" on recurring_transactions
  for select using (exists (
    select 1 from profiles where id = auth.uid() and outlet_id = recurring_transactions.outlet_id
  ));

-- ============================================================
-- SEED: 16 kategori akun (expanded untuk MVP lebih proper)
-- ============================================================
insert into kategori_akun (kode, nama, tipe, is_system, urutan) values
  -- Income (2)
  ('4100', 'Pendapatan Ekspedisi',                  'INCOME',   true,  1),
  ('4900', 'Pendapatan Lain-lain',                  'INCOME',   true,  2),
  -- Expense (9)
  ('5100', 'Beban ATK & Packaging',                 'EXPENSE',  true, 10),
  ('5150', 'Beban Operasional Harian',              'EXPENSE',  true, 11),
  ('5200', 'Beban Internet (WiFi)',                 'EXPENSE',  true, 20),
  ('5210', 'Beban Pulsa & Data Staff',              'EXPENSE',  true, 21),
  ('5300', 'Beban Listrik',                         'EXPENSE',  true, 30),
  ('5400', 'Beban Perlengkapan Kantor',             'EXPENSE',  true, 40),
  ('5500', 'Beban Sewa',                            'EXPENSE',  true, 50),
  ('5600', 'Beban Transportasi & Bensin',           'EXPENSE',  true, 60),
  ('5700', 'Beban Maintenance',                     'EXPENSE',  true, 70),
  ('5900', 'Beban Lain-lain',                       'EXPENSE',  true, 99),
  -- Equity (3)
  ('3100', 'Modal Pemilik',                         'EQUITY',   true,  1),
  ('3200', 'Prive',                                 'EQUITY',   true,  2),
  ('3900', 'Laba Ditahan',                          'EQUITY',   true, 99)
on conflict (kode) do nothing;

-- ============================================================
-- CATATAN:
-- 1. Trigger auto-expense sudah terpasang, sehingga SETIAP stok keluar
--    (ref_type='MANUAL') akan otomatis insert ke transaksi_keuangan
--    sumber='INVENTARIS', kategori 5100, nominal = qty*harga_satuan.
-- 2. Trigger auto-income TIDAK dipasang di level DB (resiko duplicate).
--    Sebagai gantinya, panggil fn_aggregate_income(outlet_id, 'YYYY-MM')
--    dari API upload setelah XLSX selesai, atau dari cron harian.
-- 3. Recurring transaction: jalankan cron harian via API /api/cron/run-recurring.
--    Function fn_run_recurring() return jumlah transaksi yang ter-generate.
-- ============================================================
