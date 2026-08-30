import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import { redirect } from 'next/navigation'
import PajakSPTClient from '@/components/dashboard/PajakSPTClient'

export const dynamic = 'force-dynamic'

export default async function PajakSPTPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string }>
}) {
  const params = await searchParams
  const outlet = await getActiveOutlet()

  if (!outlet) redirect('/dashboard')

  let config: any = null
  let sptTahunan: any[] = []
  let rekapTahunan: any[] = []

  try {
    const cfgRes = await query('SELECT * FROM pajak_config WHERE outlet_id = $1 LIMIT 1', [outlet.id])
    config = cfgRes.rows[0] || null

    const sptRes = await query(
      'SELECT * FROM v_spt_tahunan_estimator WHERE outlet_id = $1 ORDER BY tahun DESC',
      [outlet.id]
    )
    sptTahunan = sptRes.rows

    const selectedTahun = params.tahun || sptTahunan[0]?.tahun || String(new Date().getFullYear())

    const rkRes = await query(
      'SELECT * FROM pajak_rekap WHERE outlet_id = $1 AND periode LIKE $2 ORDER BY periode ASC',
      [outlet.id, `${selectedTahun}-%`]
    )
    rekapTahunan = rkRes.rows

    const tahunList = sptTahunan.map((s) => String(s.tahun))

    return (
      <PajakSPTClient
        outlet={outlet}
        config={config}
        sptTahunan={sptTahunan}
        rekapTahunan={rekapTahunan}
        selectedTahun={selectedTahun}
        tahunList={tahunList}
      />
    )
  } catch (e) {
    console.error('Error fetching SPT page data:', e)
    return (
      <PajakSPTClient
        outlet={outlet}
        config={null}
        sptTahunan={[]}
        rekapTahunan={[]}
        selectedTahun={String(new Date().getFullYear())}
        tahunList={[]}
      />
    )
  }
}
