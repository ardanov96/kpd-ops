-- ============================================================
-- 024_enforce_metode_a_inventaris.sql
-- Enforce Metode A (Pencatatan Berbasis Pemakaian Inventaris):
-- Mencegah pencatatan ganda (double-entry) untuk Beban ATK & Packaging (kode 5100).
-- Beban 5100 HANYA boleh dihasilkan otomatis dari Stok Keluar di Modul Inventaris (sumber='INVENTARIS').
-- ============================================================

-- ─── 1. Trigger DB: Blokir input manual kategori 5100 di transaksi_keuangan ───
CREATE OR REPLACE FUNCTION fn_prevent_manual_atk_expense()
RETURNS trigger AS $$
DECLARE
  v_kode text;
BEGIN
  -- Hanya blokir transaksi KELUAR yang bersumber MANUAL
  IF NEW.tipe = 'KELUAR' AND NEW.sumber = 'MANUAL' THEN
    SELECT kode INTO v_kode FROM kategori_akun WHERE id = NEW.kategori_id;
    IF v_kode = '5100' THEN
      RAISE EXCEPTION 'Input manual untuk Beban ATK & Packaging (kode 5100) diblokir. Beban ini otomatis dihasilkan dari Stok Keluar di Modul Inventaris (Metode A).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_manual_atk_expense ON transaksi_keuangan;
CREATE TRIGGER trg_prevent_manual_atk_expense
BEFORE INSERT OR UPDATE ON transaksi_keuangan
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_manual_atk_expense();

-- ─── 2. Trigger DB: Blokir template recurring untuk kategori 5100 ─────────────
CREATE OR REPLACE FUNCTION fn_prevent_recurring_atk_expense()
RETURNS trigger AS $$
DECLARE
  v_kode text;
BEGIN
  IF NEW.tipe = 'KELUAR' THEN
    SELECT kode INTO v_kode FROM kategori_akun WHERE id = NEW.kategori_id;
    IF v_kode = '5100' THEN
      RAISE EXCEPTION 'Kategori Beban ATK & Packaging (kode 5100) tidak dapat dijadikan template recurring karena dihasilkan otomatis dari Modul Inventaris (Metode A).';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_recurring_atk_expense ON recurring_transactions;
CREATE TRIGGER trg_prevent_recurring_atk_expense
BEFORE INSERT OR UPDATE ON recurring_transactions
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_recurring_atk_expense();
