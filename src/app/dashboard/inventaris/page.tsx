import { createAdminClient } from '@/lib/supabase/server'
import InventarisClient from '@/components/dashboard/InventarisClient'

export const dynamic = 'force-dynamic'

export default async function InventarisPage() {
  const supabase = createAdminClient()

  // Ambil outlet pertama (hardcoded - sesuai konsistensi pola existing)
  const { data: outlet } = await supabase
    .from('outlets')
    .select('id, kode, nama')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!outlet) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>
          Belum ada outlet
        </h1>
        <p style={{ color: '#94a3b8', marginTop: 8 }}>
          Tambahkan outlet di Supabase terlebih dahulu.
        </p>
      </div>
    )
  }

  // Fetch stok aktual via view (join kategori)
  const { data: stokList } = await supabase
    .from('v_stok_aktual')
    .select('*, kategori:kategori_inventaris(id, kode, nama)')
    .eq('outlet_id', outlet.id)
    .order('nama')

  // Fetch kategori untuk form
  const { data: kategoriList } = await supabase
    .from('kategori_inventaris')
    .select('*')
    .or(`outlet_id.is.null,outlet_id.eq.${outlet.id}`)
    .order('nama')

  // Count barang di bawah minimum
  const belowMinCount = (stokList || []).filter((s: any) => s.is_below_min).length

  return (
    <InventarisClient
      outlet={outlet}
      initialStok={stokList || []}
      kategoriList={kategoriList || []}
      belowMinCount={belowMinCount}
    />
  )
}
