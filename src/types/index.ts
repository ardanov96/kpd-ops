// ============================================================
// CONSTANTS (Sprint 6 - Fix ISU #18)
// Extract dari inline literals yang tersebar di banyak file.
// ============================================================

export const PAJAK_STATUS = ['BELUM', 'LUNAS', 'BEAS'] as const
export const TRANSAKSI_TIPE = ['MASUK', 'KELUAR', 'TRANSFER'] as const
export const METODE_PEMBAYARAN = ['CASH', 'BANK', 'EWALLET'] as const
export const SUMBER_TRANSAKSI = ['MANUAL', 'INVENTARIS', 'KURIR', 'RECURRING', 'CLOSING', 'PRIVE'] as const
export const TIPE_STOK_MOVEMENT = ['IN', 'OUT', 'ADJ'] as const
export const STATUS_OPNAME = ['DRAFT', 'FINAL'] as const
export const REF_TYPE_STOK = ['MANUAL', 'OPNAME', 'INVENTARIS_AUTO'] as const
export const TIPE_AKUN = ['INCOME', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY'] as const
export const JENIS_PAJAK = ['PPH_FINAL_05'] as const
export const FORM_SPT_OPTIONS = ['1770S3', '1770S', '1771'] as const
export const METODE_PPH_OPTIONS = ['FINAL_05'] as const
export const KURIR_KODE = ['LION', 'JNE', 'JNT', 'WAHANA'] as const
export const USER_ROLES = ['owner', 'admin', 'staff'] as const
export const TRANSAKSI_STATUS = ['POD', 'CNX', 'PENDING', 'TRANSIT', 'RETURN'] as const

export type UserRole = (typeof USER_ROLES)[number]
export type KurirKode = (typeof KURIR_KODE)[number]
export type TransaksiStatus = (typeof TRANSAKSI_STATUS)[number]

export interface Outlet {
  id: string
  kode: string
  nama: string
  alamat?: string
  kota?: string
  created_at: string
}

export interface Profile {
  id: string
  nama: string
  role: UserRole
  outlet_id?: string
  created_at: string
}

export interface Kurir {
  id: string
  kode: KurirKode
  nama: string
  warna: string
}

export interface Transaksi {
  id: string
  outlet_id: string
  kurir_id: string
  nomor_stt: string
  tanggal: string
  jenis_kiriman: string
  kota_tujuan: string
  kecamatan_tujuan?: string
  nama_produk?: string
  komoditas?: string
  koli: number
  berat_kena_biaya: number
  publish_rate: number
  shipping_surcharge: number
  biaya_asuransi: number
  total_sebelum_potongan: number
  potongan: number
  total_biaya: number
  diskon_booking: number
  status: TransaksiStatus
  created_at: string
  // joined
  kurir?: Kurir
  outlet?: Outlet
}

export interface SummaryBulanan {
  outlet: string
  kurir: string
  kurir_warna: string
  periode: string
  total_paket: number
  total_koli: number
  total_omzet: number
  total_diskon: number
  net_omzet: number
  pod_count: number
  cnx_count: number
  pod_rate: number
}

export interface UploadLog {
  id: string
  outlet_id: string
  kurir_id: string
  filename: string
  periode?: string
  total_rows: number
  success_rows: number
  error_rows: number
  errors?: unknown
  created_at: string
}

// ============================================================
// MODUL INVENTARIS (Sprint 1)
// ============================================================

export type TipeStokMovement = 'IN' | 'OUT' | 'ADJ'
export type StatusOpname = 'DRAFT' | 'FINAL'
export type RefTypeStok = 'MANUAL' | 'OPNAME' | 'INVENTARIS_AUTO'

export interface KategoriInventaris {
  id: string
  outlet_id?: string | null
  kode: string
  nama: string
  deskripsi?: string | null
  created_at: string
}

export interface Barang {
  id: string
  outlet_id: string
  kategori_id: string
  sku?: string | null
  nama: string
  satuan: string
  stok_min: number
  harga_beli: number
  aktif: boolean
  created_at: string
  // joined
  kategori?: KategoriInventaris
}

export interface StokMovement {
  id: string
  outlet_id: string
  barang_id: string
  tipe: TipeStokMovement
  qty: number
  harga_satuan: number
  total: number
  ref_type?: RefTypeStok | null
  ref_id?: string | null
  keterangan?: string | null
  tanggal: string
  created_by?: string | null
  created_at: string
}

// View: v_stok_aktual
export interface StokAktual {
  barang_id: string
  outlet_id: string
  kategori_id: string
  sku?: string | null
  nama: string
  satuan: string
  stok_min: number
  harga_beli: number
  aktif: boolean
  stok: number
  total_nilai_masuk: number
  is_below_min: boolean
}

// View: v_kartu_stok
export interface KartuStok {
  barang_id: string
  outlet_id: string
  tanggal: string
  tipe: TipeStokMovement
  qty: number
  harga_satuan: number
  total: number
  keterangan?: string | null
  ref_type?: RefTypeStok | null
  ref_id?: string | null
  created_at: string
}

export interface Opname {
  id: string
  outlet_id: string
  periode: string  // 'YYYY-MM'
  tanggal_opname: string
  status: StatusOpname
  catatan?: string | null
  created_by?: string | null
  finalized_at?: string | null
  created_at: string
}

export interface OpnameItem {
  id: string
  opname_id: string
  barang_id: string
  qty_sistem: number
  qty_fisik: number
  selisih?: number | null
  harga_satuan?: number | null
  catatan?: string | null
  // joined
  barang?: Barang
}

// ============================================================
// MODUL AKUNTING (Sprint 2)
// ============================================================

export type TipeAkun = 'INCOME' | 'EXPENSE' | 'ASSET' | 'LIABILITY' | 'EQUITY'
export type TipeTransaksiKeuangan = 'MASUK' | 'KELUAR' | 'TRANSFER'
export type SumberTransaksi = 'MANUAL' | 'INVENTARIS' | 'KURIR' | 'RECURRING' | 'CLOSING' | 'PRIVE'
export type MetodeBayar = 'CASH' | 'BANK' | 'EWALLET'

export interface KategoriAkun {
  id: string
  outlet_id?: string | null
  kode: string
  nama: string
  tipe: TipeAkun
  parent_id?: string | null
  is_system: boolean
  urutan: number
  created_at: string
}

export interface TransaksiKeuangan {
  id: string
  outlet_id: string
  tanggal: string
  tipe: TipeTransaksiKeuangan
  kategori_id: string
  sumber: SumberTransaksi
  ref_id?: string | null
  nominal: number
  metode?: MetodeBayar | null
  keterangan?: string | null
  lampiran_url?: string | null
  created_by?: string | null
  created_at: string
  // joined
  kategori?: KategoriAkun
}

// View: v_laba_rugi
export interface LabaRugi {
  outlet_id: string
  periode: string
  total_income: number
  total_expense: number
  laba_kotor: number
}

// View: v_cashflow
export interface Cashflow {
  outlet_id: string
  periode: string
  metode: MetodeBayar
  cashflow: number
}

// View: v_keuangan_per_kategori
export interface KeuanganPerKategori {
  outlet_id: string
  periode: string
  kategori_id: string
  kategori_kode: string
  kategori_nama: string
  kategori_tipe: TipeAkun
  nominal_income: number
  nominal_expense: number
  jumlah_transaksi: number
}

// View: v_neraca
export interface Neraca {
  outlet_id: string
  outlet_kode: string
  outlet_nama: string
  total_aset_kas: number
  total_aset_lain: number
  total_aset: number
  total_liability: number
  total_modal_pemilik: number
  total_laba_ditahan: number
  total_equity: number
  selisih: number
}

export interface PeriodeClosing {
  id: string
  outlet_id: string
  periode: string
  total_income: number
  total_expense: number
  laba: number
  is_locked: boolean
  closed_at?: string | null
  closed_by?: string | null
  catatan?: string | null
  created_at: string
}

export interface RecurringTransaction {
  id: string
  outlet_id: string
  kategori_id: string
  nama_template: string
  nominal: number
  metode?: MetodeBayar | null
  tanggal_setiap_bulan: number
  tipe: TipeTransaksiKeuangan
  aktif: boolean
  last_run?: string | null
  created_at: string
  // joined
  kategori?: KategoriAkun
}

// ============================================================
// MODUL PAJAK (Sprint 3)
// ============================================================

export type StatusBayarPajak = 'BELUM' | 'LUNAS' | 'BEAS'
export type JenisPajak = 'PPH_FINAL_05'
export type FormSPT = '1770S3' | '1770S' | '1771'
export type MetodePPh = 'FINAL_05'

export interface PajakConfig {
  outlet_id: string
  npwp?: string | null
  nama_wp?: string | null
  metode_pph: MetodePPh
  pkp: boolean
  omzet_tahunan: number
  form_spt: FormSPT
  updated_at: string
}

export interface PajakRekap {
  id: string
  outlet_id: string
  periode: string  // 'YYYY-MM'
  jenis_pajak: JenisPajak
  dasar_pengenaan: number
  tarif: number    // 0.5 (persen)
  nilai_pajak: number
  status_bayar: StatusBayarPajak
  tanggal_bayar?: string | null
  bukti_url?: string | null
  catatan?: string | null
  created_by?: string | null
  created_at: string
}

// View: v_spt_tahunan_estimator
export interface SPTTahunanEstimator {
  outlet_id: string
  tahun: string
  total_omzet: number
  total_pph_final: number
  bulan_lunas: number
  bulan_belum: number
  total_bulan: number
}

// View: v_pajak_reminder
export interface PajakReminder {
  id: string
  outlet_id: string
  periode: string
  jenis_pajak: JenisPajak
  nilai_pajak: number
  status_bayar: StatusBayarPajak
  tanggal_jatuh_tempo: string
  sisa_hari: number
}
