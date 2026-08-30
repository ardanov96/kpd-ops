import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import { redirect } from 'next/navigation'
import PajakPengaturanClient from '@/components/dashboard/PajakPengaturanClient'

export const dynamic = 'force-dynamic'

export default async function PajakPengaturanPage() {
  const outlet = await getActiveOutlet()

  if (!outlet) redirect('/dashboard')

  let config: any = null
  try {
    const res = await query('SELECT * FROM pajak_config WHERE outlet_id = $1 LIMIT 1', [outlet.id])
    config = res.rows[0] || null
  } catch (e) {
    console.error('Error fetching pajak config page data:', e)
  }

  return <PajakPengaturanClient outlet={outlet} config={config} />
}
