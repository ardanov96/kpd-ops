import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import AkuntingExpenseForm from '@/components/dashboard/AkuntingExpenseForm'

export const dynamic = 'force-dynamic'

export default async function AkuntingExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; tipe?: string }>
}) {
  const params = await searchParams
  const outlet = await getActiveOutlet()

  if (!outlet) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#f1f5f9' }}>Belum ada outlet</h1>
      </div>
    )
  }

  let kategoriList: any[] = []
  let transaksiList: any[] = []

  try {
    const katRes = await query('SELECT * FROM kategori_akun ORDER BY tipe ASC, urutan ASC, kode ASC')
    kategoriList = katRes.rows

    let sql = `
      SELECT tk.*,
        json_build_object('kode', k.kode, 'nama', k.nama, 'tipe', k.tipe) as kategori
      FROM transaksi_keuangan tk
      LEFT JOIN kategori_akun k ON k.id = tk.kategori_id
      WHERE tk.outlet_id = $1
    `
    const sqlParams: any[] = [outlet.id]

    if (params.tipe) {
      sqlParams.push(params.tipe)
      sql += ` AND tk.tipe = $${sqlParams.length}`
    }

    sql += ' ORDER BY tk.tanggal DESC, tk.created_at DESC LIMIT 100'

    const txRes = await query(sql, sqlParams)
    transaksiList = txRes.rows
  } catch (e) {
    console.error('Error fetching expense page data:', e)
  }

  return (
    <AkuntingExpenseForm
      outlet={outlet}
      kategoriList={kategoriList}
      transaksiList={transaksiList}
      filterPeriode={params.periode || ''}
      filterTipe={params.tipe || ''}
    />
  )
}
