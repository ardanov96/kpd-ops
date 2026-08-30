import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import { redirect } from 'next/navigation'
import PajakClient from '@/components/dashboard/PajakClient'

export const dynamic = 'force-dynamic'

export default async function PajakDashboardPage() {
  const outlet = await getActiveOutlet()

  if (!outlet) redirect('/dashboard')

  let config: any = null
  let rekapList: any[] = []
  let reminders: any[] = []
  let sptTahunan: any[] = []

  const now = new Date()
  const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  try {
    const cfgRes = await query('SELECT * FROM pajak_config WHERE outlet_id = $1 LIMIT 1', [outlet.id])
    config = cfgRes.rows[0] || null

    const rkRes = await query(
      'SELECT * FROM pajak_rekap WHERE outlet_id = $1 ORDER BY periode DESC LIMIT 24',
      [outlet.id]
    )
    rekapList = rkRes.rows

    const remRes = await query(
      'SELECT * FROM v_pajak_reminder WHERE outlet_id = $1 AND sisa_hari <= 30 ORDER BY sisa_hari ASC',
      [outlet.id]
    )
    reminders = remRes.rows

    const sptRes = await query(
      'SELECT * FROM v_spt_tahunan_estimator WHERE outlet_id = $1 ORDER BY tahun DESC',
      [outlet.id]
    )
    sptTahunan = sptRes.rows
  } catch (e) {
    console.error('Error fetching pajak page data:', e)
  }

  const rekapBulanIni = rekapList.find((r) => r.periode === currentPeriode) || null

  return (
    <PajakClient
      outlet={outlet}
      config={config || {}}
      rekapList={rekapList}
      reminders={reminders}
      rekapBulanIni={rekapBulanIni}
      currentPeriode={currentPeriode}
      sptTahunan={sptTahunan}
    />
  )
}
