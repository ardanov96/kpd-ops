import { query } from '@/lib/db'
import { getActiveOutlet } from '@/lib/db/outlet'
import AkuntingClient from '@/components/dashboard/AkuntingClient'

export const dynamic = 'force-dynamic'

export default async function AkuntingPage() {
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

  const now = new Date()
  const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const periodes: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periodes.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  let labaRugiHistory: any[] = []
  let breakdown: any[] = []
  let recent: any[] = []
  let closingBulanIni: any = null

  try {
    const lrRes = await query(
      'SELECT periode, total_income, total_expense, laba_kotor FROM v_laba_rugi WHERE outlet_id = $1 AND periode = ANY($2) ORDER BY periode ASC',
      [outlet.id, periodes]
    )
    labaRugiHistory = lrRes.rows

    const bdRes = await query(
      'SELECT kategori_kode, kategori_nama, kategori_tipe, nominal_income, nominal_expense, jumlah_transaksi FROM v_keuangan_per_kategori WHERE outlet_id = $1 AND periode = $2 ORDER BY nominal_expense DESC',
      [outlet.id, currentPeriode]
    )
    breakdown = bdRes.rows

    const recRes = await query(`
      SELECT tk.id, tk.tanggal, tk.tipe, tk.nominal, tk.metode, tk.keterangan, tk.sumber,
        json_build_object('kode', k.kode, 'nama', k.nama) as kategori
      FROM transaksi_keuangan tk
      LEFT JOIN kategori_akun k ON k.id = tk.kategori_id
      WHERE tk.outlet_id = $1
      ORDER BY tk.tanggal DESC, tk.created_at DESC
      LIMIT 10
    `, [outlet.id])
    recent = recRes.rows

    const clRes = await query(
      'SELECT * FROM periode_closing WHERE outlet_id = $1 AND periode = $2 LIMIT 1',
      [outlet.id, currentPeriode]
    )
    closingBulanIni = clRes.rows[0] || null
  } catch (e) {
    console.error('Error fetching akunting page data:', e)
  }

  const lrBulanIni = labaRugiHistory.find((r: any) => r.periode === currentPeriode)
  const totalIncome = lrBulanIni ? Number(lrBulanIni.total_income) : 0
  const totalExpense = lrBulanIni ? Number(lrBulanIni.total_expense) : 0
  const labaKotor = lrBulanIni ? Number(lrBulanIni.laba_kotor) : 0

  return (
    <AkuntingClient
      outlet={outlet}
      currentPeriode={currentPeriode}
      periodes={periodes}
      labaRugiHistory={labaRugiHistory}
      breakdown={breakdown}
      recent={recent}
      kpi={{ totalIncome, totalExpense, labaKotor }}
      closingBulanIni={closingBulanIni}
    />
  )
}
