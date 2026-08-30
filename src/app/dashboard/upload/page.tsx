import { query } from '@/lib/db'
import UploadClient from '@/components/dashboard/UploadClient'

export default async function UploadPage() {
  let logs: any[] = []

  try {
    const res = await query(`
      SELECT ul.*,
        json_build_object('kode', k.kode, 'nama', k.nama) as kurir
      FROM upload_logs ul
      LEFT JOIN kurir k ON k.id = ul.kurir_id
      ORDER BY ul.created_at DESC
      LIMIT 20
    `)
    logs = res.rows
  } catch (e) {
    console.error('Error fetching upload logs:', e)
  }

  return <UploadClient logs={logs} />
}