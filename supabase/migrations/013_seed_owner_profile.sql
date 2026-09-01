-- ============================================================
-- 013_seed_owner_profile.sql
-- Inisialisasi / Upsert Akun Default Owner
-- ============================================================

INSERT INTO profiles (id, email, password_hash, nama, role, outlet_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'owner@ekspedisi.com',
  'Admin123456',
  'Owner Ekspedisi',
  'owner',
  NULL
)
ON CONFLICT (email) 
DO UPDATE SET 
  password_hash = EXCLUDED.password_hash,
  role = 'owner',
  nama = EXCLUDED.nama;
