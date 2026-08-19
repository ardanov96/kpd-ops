# 📂 Folder `docs/` — Sprint Brief & Dokumentasi

Folder ini berisi semua dokumen singkat (brief) yang terkait dengan **sprint planning**, **spesifikasi modul**, dan **panduan kolaborasi** untuk project **Ekspedisi Dashboard**.

> **Konvensi penamaan file:**
> - `000-...md` → Dokumen meta (README, glossary, index)
> - `00N-sprint-...md` → Sprint ke-N (planning + task list)
> - `MODUL-...md` → Dokumentasi fitur modul yang **sudah selesai** (cara pakai, API, alur kerja)
> - `xxx-spec-...md` → Brief spesifik (schema, workflow, referensi)

---

## 📑 Daftar Dokumen

| File | Isi | Status |
|---|---|---|
| `000-README.md` | Dokumen ini (index & konvensi) | ✅ |
| `000-glossary.md` | Istilah teknis & akunting yang dipakai | ✅ |
| `001-sprint-modul-inventaris.md` | Sprint 1 — Modul Inventaris (task list) | ✅ |
| `002-sprint-modul-akunting.md` | Sprint 2 — Modul Akunting | ✅ |
| `003-sprint-modul-pajak.md` | Sprint 3 — Modul Pelaporan Pajak | ✅ |
| `004-sprint-storage-recurring.md` | Sprint 4 — Storage + Recurring Transaction | ✅ |
| `005-sprint-export-pdf-xlsx.md` | Sprint 5 — Export PDF/XLSX & Polish | ✅ |
| `MODUL-INVENTARIS.md` | Dokumentasi fitur Modul Inventaris (cara pakai, API, alur kerja) | ✅ |
| `010-spec-schema.md` | Schema SQL final (gabungan semua migration) | ✅ |
| `020-spec-workflow.md` | Workflow & otomasi tiap modul | ✅ |
| `030-decision-log.md` | Log keputusan & alasan teknis | ✅ |

---

## 🔗 Cara Pakai Folder Ini

1. **Mulai sprint baru** → buka file sprint yang relevan (misal `001-sprint-modul-inventaris.md`)
2. **Paham fitur yang sudah jadi** → buka `MODUL-...md` (misal `MODUL-INVENTARIS.md` setelah Sprint 1 selesai)
3. **Cek referensi schema** → buka `010-spec-schema.md`
4. **Paham kenapa keputusan X diambil** → buka `030-decision-log.md`

File-file di folder ini adalah **single source of truth** untuk development.
Sebelum mulai kerja, baca file sprint yang relevan dulu.
