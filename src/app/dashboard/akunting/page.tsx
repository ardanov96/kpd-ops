import { createAdminClient } from '@/lib/supabase/server'
import AkuntingClient from '@/components/dashboard/AkuntingClient'

export const dynamic = 'force-dynamic'

export default async function AkuntingPage() {
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

  // Default periode = bulan ini
  const now = new Date()
  const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Laba-Rugi 6 bulan terakhir (untuk chart)
  // Generate list 6 bulan ke belakang, lalu query view
  const periodes: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periodes.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const { data: labaRugi } = await supabase
    .from('v_laba_rugi')
    .select('periode, total_income, total_expense, laba_kotor')
    .eq('outlet_id', outlet.id)
    .in('periode', periodes)
    .order('periode', { ascending: true })

  // KPI bulan ini
  const lrBulanIni = (labaRugi || []).find((r: any) => r.periode === currentPeriode)
  const totalIncome = lrBulanIni ? Number(lrBulanIni.total_income) : 0
  const totalExpense = lrBulanIni ? Number(lrBulanIni.total_expense) : 0
  const labaKotor = lrBulanIni ? Number(lrBulanIni.laba_kotor) : 0

  // Breakdown per kategori bulan ini (untuk tabel top expense)
  const { data: breakdown } = await supabase
    .from('v_keuangan_per_kategori')
    .select('kategori_kode, kategori_nama, kategori_tipe, nominal_income, nominal_expense, jumlah_transaksi')
    .eq('outlet_id', outlet.id)
    .eq('periode', currentPeriode)
    .order('nominal_expense', { ascending: false })

  // 10 transaksi terakhir (untuk recent activity)
  const { data: recent } = await supabase
    .from('transaksi_keuangan')
    .select('id, tanggal, tipe, nominal, metode, keterangan, sumber, kategori:kategori_akun(kode, nama)')
    .eq('outlet_id', outlet.id)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10)

  // Cek apakah bulan ini sudah closing
  const { data: closingBulanIni } = await supabase
    .from('periode_closing')
    .select('*')
    .eq('outlet_id', outlet.id)
    .eq('periode', currentPeriode)
    .maybeSingle()

  return (
    <AkuntingClient
      outlet={outlet}
      currentPeriode={currentPeriode}
      periodes={periodes}
      labaRugiHistory={labaRugi || []}
      breakdown={breakdown || []}
      recent={recent || []}
      kpi={{ totalIncome, totalExpense, labaKotor }}
      closingBulanIni={closingBulanIni}
    />
  )
}
