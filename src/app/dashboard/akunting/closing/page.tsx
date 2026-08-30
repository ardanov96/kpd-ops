import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import AkuntingClosingClient from '@/components/dashboard/AkuntingClosingClient'

export const dynamic = 'force-dynamic'

export default async function AkuntingClosingPage({
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
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const recommendedPeriode = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}`
  const selectedPeriode = params.periode || currentPeriode

  let preview: any = null
  let existing: any = null
  let history: any[] = []

  try {
    const lrRes = await query(
      'SELECT * FROM v_laba_rugi WHERE outlet_id = $1 AND periode = $2 LIMIT 1',
      [outlet.id, selectedPeriode]
    )
    preview = lrRes.rows[0] || null

    const exRes = await query(
      'SELECT * FROM periode_closing WHERE outlet_id = $1 AND periode = $2 LIMIT 1',
      [outlet.id, selectedPeriode]
    )
    existing = exRes.rows[0] || null

    const histRes = await query(
      'SELECT * FROM periode_closing WHERE outlet_id = $1 ORDER BY periode DESC LIMIT 12',
      [outlet.id]
    )
    history = histRes.rows
  } catch (e) {
    console.error('Error fetching closing page data:', e)
  }

  return (
    <AkuntingClosingClient
      outlet={outlet}
      selectedPeriode={selectedPeriode}
      recommendedPeriode={recommendedPeriode}
      currentPeriode={currentPeriode}
      preview={preview || { total_income: 0, total_expense: 0, laba_kotor: 0 }}
      existing={existing}
      history={history}
    />
  )
}
