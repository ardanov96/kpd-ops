import { createAdminClient } from '@/lib/supabase/server'
import InventarisOpnameClient from '@/components/dashboard/InventarisOpnameClient'

export const dynamic = 'force-dynamic'

export default async function OpnamePage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

  // Ambil outlet (hardcoded)
  const { data: outlet } = await supabase
    .from('outlets')
    .select('id, kode, nama')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!outlet) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>Belum ada outlet</h1>
      </div>
    )
  }

  // Default periode = bulan ini
  const now = new Date()
  const defaultPeriode = params.periode || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Cek apakah opname untuk periode ini sudah ada
  const { data: existingOpname } = await supabase
    .from('opname')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('periode', defaultPeriode)
    .maybeSingle()

  // Fetch stok aktual semua barang aktif (untuk input opname)
  const { data: stokList } = await supabase
    .from('v_stok_aktual')
    .select('*, kategori:kategori_inventaris(kode, nama)')
    .eq('outlet_id', outlet.id)
    .order('nama')

  // List opname history
  const { data: opnameHistory } = await supabase
    .from('opname')
    .select('*, items:opname_item(id, barang_id)')
    .eq('outlet_id', outlet.id)
    .order('periode', { ascending: false })
    .limit(12)

  // Kalau ada opname existing, fetch detail items
  let existingItems: any[] = []
  if (existingOpname) {
    const { data } = await supabase
      .from('opname_item')
      .select('*')
      .eq('opname_id', existingOpname.id)
    existingItems = data || []
  }

  return (
    <InventarisOpnameClient
      outlet={outlet}
      periode={defaultPeriode}
      stokList={stokList || []}
      existingOpname={existingOpname}
      existingItems={existingItems}
      opnameHistory={opnameHistory || []}
    />
  )
}
