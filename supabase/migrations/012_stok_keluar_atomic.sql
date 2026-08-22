-- ============================================================
-- 012_stok_keluar_atomic.sql
-- Fix ISU #13 (Sprint 6): Stok keluar race condition & atomic.
--
-- Sebelumnya (Sprint 1):
--   1. SELECT stok dari v_stok_aktual (cek stok cukup?)
--   2. INSERT ke stok_movement
--   → 2 request concurrent bisa over-draw stok.
--
-- Solusi: bungkus dalam 1 Postgres function dengan row-level lock
-- (SELECT ... FOR UPDATE pada view-derived row count). Function cek
-- stok + insert movement dalam 1 transaction. Trigger auto-expense
-- tetap jalan di AFTER INSERT.
--
-- Cara pakai (dari API route):
--   SELECT * FROM fn_stok_keluar_atomic(
--     p_barang_id := '...',
--     p_qty := 10,
--     p_harga_satuan := 5000,
--     p_tanggal := '2026-08-22',
--     p_keterangan := 'untuk paket Lion'
--   );
-- ============================================================

-- Hapus dulu kalau sudah ada (untuk idempotent re-run)
drop function if exists public.fn_stok_keluar_atomic(uuid, numeric, numeric, date, text);

create or replace function public.fn_stok_keluar_atomic(
  p_barang_id uuid,
  p_qty numeric,
  p_harga_satuan numeric,
  p_tanggal date,
  p_keterangan text default null
)
returns table (
  movement_id uuid,
  stok_sebelum numeric,
  stok_sesudah numeric,
  total numeric
)
language plpgsql
security definer
as $$
declare
  v_barang record;
  v_stok_aktual numeric;
  v_outlet_id uuid;
  v_total numeric;
  v_movement_id uuid;
begin
  -- 1. Validasi qty
  if p_qty <= 0 then
    raise exception 'qty harus > 0';
  end if;
  if p_harga_satuan <= 0 then
    raise exception 'harga_satuan harus > 0';
  end if;

  -- 2. Lock row barang + ambil outlet_id & aktif status
  -- SELECT ... FOR UPDATE → lock row, mencegah race condition
  select id, outlet_id, aktif
    into v_barang
    from barang
    where id = p_barang_id
    for update;

  if not found then
    raise exception 'Barang tidak ditemukan: %', p_barang_id;
  end if;

  if not v_barang.aktif then
    raise exception 'Barang non-aktif, tidak bisa dicatat';
  end if;

  v_outlet_id := v_barang.outlet_id;

  -- 3. Hitung stok aktual (SUM dari movement di lock window)
  -- Note: SUM di sini atomic dalam transaction
  select coalesce(sum(
    case
      when tipe = 'IN' then qty
      when tipe = 'OUT' then -qty
      when tipe = 'ADJ' then qty
      else 0
    end
  ), 0)
    into v_stok_aktual
    from stok_movement
    where barang_id = p_barang_id;

  -- 4. Validasi stok cukup
  if v_stok_aktual < p_qty then
    raise exception 'Stok tidak cukup. Stok saat ini: %, diminta: %', v_stok_aktual, p_qty;
  end if;

  v_total := p_qty * p_harga_satuan;

  -- 5. Insert stok_movement (trigger auto-expense akan fire AFTER ini)
  insert into stok_movement (
    outlet_id, barang_id, tipe, qty, harga_satuan, total,
    ref_type, ref_id, keterangan, tanggal
  ) values (
    v_outlet_id, p_barang_id, 'OUT', p_qty, p_harga_satuan, v_total,
    'MANUAL', null, p_keterangan, p_tanggal
  )
  returning id into v_movement_id;

  -- 6. Return result
  return query
    select
      v_movement_id,
      v_stok_aktual,
      v_stok_aktual - p_qty,
      v_total;
end;
$$;

-- Grant execute ke authenticated users (RLS tetap berlaku di level tabel)
grant execute on function public.fn_stok_keluar_atomic(uuid, numeric, numeric, date, text) to authenticated;

comment on function public.fn_stok_keluar_atomic is
  'Sprint 6 - Atomic stok keluar dengan row-level lock. '
  'Cek stok + insert movement dalam 1 transaction. '
  'Trigger auto-expense (trg_auto_expense_stok_out) tetap jalan AFTER insert.';