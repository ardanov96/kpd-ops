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
});

async function main() {
  try {
    const katRes = await pool.query("SELECT id, kode, nama FROM kategori_akun WHERE kode = '5100'");
    if (katRes.rows.length === 0) {
      console.log('Kategori 5100 not found');
      return;
    }
    const kat = katRes.rows[0];
    console.log(`Found kategori: ${kat.kode} - ${kat.nama} (${kat.id})`);

    const res = await pool.query(
      "SELECT id, outlet_id, tanggal, tipe, sumber, nominal, keterangan FROM transaksi_keuangan WHERE kategori_id = $1 ORDER BY tanggal DESC",
      [kat.id]
    );

    console.log(`Total rows with kategori 5100: ${res.rows.length}`);
    const manualRows = res.rows.filter(r => r.sumber === 'MANUAL');
    const autoRows = res.rows.filter(r => r.sumber === 'INVENTARIS');
    console.log(`- sumber MANUAL: ${manualRows.length}`);
    console.log(`- sumber INVENTARIS: ${autoRows.length}`);
    if (manualRows.length > 0) {
      console.log('Sample manual rows:', manualRows.slice(0, 3));
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
