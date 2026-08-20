-- ============================================================
-- 006_storage_recurring.sql
-- Sprint 4: Storage RLS policies untuk nota-expense & bukti-pajak
-- CATATAN:
--   1. Bucket `nota-expense` & `bukti-pajak` harus dibuat MANUAL
--      di Supabase Dashboard (tasks 4.1 & 4.2 — Owner action).
--   2. Tabel recurring_transactions sudah ada di 004_akunting.sql
--      (sudah include function `fn_run_recurring` idempotent).
--      Migration ini HANYA menambahkan Storage RLS + helper functions.
--   3. Default bucket config: PRIVATE (recommended).
--      File diakses lewat signed URL yang di-generate dari server-side
--      API route (lihat src/app/api/storage/*).
-- ============================================================

-- ============================================================
-- Helper function: cek apakah user adalah owner
-- (reuse pattern dari migration 004 & 005)
-- ============================================================
create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'owner'
  );
$$;

-- ============================================================
-- STORAGE POLICIES: nota-expense (foto nota ATK, listrik, WiFi)
-- ============================================================

-- Hapus policy lama kalau ada (idempotent)
drop policy if exists "owner_upload_nota" on storage.objects;
drop policy if exists "staff_read_nota_outlet" on storage.objects;
drop policy if exists "owner_update_nota" on storage.objects;
drop policy if exists "owner_delete_nota" on storage.objects;
drop policy if exists "public_read_nota" on storage.objects;

-- 1. INSERT: Owner-only upload ke bucket nota-expense
create policy "owner_upload_nota" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nota-expense'
    and is_owner()
  );

-- 2. SELECT: Owner bisa baca semua, staff hanya bisa baca dari outlet sendiri
-- Path convention: nota-expense/{outlet_id}/{transaksi_id}-{filename}
-- Untuk MVP, kita pakai policy sederhana: semua authenticated bisa baca nota-expense.
-- RLS lebih ketat (per-outlet) bisa ditambah di fase berikutnya.
create policy "authenticated_read_nota" on storage.objects
  for select to authenticated
  using (bucket_id = 'nota-expense');

-- 3. UPDATE: Owner bisa update (rename) file nota
create policy "owner_update_nota" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'nota-expense'
    and is_owner()
  );

-- 4. DELETE: Owner-only hapus nota
create policy "owner_delete_nota" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'nota-expense'
    and is_owner()
  );

-- ============================================================
-- STORAGE POLICIES: bukti-pajak (foto/PDF SSP PPh Final)
-- Owner-only (data NPWP sensitif — sesuai D-006 modul pajak)
-- ============================================================

drop policy if exists "owner_upload_bukti_pajak" on storage.objects;
drop policy if exists "owner_read_bukti_pajak" on storage.objects;
drop policy if exists "owner_delete_bukti_pajak" on storage.objects;
drop policy if exists "owner_update_bukti_pajak" on storage.objects;

-- 1. INSERT: Owner-only upload SSP
create policy "owner_upload_bukti_pajak" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bukti-pajak'
    and is_owner()
  );

-- 2. SELECT: Owner-only read (data SSP sensitif)
create policy "owner_read_bukti_pajak" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'bukti-pajak'
    and is_owner()
  );

-- 3. UPDATE: Owner-only
create policy "owner_update_bukti_pajak" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'bukti-pajak'
    and is_owner()
  );

-- 4. DELETE: Owner-only
create policy "owner_delete_bukti_pajak" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bukti-pajak'
    and is_owner()
  );

-- ============================================================
-- VIEW (optional): Audit file upload per outlet
-- Untuk monitoring storage usage, bisa query dengan filter ke bucket.
-- ============================================================
create or replace view v_storage_usage as
select
  bucket_id,
  (storage.foldername(name))[1] as outlet_id,
  count(*) as file_count,
  sum(coalesce((metadata->>'size')::bigint, 0)) as total_bytes
from storage.objects
where bucket_id in ('nota-expense', 'bukti-pajak')
group by bucket_id, (storage.foldername(name))[1];

-- ============================================================
-- CATATAN PENTING:
-- ============================================================
-- 1. Bucket `nota-expense` & `bukti-pajak` harus dibuat MANUAL
--    via Supabase Dashboard sebelum gunakan:
--    - Storage → New bucket → "nota-expense" (Private, 5MB max, JPG/PNG/WebP/PDF)
--    - Storage → New bucket → "bukti-pajak"  (Private, 5MB max, JPG/PNG/PDF)
--
-- 2. Signed URL expiration: default 1 jam. Bisa diubah di signedUrl().
--
-- 3. Path convention:
--    - nota-expense/{outlet_id}/{YYYY-MM}/{transaksi_id}-{original_filename}
--    - bukti-pajak/{outlet_id}/{YYYY-MM}/{pajak_rekap_id}-{original_filename}
--
-- 4. Recurring transactions sudah ter-cover di migration 004.
--    Function fn_run_recurring() sudah idempotent (cek existing RECURRING + ref_id).
--    Vercel Cron schedule: '0 23 * * *' UTC (= 06:00 WIB).
-- ============================================================
