const { Pool } = require('pg');
const fs = require('fs');
const dns = require('dns');

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
}

const pool = new Pool({
  connectionString: env.DATABASE_URL || env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 15000,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('1. Applying 024_enforce_metode_a_inventaris.sql...');
    const migrationSql = fs.readFileSync('supabase/migrations/024_enforce_metode_a_inventaris.sql', 'utf8');
    await client.query(migrationSql);
    console.log('   Migration 024 applied successfully!');

    // Test trigger: attempt manual insert with 5100
    console.log('2. Testing manual insert protection on category 5100...');
    const katRes = await client.query("SELECT id FROM kategori_akun WHERE kode = '5100'");
    const outletRes = await client.query("SELECT id FROM outlets LIMIT 1");
    const katId = katRes.rows[0].id;
    const outletId = outletRes.rows[0].id;

    try {
      await client.query(`
        INSERT INTO transaksi_keuangan (outlet_id, tanggal, tipe, kategori_id, sumber, nominal)
        VALUES ($1, CURRENT_DATE, 'KELUAR', $2, 'MANUAL', 100000)
      `, [outletId, katId]);
      console.error('❌ FAILED: Manual insert was not blocked!');
    } catch (err) {
      console.log('✅ SUCCESS: Manual insert was properly blocked with error:');
      console.log('   ', err.message);
    }

    // Test trigger on recurring
    console.log('3. Testing recurring template protection on category 5100...');
    try {
      await client.query(`
        INSERT INTO recurring_transactions (outlet_id, nama_template, kategori_id, tipe, nominal, tanggal_setiap_bulan)
        VALUES ($1, 'Test Recurring ATK', $2, 'KELUAR', 100000, 1)
      `, [outletId, katId]);
      console.error('❌ FAILED: Recurring template with 5100 was not blocked!');
    } catch (err) {
      console.log('✅ SUCCESS: Recurring template was properly blocked with error:');
      console.log('   ', err.message);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error applying migration 024:', err);
  process.exit(1);
});
