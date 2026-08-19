export type UserRole = 'owner' | 'admin' | 'staff'
export type KurirKode = 'LION' | 'JNE' | 'JNT' | 'WAHANA'
export type TransaksiStatus = 'POD' | 'CNX' | 'PENDING' | 'TRANSIT' | 'RETURN'

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
