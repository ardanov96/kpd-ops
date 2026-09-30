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
    console.log('1. Applying 023_fix_accounting_penalty_and_seed.sql...');
    const migrationSql = fs.readFileSync('supabase/migrations/023_fix_accounting_penalty_and_seed.sql', 'utf8');
    await client.query(migrationSql);
    console.log('   Migration 023 applied successfully!');

    // Check kategori_akun
    const katCount = await client.query('SELECT count(*) FROM kategori_akun');
    console.log(`   kategori_akun count: ${katCount.rows[0].count}`);

    // Get active outlet (or all outlets with transactions)
    const outlets = await client.query(`
      SELECT DISTINCT outlet_id FROM (
        SELECT outlet_id FROM transaksi
        UNION
        SELECT outlet_id FROM jne_packing_list
      ) sub WHERE outlet_id IS NOT NULL
    `);
    console.log(`\n2. Found ${outlets.rows.length} outlet(s) with imported data.`);

    for (const { outlet_id } of outlets.rows) {
      console.log(`\n--- Processing outlet: ${outlet_id} ---`);

      // Periods for Lion (from transaksi)
      const lionPeriods = await client.query(`
        SELECT DISTINCT to_char(tanggal, 'YYYY-MM') as periode
        FROM transaksi
        WHERE outlet_id = $1 AND tanggal IS NOT NULL
        ORDER BY periode ASC
      `, [outlet_id]);
      console.log(`   Aggregating ${lionPeriods.rows.length} period(s) for Lion...`);

      for (const { periode } of lionPeriods.rows) {
        try {
          await client.query('SELECT fn_aggregate_income($1, $2)', [outlet_id, periode]);
        } catch (e) {
          console.error(`   Error fn_aggregate_income(${periode}):`, e.message);
        }
      }

      // Periods for JNE (from jne_packing_list)
      const jnePeriods = await client.query(`
        SELECT DISTINCT to_char(tanggal, 'YYYY-MM') as periode
        FROM jne_packing_list
        WHERE outlet_id = $1 AND tanggal IS NOT NULL
        ORDER BY periode ASC
      `, [outlet_id]);
      console.log(`   Aggregating ${jnePeriods.rows.length} period(s) for JNE...`);

      for (const { periode } of jnePeriods.rows) {
        try {
          await client.query('SELECT fn_aggregate_income_jne($1, $2)', [outlet_id, periode]);
        } catch (e) {
          console.error(`   Error fn_aggregate_income_jne(${periode}):`, e.message);
        }
      }
    }

    console.log('\n3. Verification of accounting data:');
    const tkCount = await client.query('SELECT count(*) FROM transaksi_keuangan');
    console.log(`   transaksi_keuangan total rows: ${tkCount.rows[0].count}`);

    const tkSummary = await client.query(`
      SELECT 
        sumber,
        tipe,
        count(*) as count,
        sum(nominal) as total_nominal
      FROM transaksi_keuangan
      GROUP BY sumber, tipe
      ORDER BY sumber, tipe
    `);
    console.log('\n--- TRANSAKSI KEUANGAN BY SUMBER & TIPE ---');
    console.table(tkSummary.rows);

    const lrRows = await client.query(`
      SELECT periode, total_income, total_expense, laba_kotor
      FROM v_laba_rugi
      ORDER BY periode DESC
      LIMIT 15
    `);
    console.log('\n--- V_LABA_RUGI (SAMPLE 15 MONTHS) ---');
    console.table(lrRows.rows);

    const penalties = await client.query(`
      SELECT tanggal, keterangan, nominal
      FROM transaksi_keuangan
      WHERE tipe = 'KELUAR' AND sumber = 'KURIR'
      ORDER BY tanggal DESC
    `);
    console.log('\n--- LION PENALTIES RECORDED ---');
    console.table(penalties.rows);

  } catch (err) {
    console.error('Fatal error in script:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
