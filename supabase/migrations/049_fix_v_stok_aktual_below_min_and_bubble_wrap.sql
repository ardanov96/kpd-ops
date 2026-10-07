-- ============================================================
-- 049_fix_v_stok_aktual_below_min_and_bubble_wrap.sql
-- 1. Koreksi formula view v_stok_aktual:
--    Ubah kondisi ambang batas is_below_min dari '<=' menjadi '<'
--    sehingga saat stok = 1 dan stok_min = 1, statusnya 'Aman' (bukan false positive 'Minimum').
--    Hanya bernilai true jika stok benar-benar di bawah batas minimum (stok < stok_min).
-- 2. Koreksi stok Bubble Wrap Roll #9 (10 September 2026):
--    Hapus pencatatan OUT prematur pada tanggal pembelian yang sama,
--    sehingga sisa stok Bubble Wrap = 1 roll (sedang aktif dipakai di outlet,
--    selaras dengan barang operasional lainnya).
-- ============================================================

-- 1. Update view v_stok_aktual
CREATE OR REPLACE VIEW v_stok_aktual AS
SELECT
  b.id AS barang_id,
  b.outlet_id,
  b.kategori_id,
  b.sku,
  b.nama,
  b.satuan,
  b.stok_min,
  b.harga_beli,
  b.aktif,
  COALESCE(SUM(
    CASE
      WHEN m.tipe = 'IN'  THEN m.qty
      WHEN m.tipe = 'OUT' THEN -m.qty
      WHEN m.tipe = 'ADJ' THEN m.qty
    END
  ), 0) AS stok,
  COALESCE(SUM(
    CASE
      WHEN m.tipe = 'IN'  THEN m.qty * COALESCE(m.harga_satuan, 0)
      ELSE 0
    END
  ), 0) AS total_nilai_masuk,
  CASE
    WHEN COALESCE(SUM(
      CASE
        WHEN m.tipe = 'IN'  THEN m.qty
        WHEN m.tipe = 'OUT' THEN -m.qty
        WHEN m.tipe = 'ADJ' THEN m.qty
      END
    ), 0) < b.stok_min THEN true
    ELSE false
  END AS is_below_min
FROM barang b
LEFT JOIN stok_movement m ON m.barang_id = b.id
WHERE b.aktif = true
GROUP BY b.id;

-- 2. Koreksi stok Bubble Wrap Roll #9
DO $$
DECLARE
  v_bw_id UUID;
  v_sm_in_id UUID;
  v_sm_out_id UUID;
BEGIN
  -- Ambil ID barang Bubble Wrap
  SELECT id INTO v_bw_id FROM barang WHERE nama ILIKE '%bubble wrap%' LIMIT 1;

  IF v_bw_id IS NOT NULL THEN
    -- Ambil movement IN dan OUT pada tanggal 2026-09-10
    SELECT id INTO v_sm_in_id 
    FROM stok_movement 
    WHERE barang_id = v_bw_id AND tanggal = '2026-09-10' AND tipe = 'IN' 
    LIMIT 1;

    SELECT id INTO v_sm_out_id 
    FROM stok_movement 
    WHERE barang_id = v_bw_id AND tanggal = '2026-09-10' AND tipe = 'OUT' 
    LIMIT 1;

    IF v_sm_in_id IS NOT NULL AND v_sm_out_id IS NOT NULL THEN
      -- Arahkan referensi transaksi keuangan ke movement IN (pembelian roll)
      UPDATE transaksi_keuangan 
      SET ref_id = v_sm_in_id 
      WHERE ref_id = v_sm_out_id;

      -- Hapus movement OUT prematur
      DELETE FROM stok_movement WHERE id = v_sm_out_id;
    END IF;
  END IF;
END $$;
