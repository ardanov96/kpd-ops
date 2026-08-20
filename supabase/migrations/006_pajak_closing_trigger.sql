-- ============================================================
-- 006_pajak_closing_trigger.sql
-- Patch: trigger auto-generate PPh Final 0,5% setelah closing
-- Jalankan SETELAH 005_pajak.sql di Supabase SQL Editor
-- Dependencies: 004_akunting.sql (fn_closing_periode), 005_pajak.sql
-- ============================================================

-- Recreate fn_closing_periode dengan panggilan ke fn_generate_pph_final_rekap
-- Idempotent — panggil ulang aman
create or replace function fn_closing_periode(p_outlet_id uuid, p_periode text, p_closed_by uuid)
returns void as $$
declare
  v_income numeric;
  v_expense numeric;
  v_laba numeric;
begin
  -- Hitung agregat dari transaksi_keuangan
  select
    coalesce(sum(case when tipe='MASUK' then nominal else 0 end), 0),
    coalesce(sum(case when tipe='KELUAR' then nominal else 0 end), 0)
  into v_income, v_expense
  from transaksi_keuangan
  where outlet_id = p_outlet_id
    and to_char(tanggal, 'YYYY-MM') = p_periode;

  v_laba := v_income - v_expense;

  -- Idempotent upsert ke periode_closing
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

  -- ✅ AUTO-GENERATE PPh Final 0,5% (idempotent, tidak reset status LUNAS)
  -- Panggil function dari 005_pajak.sql
  perform fn_generate_pph_final_rekap(p_outlet_id, p_periode);
end;
$$ language plpgsql;

-- ============================================================
-- CATATAN:
-- 1. Setiap kali owner klik "Tutup Buku" (fn_closing_periode),
--    sistem otomatis insert/update baris PPh Final 0,5% di pajak_rekap.
-- 2. Jika sudah ada closing sebelumnya, function ini idempotent —
--    boleh dipanggil ulang (closing ulang/re-opening) tanpa duplicate.
-- 3. Jika baris pajak_rekap sudah LUNAS/BEAS, status BAYAR tidak di-reset.
--    Hanya dasar_pengenaan, tarif, nilai_pajak yang di-update.
-- 4. Migration ini HANYA patch fn_closing_periode. Tabel & function
--    pajak lainnya ada di 005_pajak.sql.
-- ============================================================
