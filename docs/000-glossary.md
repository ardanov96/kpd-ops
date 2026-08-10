# 📖 Glossary — Istilah Teknis & Akunting

Dokumen ini jadi acuan istilah yang dipakai di sprint-sprint lain. Tujuannya: biar AI agent (atau developer lain) tidak salah tafsir.

---

## 🏢 Istilah Bisnis

| Istilah | Definisi | Catatan |
|---|---|---|
| **Outlet** | Cabang/agen ekspedisi | Saat ini: 1 outlet fisik di Kepundung |
| **Franchise / Kurir** | Merek ekspedisi (LION, JNE, J&T, WAHANA) | Semua franchise digabung dalam 1 ruangan outlet |
| **STT** | Surat Tanda Terima = nomor resi pengiriman | Unique per kurir |
| **POD** | Proof of Delivery = paket sudah diterima | Status akhir sukses |
| **CNX** | Canceled = pengiriman dibatalkan | Status akhir gagal |
| **COD** | Cash on Delivery = bayar di tempat | Paket dengan nilai tagihan |
| **NON-COD** | Pembayaran di muka | Paket reguler |
| **Omzet** | Total pendapatan sebelum diskon biaya | `SUM(transaksi.total_biaya)` |
| **Net Omzet** | Omzet setelah dikurangi diskon | `omzet - diskon` |

---

## 💰 Istilah Akunting

| Istilah | Definisi | Akun di Sistem |
|---|---|---|
| **Pendapatan (Income)** | Uang yang masuk dari operasional | 4100 Pendapatan Ekspedisi |
| **Beban (Expense)** | Biaya operasional untuk jalankan usaha | 5100–5400 series |
| **ATK** | Alat Tulis Kantor (karton, lakban, kertas print, plastik packing) | 5100 Beban ATK & Packaging |
| **Modal (Equity)** | Uang yang ditanam pemilik | 3100 Modal Pemilik |
| **Prive** | Penarikan modal untuk kepentingan pribadi | 3200 Prive |
| **Laba Ditahan** | Akumulasi laba yang tidak dibagikan | 3900 Laba Ditahan |
| **Closing Bulanan** | Proses tutup buku akhir bulan | Tabel `periode_closing` |

---

## 🧾 Istilah Pajak

| Istilah | Definisi | Berlaku Untuk Anda |
|---|---|---|
| **NPWP** | Nomor Pokok Wajib Pajak | ✅ Sudah ada |
| **PKP** | Pengusaha Kena Pajak (wajib PPN) | ❌ Non-PKP (omzet < 4.8 M) |
| **PPh Final 0,5%** | Pajak final UMKM (tarif 0,5% × omzet bruto) | ✅ Tarif yang dipakai |
| **SSP** | Surat Setoran Pajak = bukti bayar ke DJP | Upload di modul pajak |
| **e-Billing DJP** | Sistem DJP untuk generate kode billing | Manual di website DJP |
| **SPT** | Surat Pemberitahuan Tahunan | Tahunan (Form 1770S3 untuk WPOP Badan) |

---

## 🔧 Istilah Teknis (Project)

| Istilah | Definisi |
|---|---|
| **Migration** | File SQL di `supabase/migrations/` yang dijalankan berurutan |
| **RLS** | Row Level Security = filter data per user di level database |
| **Trigger DB** | Fungsi PostgreSQL yang auto-fire saat tabel berubah |
| **View DB** | Query tersimpan yang dipanggil seperti tabel |
| **Recurring Transaction** | Template transaksi yang auto-generate tiap bulan (WiFi, listrik) |
| **Auto-journal** | Insert otomatis ke `transaksi_keuangan` dari sumber lain (XLSX, inventaris) |
| **Closing Period** | Status "locked" untuk satu bulan — tidak bisa diedit |
| **Bucket** | Folder di Supabase Storage untuk simpan file (nota, bukti SSP) |

---

## 🗂️ Prefiks Kode Akun

| Kode Range | Tipe Akun |
|---|---|
| 1xxx | Aset |
| 2xxx | Liability (Hutang) |
| 3xxx | Equity (Modal, Prive, Laba Ditahan) |
| 4xxx | Income (Pendapatan) |
| 5xxx | Expense (Beban Operasional) |

---

## � Single Source of Truth

Jika ada konflik antara glossary ini dengan dokumen lain, **glossary ini yang menang** (silakan update glossary dulu kalau ada istilah baru).
