import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import { redirect } from 'next/navigation'
import PajakRekapClient from '@/components/dashboard/PajakRekapClient'

export const dynamic = 'force-dynamic'

export default async function PajakRekapPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string; status?: string }>
}) {
  const params = await searchParams
  const outlet = await getActiveOutlet()

  if (!outlet) redirect('/dashboard')

  let rekapList: any[] = []
  let tahunList: string[] = []

  try {
    let sql = 'SELECT * FROM pajak_rekap WHERE outlet_id = $1'
    const sqlParams: any[] = [outlet.id]

    if (params.tahun) {
      sqlParams.push(`${params.tahun}-%`)
      sql += ` AND periode LIKE $${sqlParams.length}`
    }
    if (params.status) {
      sqlParams.push(params.status)
      sql += ` AND status_bayar = $${sqlParams.length}`
    }

    sql += ' ORDER BY periode DESC'

    const rkRes = await query(sql, sqlParams)
    rekapList = rkRes.rows

    const sptRes = await query(
      'SELECT DISTINCT tahun FROM v_spt_tahunan_estimator WHERE outlet_id = $1 ORDER BY tahun DESC',
      [outlet.id]
    )
    tahunList = sptRes.rows.map((s) => String(s.tahun))
    const thisYear = String(new Date().getFullYear())
    if (!tahunList.includes(thisYear)) tahunList.unshift(thisYear)
  } catch (e) {
    console.error('Error fetching pajak rekap page data:', e)
  }

  return (
    <PajakRekapClient
      outlet={outlet}
      rekapList={rekapList}
      tahunList={tahunList}
      selectedTahun={params.tahun || ''}
      selectedStatus={params.status || ''}
    />
  )
}
