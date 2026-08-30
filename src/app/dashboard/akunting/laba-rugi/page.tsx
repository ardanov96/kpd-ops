import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import AkuntingLaporanClient from '@/components/dashboard/AkuntingLaporanClient'

export const dynamic = 'force-dynamic'

export default async function LaporanLabaRugiPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
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

  const now = new Date()
  const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const selectedPeriode = params.periode || currentPeriode

  let lr: any = null
  let breakdown: any[] = []
  let cashflow: any[] = []
  let neraca: any = null

  try {
    const lrRes = await query(
      'SELECT * FROM v_laba_rugi WHERE outlet_id = $1 AND periode = $2 LIMIT 1',
      [outlet.id, selectedPeriode]
    )
    lr = lrRes.rows[0] || null

    const bdRes = await query(
      'SELECT * FROM v_keuangan_per_kategori WHERE outlet_id = $1 AND periode = $2 ORDER BY kategori_tipe ASC, kategori_kode ASC',
      [outlet.id, selectedPeriode]
    )
    breakdown = bdRes.rows

    const cfRes = await query(
      'SELECT * FROM v_cashflow WHERE outlet_id = $1 AND periode = $2',
      [outlet.id, selectedPeriode]
    )
    cashflow = cfRes.rows

    const nRes = await query('SELECT * FROM v_neraca WHERE outlet_id = $1 LIMIT 1', [outlet.id])
    neraca = nRes.rows[0] || null
  } catch (e) {
    console.error('Error fetching laba-rugi page data:', e)
  }

  return (
    <AkuntingLaporanClient
      outlet={outlet}
      selectedPeriode={selectedPeriode}
      currentPeriode={currentPeriode}
      labaRugi={lr || { total_income: 0, total_expense: 0, laba_kotor: 0 }}
      breakdown={breakdown}
      cashflow={cashflow}
      neraca={neraca}
    />
  )
}
