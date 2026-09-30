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

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  const client = await pool.connect();
  console.log('====================================================');
  console.log('🧪 COMPREHENSIVE ACCOUNTING MODULE TEST SUITE');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: Chart of Accounts (kategori_akun)
    // ----------------------------------------------------
    console.log('--- TEST 1: Chart of Accounts (kategori_akun) ---');
    const coaRes = await client.query('SELECT kode, nama, tipe, is_system FROM kategori_akun ORDER BY kode');
    assert(coaRes.rows.length >= 15, `COA contains ${coaRes.rows.length} categories (expected >= 15)`);

    const codes = coaRes.rows.map(r => r.kode);
    assert(codes.includes('4100'), 'COA includes 4100 Pendapatan Ekspedisi');
    assert(codes.includes('5100'), 'COA includes 5100 Beban ATK & Packaging');
    assert(codes.includes('5200'), 'COA includes 5200 Beban Internet (WiFi)');
    assert(codes.includes('5300'), 'COA includes 5300 Beban Listrik');
    assert(codes.includes('5900'), 'COA includes 5900 Beban Lain-lain (Penalty)');
    assert(codes.includes('3100'), 'COA includes 3100 Modal Pemilik');
    assert(codes.includes('3900'), 'COA includes 3900 Laba Ditahan');

    // ----------------------------------------------------
    // TEST SUITE 2: Multi-Franchise Income Aggregation
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Multi-Franchise Income Aggregation ---');
    const outletRes = await client.query('SELECT id, kode, nama FROM outlets WHERE kode = $1 LIMIT 1', ['OUTLET-DEMO']);
    const outletId = outletRes.rows[0]?.id;
    assert(!!outletId, `Outlet OUTLET-DEMO found (${outletId})`);

    // Verify Lion aggregation for 2026-07
    const lionJulyAgg = await client.query(`
      SELECT nominal FROM transaksi_keuangan 
      WHERE outlet_id = $1 AND to_char(tanggal, 'YYYY-MM') = '2026-07' AND sumber = 'KURIR' AND tipe = 'MASUK'
    `, [outletId]);
    assert(lionJulyAgg.rows.length === 1, 'Lion 2026-07 aggregated into transaksi_keuangan');
    assert(Number(lionJulyAgg.rows[0]?.nominal) > 0, `Lion 2026-07 net omzet: Rp ${Number(lionJulyAgg.rows[0]?.nominal).toLocaleString('id-ID')}`);

    // Verify JNE aggregation for 2026-07
    const jneJulyAgg = await client.query(`
      SELECT nominal FROM transaksi_keuangan 
      WHERE outlet_id = $1 AND to_char(tanggal, 'YYYY-MM') = '2026-07' AND sumber = 'JNE' AND tipe = 'MASUK'
    `, [outletId]);
    assert(jneJulyAgg.rows.length === 1, 'JNE 2026-07 aggregated into transaksi_keuangan');
    assert(Number(jneJulyAgg.rows[0]?.nominal) > 0, `JNE 2026-07 commission: Rp ${Number(jneJulyAgg.rows[0]?.nominal).toLocaleString('id-ID')}`);

    // Verify Idempotency: re-running fn_aggregate_income does not duplicate rows
    await client.query('SELECT fn_aggregate_income($1, $2)', [outletId, '2026-07']);
    await client.query('SELECT fn_aggregate_income_jne($1, $2)', [outletId, '2026-07']);
    const countAfterReagg = await client.query(`
      SELECT count(*) as count FROM transaksi_keuangan 
      WHERE outlet_id = $1 AND to_char(tanggal, 'YYYY-MM') = '2026-07' AND tipe = 'MASUK'
    `, [outletId]);
    assert(Number(countAfterReagg.rows[0]?.count) === 2, `Idempotency verified: exactly 2 MASUK rows (1 Lion + 1 JNE) for 2026-07`);

    // ----------------------------------------------------
    // TEST SUITE 3: Lion Penalty Logic & Probation
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Lion Penalty Logic & Probation ---');
    // Pre-probation month: 2024-03 omzet Lion was Rp 2.004.000 (< 3jt), but probation was active -> 0 penalty
    const march2024Penalty = await client.query(`
      SELECT nominal FROM transaksi_keuangan 
      WHERE outlet_id = $1 AND to_char(tanggal, 'YYYY-MM') = '2024-03' AND sumber = 'KURIR' AND tipe = 'KELUAR'
    `, [outletId]);
    assert(march2024Penalty.rows.length === 0, '2024-03 (probation period): 0 penalty even though omzet < 3jt');

    // Post-probation month with omzet < 3jt: 2024-04 omzet was Rp 2.205.660 (< 3jt) -> penalty Rp 500.000
    const april2024Penalty = await client.query(`
      SELECT nominal FROM transaksi_keuangan 
      WHERE outlet_id = $1 AND to_char(tanggal, 'YYYY-MM') = '2024-04' AND sumber = 'KURIR' AND tipe = 'KELUAR'
    `, [outletId]);
    assert(april2024Penalty.rows.length === 1 && Number(april2024Penalty.rows[0].nominal) === 500000, 
      '2024-04 (post-probation): Rp 500.000 penalty applied because omzet < 3jt');

    // Post-probation month with omzet >= 3jt: 2026-07 omzet was Rp 6.704.100 (>= 3jt) -> 0 penalty
    const july2026Penalty = await client.query(`
      SELECT nominal FROM transaksi_keuangan 
      WHERE outlet_id = $1 AND to_char(tanggal, 'YYYY-MM') = '2026-07' AND sumber = 'KURIR' AND tipe = 'KELUAR'
    `, [outletId]);
    assert(july2026Penalty.rows.length === 0, '2026-07 (omzet >= 3jt): 0 penalty');

    // ----------------------------------------------------
    // TEST SUITE 4: Accounting Views Consistency
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Accounting Views Consistency ---');
    const lrJuly = await client.query(`
      SELECT * FROM v_laba_rugi WHERE outlet_id = $1 AND periode = '2026-07'
    `, [outletId]);
    assert(lrJuly.rows.length === 1, 'v_laba_rugi returns row for 2026-07');
    const incomeJuly = Number(lrJuly.rows[0]?.total_income);
    const expenseJuly = Number(lrJuly.rows[0]?.total_expense);
    const labaJuly = Number(lrJuly.rows[0]?.laba_kotor);
    assert(labaJuly === incomeJuly - expenseJuly, `v_laba_rugi math: laba (${labaJuly}) = income (${incomeJuly}) - expense (${expenseJuly})`);

    // Verify v_keuangan_per_kategori
    const katJuly = await client.query(`
      SELECT * FROM v_keuangan_per_kategori WHERE outlet_id = $1 AND periode = '2026-07'
    `, [outletId]);
    assert(katJuly.rows.length >= 1, `v_keuangan_per_kategori returns ${katJuly.rows.length} category drill-down record(s)`);

    // Verify v_neraca
    const neracaRes = await client.query(`
      SELECT * FROM v_neraca WHERE outlet_id = $1
    `, [outletId]);
    assert(neracaRes.rows.length === 1, 'v_neraca returns balance sheet record');

    // ----------------------------------------------------
    // TEST SUITE 5: Manual Transactions CRUD
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Manual Transactions (Expense CRUD) ---');
    const katListrik = (await client.query("SELECT id FROM kategori_akun WHERE kode = '5300'")).rows[0]?.id;
    
    // Test Create
    const insertRes = await client.query(`
      INSERT INTO transaksi_keuangan (outlet_id, tanggal, tipe, kategori_id, sumber, nominal, metode, keterangan)
      VALUES ($1, '2026-07-15', 'KELUAR', $2, 'MANUAL', 350000, 'BANK', 'Beban Listrik Juli Test')
      RETURNING *
    `, [outletId, katListrik]);
    const testTxId = insertRes.rows[0]?.id;
    assert(!!testTxId, `Manual expense created successfully (ID: ${testTxId})`);

    // Test Read
    const readRes = await client.query(`
      SELECT tk.*, k.kode as kat_kode, k.nama as kat_nama
      FROM transaksi_keuangan tk
      JOIN kategori_akun k ON k.id = tk.kategori_id
      WHERE tk.id = $1
    `, [testTxId]);
    assert(Number(readRes.rows[0]?.nominal) === 350000, 'Read manual expense nominal is 350,000');
    assert(readRes.rows[0]?.kat_kode === '5300', 'Read manual expense category code is 5300');

    // Test Update
    await client.query(`
      UPDATE transaksi_keuangan
      SET nominal = 400000, keterangan = 'Beban Listrik Juli Test Updated'
      WHERE id = $1
    `, [testTxId]);
    const updatedRes = await client.query('SELECT nominal, keterangan FROM transaksi_keuangan WHERE id = $1', [testTxId]);
    assert(Number(updatedRes.rows[0]?.nominal) === 400000, 'Manual expense updated to 400,000');

    // Test Delete
    await client.query('DELETE FROM transaksi_keuangan WHERE id = $1', [testTxId]);
    const deletedRes = await client.query('SELECT id FROM transaksi_keuangan WHERE id = $1', [testTxId]);
    assert(deletedRes.rows.length === 0, 'Manual expense deleted successfully');

    // ----------------------------------------------------
    // TEST SUITE 6: Recurring Transactions & Cron
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Recurring Transactions & fn_run_recurring ---');
    const katWifi = (await client.query("SELECT id FROM kategori_akun WHERE kode = '5200'")).rows[0]?.id;
    
    // Create recurring template for day 10
    const recInsert = await client.query(`
      INSERT INTO recurring_transactions (outlet_id, nama_template, kategori_id, tipe, nominal, metode, tanggal_setiap_bulan, aktif)
      VALUES ($1, 'WiFi Telkom Speedy Test', $2, 'KELUAR', 450000, 'BANK', 10, true)
      RETURNING *
    `, [outletId, katWifi]);
    const recId = recInsert.rows[0]?.id;
    assert(!!recId, `Recurring template created (ID: ${recId})`);

    // Run recurring function for 2026-07-10
    const genCount = await client.query("SELECT fn_run_recurring('2026-07-10'::date) as count");
    assert(Number(genCount.rows[0]?.count) >= 1, `fn_run_recurring generated ${genCount.rows[0]?.count} transaction(s)`);

    // Verify generated transaction exists in transaksi_keuangan
    const genTx = await client.query(`
      SELECT * FROM transaksi_keuangan WHERE outlet_id = $1 AND ref_id = $2 AND sumber = 'RECURRING'
    `, [outletId, recId]);
    assert(genTx.rows.length === 1, 'Auto-generated RECURRING transaction found in transaksi_keuangan');
    assert(Number(genTx.rows[0]?.nominal) === 450000, 'Generated nominal is 450,000');

    // Test Idempotency: running fn_run_recurring on same date should generate 0 new transactions
    const genCount2 = await client.query("SELECT fn_run_recurring('2026-07-10'::date) as count");
    assert(Number(genCount2.rows[0]?.count) === 0, 'fn_run_recurring idempotent: 0 duplicate on second run');

    // Cleanup recurring template and generated transaction
    await client.query('DELETE FROM transaksi_keuangan WHERE ref_id = $1', [recId]);
    await client.query('DELETE FROM recurring_transactions WHERE id = $1', [recId]);
    assert(true, 'Cleaned up recurring test data');

    // ----------------------------------------------------
    // TEST SUITE 7: Closing Period & Lock Enforcement
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Closing Period & Lock Enforcement ---');
    const testClosingPeriode = '2024-01'; // Historical period
    const profileRes = await client.query('SELECT id FROM profiles LIMIT 1');
    const userId = profileRes.rows[0]?.id;

    // Run closing
    await client.query('SELECT fn_closing_periode($1, $2, $3)', [outletId, testClosingPeriode, userId]);
    
    // Verify periode_closing
    const closingRecord = await client.query(`
      SELECT * FROM periode_closing WHERE outlet_id = $1 AND periode = $2
    `, [outletId, testClosingPeriode]);
    assert(closingRecord.rows.length === 1, `periode_closing record created for ${testClosingPeriode}`);
    assert(closingRecord.rows[0]?.is_locked === true, 'Closing status is_locked = true');
    assert(Number(closingRecord.rows[0]?.total_income) > 0, `Closing total_income: Rp ${Number(closingRecord.rows[0]?.total_income).toLocaleString('id-ID')}`);

    // Verify auto PPh Final 0.5% generated in pajak_rekap
    const pajakRekap = await client.query(`
      SELECT * FROM pajak_rekap WHERE outlet_id = $1 AND periode = $2
    `, [outletId, testClosingPeriode]);
    assert(pajakRekap.rows.length === 1, `Auto-generated PPh Final record in pajak_rekap for ${testClosingPeriode}`);
    if (pajakRekap.rows.length > 0) {
      assert(Number(pajakRekap.rows[0]?.nilai_pajak) > 0, `PPh terutang (nilai_pajak): Rp ${Number(pajakRekap.rows[0]?.nilai_pajak).toLocaleString('id-ID')}`);
    }

    // Test Lock Enforcement on fn_aggregate_income
    let lockErrorCaught = false;
    try {
      await client.query('SELECT fn_aggregate_income($1, $2)', [outletId, testClosingPeriode]);
    } catch (e) {
      lockErrorCaught = true;
      assert(e.message.includes('sudah di-closing'), `Lock enforcement blocked aggregate: "${e.message}"`);
    }
    assert(lockErrorCaught, 'Lock enforcement properly threw error on aggregate during locked period');

    // Cleanup test closing record and test pajak_rekap record
    await client.query(`DELETE FROM pajak_rekap WHERE outlet_id = $1 AND periode = $2`, [outletId, testClosingPeriode]);
    await client.query(`DELETE FROM periode_closing WHERE outlet_id = $1 AND periode = $2`, [outletId, testClosingPeriode]);
    assert(true, `Cleaned up test closing & pajak records for ${testClosingPeriode}`);

    // ----------------------------------------------------
    // TEST SUITE 8: Metode A Enforcement (ATK 5100 Double-Entry Protection)
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Metode A Enforcement (ATK 5100 Protection) ---');
    const katAtkRes = await client.query("SELECT id FROM kategori_akun WHERE kode = '5100'");
    const katAtkId = katAtkRes.rows[0]?.id;

    // Test 8.1: Manual insert with category 5100 must be rejected
    let manualAtkBlocked = false;
    try {
      await client.query(`
        INSERT INTO transaksi_keuangan (outlet_id, tanggal, tipe, kategori_id, sumber, nominal)
        VALUES ($1, CURRENT_DATE, 'KELUAR', $2, 'MANUAL', 75000)
      `, [outletId, katAtkId]);
    } catch (e) {
      manualAtkBlocked = true;
      assert(e.message.includes('5100'), `Manual 5100 insert properly blocked by trigger: "${e.message}"`);
    }
    assert(manualAtkBlocked, 'Manual 5100 insert was blocked by database trigger');

    // Test 8.2: Recurring template with category 5100 must be rejected
    let recurringAtkBlocked = false;
    try {
      await client.query(`
        INSERT INTO recurring_transactions (outlet_id, nama_template, kategori_id, tipe, nominal, tanggal_setiap_bulan)
        VALUES ($1, 'Recurring Lakban', $2, 'KELUAR', 50000, 1)
      `, [outletId, katAtkId]);
    } catch (e) {
      recurringAtkBlocked = true;
      assert(e.message.includes('5100'), `Recurring 5100 properly blocked by trigger: "${e.message}"`);
    }
    assert(recurringAtkBlocked, 'Recurring 5100 template was blocked by database trigger');

    // Test 8.3: INVENTARIS auto-expense is NOT blocked
    let autoAtkAllowed = false;
    try {
      const autoRes = await client.query(`
        INSERT INTO transaksi_keuangan (outlet_id, tanggal, tipe, kategori_id, sumber, nominal, keterangan)
        VALUES ($1, CURRENT_DATE, 'KELUAR', $2, 'INVENTARIS', 15000, 'Test auto expense stok keluar')
        RETURNING id
      `, [outletId, katAtkId]);
      autoAtkAllowed = !!autoRes.rows[0]?.id;
      // Clean up test row
      await client.query(`DELETE FROM transaksi_keuangan WHERE id = $1`, [autoRes.rows[0]?.id]);
    } catch (e) {
      console.error('Error during auto-expense test:', e);
    }
    assert(autoAtkAllowed, 'Automatic expense from INVENTARIS is properly allowed without trigger error');

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

  } catch (err) {
    console.error('Fatal test runner error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests();
