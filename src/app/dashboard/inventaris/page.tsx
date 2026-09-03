import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import InventarisClient from '@/components/dashboard/InventarisClient'

export const dynamic = 'force-dynamic'

export default async function InventarisPage() {
  const outlet = await getActiveOutlet()

  if (!outlet) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>
          Belum ada outlet
        </h1>
        <p style={{ color: '#94a3b8', marginTop: 8 }}>
          Tambahkan outlet di database terlebih dahulu.
        </p>
      </div>
    )
  }

  let stokList: any[] = []
  let kategoriList: any[] = []

  try {
    const stokRes = await query(`
      SELECT sa.*,
        json_build_object('id', k.id, 'kode', k.kode, 'nama', k.nama) as kategori
      FROM v_stok_aktual sa
      LEFT JOIN barang b ON b.id = sa.barang_id
      LEFT JOIN kategori_inventaris k ON k.id = b.kategori_id
      WHERE sa.outlet_id = $1
      ORDER BY sa.nama ASC
    `, [outlet.id])
    stokList = stokRes.rows

    const katRes = await query(
      'SELECT * FROM kategori_inventaris WHERE outlet_id IS NULL OR outlet_id = $1 ORDER BY nama ASC',
      [outlet.id]
    )
    kategoriList = katRes.rows
  } catch (e) {
    console.error('Error fetching inventaris page data:', e)
  }

  if (kategoriList.length === 0) {
    kategoriList = [
      { id: '00000000-0000-0000-0000-000000000101', kode: 'PKG', nama: 'Packaging', deskripsi: 'Karton, lakban, plastik packing, bubble wrap' },
      { id: '00000000-0000-0000-0000-000000000102', kode: 'ATK', nama: 'ATK & Cetak', deskripsi: 'Kertas thermal resi, kertas HVS, label stiker' },
      { id: '00000000-0000-0000-0000-000000000103', kode: 'PRL', nama: 'Perlengkapan Packing', deskripsi: 'Dispenser lakban, gunting, cutter, timbangan' },
      { id: '00000000-0000-0000-0000-000000000104', kode: 'OPS', nama: 'Operasional & Kebersihan', deskripsi: 'Kantong sampah, pembersih lantai, tisu' },
      { id: '00000000-0000-0000-0000-000000000105', kode: 'LNN', nama: 'Lain-lain', deskripsi: 'Kategori umum untuk barang perlengkapan lainnya' },
    ]
  }

  const belowMinCount = stokList.filter((s: any) => s.is_below_min).length

  return (
    <InventarisClient
      outlet={outlet}
      initialStok={stokList}
      kategoriList={kategoriList}
      belowMinCount={belowMinCount}
    />
  )
}
