import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import InventarisDetailClient from '@/components/dashboard/InventarisDetailClient'

export const dynamic = 'force-dynamic'

export default async function InventarisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createAdminClient()

  // Ambil detail barang
  const { data: barang, error } = await supabase
    .from('barang')
    .select('*, kategori:kategori_inventaris(kode, nama)')
    .eq('id', id)
    .single()

  if (error || !barang) notFound()

  // Ambil view v_stok_aktual untuk stok terkini
  const { data: stok } = await supabase
    .from('v_stok_aktual')
    .select('*')
    .eq('barang_id', id)
    .maybeSingle()

  // Ambil kartu stok (semua movement)
  const { data: movements } = await supabase
    .from('v_kartu_stok')
    .select('*')
    .eq('barang_id', id)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <InventarisDetailClient
      barang={barang}
      stok={stok}
      movements={movements || []}
    />
  )
}
