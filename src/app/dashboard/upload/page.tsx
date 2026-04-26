import { createAdminClient } from '@/lib/supabase/server'
import UploadClient from '@/components/dashboard/UploadClient'

export default async function UploadPage() {
  const supabase = createAdminClient() 
  const { data: logs } = await supabase
    .from('upload_logs')
    .select('*, kurir(kode, nama)')
    .order('created_at', { ascending: false })
    .limit(20)

  return <UploadClient logs={logs || []} />
}