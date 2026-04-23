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
