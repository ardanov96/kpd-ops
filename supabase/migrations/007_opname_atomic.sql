-- ============================================================
-- 007_opname_atomic.sql
-- Fix Bug #2: Opname save + ADJ movement insert jadi atomic
-- Sprint 5 polish
-- ============================================================

-- Sebelumnya di API route /api/inventaris/opname, flow:
--   1. Upsert opname header (FINAL)
--   2. Delete existing opname_item
--   3. Insert new opname_item
--   4. Insert ADJ stok_movement
-- Rollback kalau step 3/4 gagal hanya delete header (best effort)
-- Bug: kalau step 4 gagal setelah step 3 success → opname_items ada tapi stok_movement ADJ tidak insert
--        → data inconsistent (stok tidak ter-update)

-- Solusi: pakai RPC function di Postgres. Semua step dalam 1 transaction.
--         Kalau ada yg gagal → ROLLBACK semua step.

create or replace function fn_save_opname_atomic(
  p_outlet_id uuid,
  p_periode text,
  p_tanggal_opname date,
  p_catatan text,
  p_items jsonb  -- array of {barang_id, qty_sistem, qty_fisik, selisih, harga_satuan, catatan}
) returns table (
  opname_id uuid,
  items_count int,
  adj_count int
) as $$
declare
  v_opname_id uuid;
  v_user_id uuid := auth.uid();
  v_items_count int := 0;
  v_adj_count int := 0;
  v_item record;
  v_movement record;
  v_old_opname_id uuid;
begin
  -- 1. Ambil opname lama (kalau ada) untuk ID
  select id into v_old_opname_id
  from opname
  where outlet_id = p_outlet_id and periode = p_periode
  limit 1;

  -- 2. Validasi: kalau opname lama sudah FINAL, tolak
  if v_old_opname_id is not null then
    if exists (
      select 1 from opname
      where id = v_old_opname_id and status = 'FINAL'
    ) and false then  -- sementara allow re-opname (user minta), toggle ke TRUE nanti
      raise exception 'Opname periode % sudah FINAL', p_periode;
    end if;
  end if;

  -- 3. Upsert opname header
  insert into opname (outlet_id, periode, tanggal_opname, status, catatan, created_by, finalized_at)
  values (p_outlet_id, p_periode, p_tanggal_opname, 'FINAL', p_catatan, v_user_id, now())
  on conflict (outlet_id, periode) do update set
    tanggal_opname = excluded.tanggal_opname,
    status = 'FINAL',
    catatan = excluded.catatan,
    finalized_at = now()
  returning id into v_opname_id;

  -- 4. Hapus opname_items lama
  delete from opname_item where opname_id = v_opname_id;

  -- 5. Insert opname_items + ADJ movements (ATOMIC)
  for v_item in
    select * from jsonb_to_recordset(p_items) as x(
      barang_id text,
      qty_sistem numeric,
      qty_fisik numeric,
      selisih numeric,
      harga_satuan numeric,
      catatan text
    )
  loop
    -- cast barang_id ke uuid
    declare v_barang_id uuid := v_item.barang_id::uuid;
    declare v_harga_satuan numeric := coalesce(v_item.harga_satuan, 0);

    -- Insert opname_item
    insert into opname_item (opname_id, barang_id, qty_sistem, qty_fisik, selisih, harga_satuan, catatan)
    values (
      v_opname_id, v_barang_id, v_item.qty_sistem, v_item.qty_fisik,
      v_item.selisih, v_harga_satuan, v_item.catatan
    );
    v_items_count := v_items_count + 1;

    -- Insert ADJ movement kalau selisih ≠ 0
    if v_item.selisih != 0 then
      insert into stok_movement (
        outlet_id, barang_id, tipe, qty, harga_satuan, total,
        ref_type, ref_id, keterangan, tanggal, created_by
      ) values (
        p_outlet_id, v_barang_id, 'ADJ', v_item.selisih, v_harga_satuan,
        v_item.selisih * v_harga_satuan, 'OPNAME', v_opname_id,
        coalesce(v_item.catatan, 'Auto-adjust dari opname ' || p_periode),
        p_tanggal_opname, v_user_id
      );
      v_adj_count := v_adj_count + 1;
    end if;
  end loop;

  return query select v_opname_id, v_items_count, v_adj_count;
end;
$$ language plpgsql security definer;

-- Grant access
grant execute on function fn_save_opname_atomic(uuid, text, date, text, jsonb) to authenticated;

-- ============================================================
-- CATATAN:
-- 1. Pakai `language plpgsql security definer` — function jalan sebagai
--    owner migration (bypass RLS) supaya bisa insert stok_movement.
-- 2. Kalau ada error di tengah loop → exception di-raise → transaction
--    rollback → opname_items + opname header + ADJ movements semua
--    tidak ter-commit.
-- 3. Update migration 003_inventaris.sql doc untuk mention function ini.
-- 4. Update API route /api/inventaris/opname untuk pakai RPC ini.
-- ============================================================