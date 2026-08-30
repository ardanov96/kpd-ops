import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import { redirect } from 'next/navigation'
import PajakUploadBuktiClient from '@/components/dashboard/PajakUploadBuktiClient'

export const dynamic = 'force-dynamic'

export default async function PajakUploadBuktiPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const params = await searchParams
  const outlet = await getActiveOutlet()

  if (!outlet) redirect('/dashboard')

  let rekapList: any[] = []

  try {
    const res = await query(
      'SELECT * FROM pajak_rekap WHERE outlet_id = $1 ORDER BY periode DESC LIMIT 36',
      [outlet.id]
    )
    rekapList = res.rows
  } catch (e) {
    console.error('Error fetching upload-bukti page data:', e)
  }

  let initialId = params.id
  if (!initialId) {
    const belum = rekapList.find((r) => r.status_bayar === 'BELUM')
    initialId = belum?.id
  }
  const initialRekap = rekapList.find((r) => r.id === initialId) || null

  return (
    <PajakUploadBuktiClient
      outlet={outlet}
      rekapList={rekapList}
      initialId={initialId || ''}
      initialRekap={initialRekap}
    />
  )
}
