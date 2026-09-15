# Dokumentasi Fitur: Lion Parcel Monthly Penalty

Dokumen ini mendeskripsikan implementasi fitur "Penalti Bulanan Lion Parcel" yang otomatis memotong omzet jika total omzet kotor per bulan kurang dari batas minimum (Rp 3.000.000). Dokumen ini berfungsi sebagai panduan arsitektur bagi pengembang atau AI agent lainnya.

## 1. Latar Belakang & Aturan Bisnis
- **Target Franchise**: Khusus untuk kurir/ekspedisi Lion Parcel (kode `LION`).
- **Kondisi Penalti**: Jika total akumulasi **omzet kotor** (`total_biaya`) untuk Lion Parcel dalam 1 bulan (periode tertentu) berada **di bawah Rp 3.000.000**.
- **Nilai Penalti**: Pemotongan sebesar **Rp 500.000**.
- **Pencatatan**: Penalti dicatat ke sistem akunting sebagai **Beban/Pengeluaran** (Expense) agar transparan dalam laporan laba/rugi, dan juga memotong nilai *Net Profit* pada tampilan modul Ringkasan & Analitik.

## 2. Arsitektur Database (Supabase)

Perubahan pada level database diimplementasikan melalui migration file `supabase/migrations/015_lion_penalty.sql`.

### A. Update Unique Index
Untuk memungkinkan *insert* transaksi "Pendapatan" (MASUK) dan "Penalti" (KELUAR) pada tanggal dan sumber yang sama (`sumber = 'KURIR'`), `unique index` lama dihapus dan dipisah berdasarkan `tipe`:
```sql
drop index if exists idx_unique_kurir_income;
create unique index if not exists idx_unique_kurir_income_masuk 
  on transaksi_keuangan (outlet_id, tanggal) where sumber = 'KURIR' and tipe = 'MASUK';
create unique index if not exists idx_unique_kurir_income_keluar 
  on transaksi_keuangan (outlet_id, tanggal) where sumber = 'KURIR' and tipe = 'KELUAR';
```

### B. View: `v_summary_bulanan`
Ditambahkan kalkulasi on-the-fly untuk kolom `penalty` dan pengurangan nilai penalti dari `net_omzet`.
- **`penalty`**: Akan berisi `500000` jika kurir = 'LION' dan `sum(t.total_biaya) < 3000000`. Jika tidak, bernilai `0`.
- **`net_omzet`**: Omzet setelah dikurangi diskon, dan dikurangi lagi dengan penalti jika kriteria penalti terpenuhi.

### C. Function: `fn_aggregate_income`
Fungsi trigger yang merangkum *income* ini dimodifikasi untuk:
1. Meng-kalkulasi *income* bersih seperti biasa (insert ke `transaksi_keuangan` sebagai tipe `MASUK`).
2. Menghitung secara terpisah omzet kotor khusus untuk kurir LION (`v_lion_omzet`).
3. Jika `v_lion_omzet > 0` dan `< 3000000`, maka sistem melakukan insert/update data penalti ke `transaksi_keuangan` sebagai tipe `KELUAR` (Expense) senilai 500.000 dengan kategori `5900` (Beban Lain-lain).
4. Jika omzet LION ternyata `>= 3000000` (karena adanya pembaruan/re-upload), sistem otomatis menghapus (DELETE) penalti yang mungkin sebelumnya telah tercatat di bulan tersebut.

## 3. Implementasi Frontend

### A. Modul Ringkasan (`src/components/dashboard/OverviewClient.tsx`)
- **Penarikan Data**: Mengambil kolom `penalty` dari record `v_summary_bulanan`.
- **Kalkulasi Net Profit**: Total agregat `netProfit` dikurangi dengan total seluruh penalti (`totalPenalty`).
- **UI KPI Card**: Kartu *Net Profit* otomatis berubah indikatornya (warna ikon/border menjadi merah) dan menampilkan teks *"Telah dipotong Penalty Rp 500.000"* jika penalti eksis pada bulan/filter yang dipilih.
- **UI Grid Per Kurir**: Menambahkan grid/kolom informasi **Penalty** berwarna merah pada tampilan metrik kurir (hanya muncul apabila kurir tersebut memang terkena penalti).

### B. Modul Analitik (`src/components/dashboard/AnalitikClient.tsx`)
- Tab **Perbandingan Periode** menghitung on-the-fly (`isLionPenalty`) karena menggunakan data mentah transaksi.
- Jika terdeteksi LION Omzet < 3 Juta, variabel `penalty` di-set 500.000.
- Data `penalty` tersebut ditampilkan dalam kolom tabel "Perbandingan Periode", ditandai dengan angka pemotongan minus (`-Rp 500.000`) dan text merah untuk memudahkan *tracking*.

## 4. Maintenance / Troubleshooting untuk AI Agent
Jika Anda diminta untuk memodifikasi fitur ini di kemudian hari:
1. **Mengubah nominal penalti atau batas omzet**: Anda harus mengupdate **KEDUA** tempat:
   - Migration `015_lion_penalty.sql` (untuk `v_summary_bulanan` dan `fn_aggregate_income`).
   - Hardcoded condition di `AnalitikClient.tsx` baris `isLionPenalty` dan penentuan nilai `500000`.
2. **Kategori Penalti di Laporan Keuangan**: Saat ini penalti menggunakan kategori ID yang merujuk pada kode `5900` (Beban Lain-lain). Jika user ingin memisahkannya menjadi akun/kategori "Beban Penalti" tersendiri, Anda harus menambahkan insert ke tabel `kategori_akun` (misal kode `5950`) dan menyesuaikan query pencarian `v_kategori_expense` di `fn_aggregate_income`.
