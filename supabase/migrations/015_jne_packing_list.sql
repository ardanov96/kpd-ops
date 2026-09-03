-- ============================================================
-- 015_jne_packing_list.sql
-- Inisialisasi tabel Packing List untuk integrasi JNE Express
-- ============================================================

CREATE TABLE IF NOT EXISTS jne_packing_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kurir_id UUID REFERENCES kurir(id) ON DELETE CASCADE NOT NULL,
  nomor_pl TEXT NOT NULL,
  tanggal DATE,
  amount NUMERIC(15,2) DEFAULT 0,
  publish_rate NUMERIC(15,2) DEFAULT 0,
  cnote_count INT DEFAULT 0,
  insurance NUMERIC(15,2) DEFAULT 0,
  vat_amount NUMERIC(15,2) DEFAULT 0,
  discount NUMERIC(15,2) DEFAULT 0,
  disc_others NUMERIC(15,2) DEFAULT 0,
  total_net NUMERIC(15,2) DEFAULT 0,
  coly INT DEFAULT 0,
  weight NUMERIC(10,3) DEFAULT 0,
  date_paid DATE,
  outstanding NUMERIC(15,2) DEFAULT 0,
  periode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_jne_packing_list_kurir_pl UNIQUE (kurir_id, nomor_pl)
);

CREATE INDEX IF NOT EXISTS idx_jne_pl_kurir_id ON jne_packing_list(kurir_id);
CREATE INDEX IF NOT EXISTS idx_jne_pl_tanggal ON jne_packing_list(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_jne_pl_periode ON jne_packing_list(periode);
