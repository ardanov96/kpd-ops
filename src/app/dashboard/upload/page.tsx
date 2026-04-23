import { createClient } from '@/lib/supabase/server'
import UploadClient from '@/components/dashboard/UploadClient'

export default async function UploadPage() {
  const supabase = createClient()
  const { data: kurir } = await supabase.from('kurir').select('*')
  const { data: outlets } = await supabase.from('outlets').select('*')
  const { data: logs } = await supabase
    .from('upload_logs')
    .select('*, kurir(kode, nama), outlet:outlets(nama)')
    .order('created_at', { ascending: false })
    .limit(20)

  return <UploadClient kurirList={kurir || []} outletList={outlets || []} logs={logs || []} />
}
