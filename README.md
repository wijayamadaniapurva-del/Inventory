# PURVU Inventory & Production

Web app inventory + production tracking untuk produksi parfum PURVU via maklon.
Dibangun dari brief dan wireframe yang sudah direview bersama owner.

## Stack

- **Next.js 14** (App Router, TypeScript) — di-hosting di **Vercel**
- **Supabase** — Postgres (database), Auth (login per role), Row Level Security
- **Tailwind CSS** — styling
- PWA-ready (`public/manifest.json`) — bisa "Add to Home Screen" di HP

Sesuai brief: seluruh akun (GitHub, Supabase, Vercel) sebaiknya dibuat dan
dimiliki langsung oleh pihak owner sejak awal, bukan numpang akun developer.

## Setup dari nol

1. **Buat project Supabase baru** di https://supabase.com (akun milik owner).
2. Buka **SQL Editor** di dashboard Supabase, tempel isi `supabase/schema.sql`,
   lalu jalankan. Ini akan membuat semua tabel, enum, view, RLS policy, dan
   men-seed master item + maklon awal yang sudah dikonfirmasi.
3. Di **Project Settings → API**, salin `Project URL` dan `anon public key`.
4. Copy `.env.local.example` jadi `.env.local`, isi dua nilai di atas.
5. Install dependency & jalankan lokal:
   ```bash
   npm install
   npm run dev
   ```
   Buka http://localhost:3000.
6. **Buat user pertama**: di Supabase dashboard → Authentication → Users →
   Add user (isi email + password). Trigger otomatis akan membuat baris di
   tabel `profiles` dengan role default `warehouse_staff`. Untuk menjadikan
   user tsb Owner/SPV/Finance, edit kolom `role` di Table Editor → `profiles`.
7. **Deploy ke Vercel**: import repo ini ke akun Vercel owner, isi kedua env
   var yang sama di Project Settings → Environment Variables, lalu deploy.

## Struktur project

```
src/
  app/
    login/                    halaman login
    (app)/                    grup halaman yang butuh login
      dashboard/
      input/                  Input stok (masuk / transfer / keluar)
      job-order/[id]/         Job Order + Shipment + HPP riil
      riwayat/                log pergerakan stok, bisa difilter
      settings/master-item/   kelola kategori & item + tag BPOM
    surat-jalan/[shipmentId]/ halaman print surat jalan (di luar nav)
  components/                 form-form interaktif (client components)
  lib/
    supabase/                 client & server Supabase client
    types.ts                  tipe data sesuai schema.sql
    utils.ts                  format WIB, Rupiah, label lokasi/kategori
supabase/schema.sql           seluruh skema database
```

## Keputusan desain yang sudah dikonfirmasi & tertanam di kode

- **Kategori & satuan**: Bahan baku (Liter), Packaging (Pcs/Meter), FG (Pcs) —
  item baru ditambah lewat Settings, tidak perlu sentuh kode/backend.
- **Tag BPOM** melekat ke SKU (bukan per batch), diedit langsung di
  Settings → Master item.
- **3 tipe pergerakan stok**: masuk / transfer / keluar. Transfer FG dari
  Gudang L2 → Gudang L1 memblokir item ber-tag Non-BPOM (lihat validasi di
  `input-stok-form.tsx` dan constraint di database).
- **Job Order → banyak Shipment**: biaya jasa maklon di level Job Order,
  harga material di-snapshot per Shipment (`shipment_items.unit_price`) supaya
  HPP historis tidak berubah kalau harga master naik/turun.
- **HPP riil** = (total biaya material semua shipment + biaya jasa) ÷
  **actual output** — dihitung otomatis di halaman detail Job Order.
- **Actual output** selalu diisi manual oleh owner (form `close-job-order-form`),
  tidak pernah diambil dari klaim maklon.
- **Toleransi selisih output**: tidak ada — selisih ditampilkan apa adanya
  tanpa threshold (lihat `app_settings.output_variance_tolerance`).
- Semua timestamp disimpan UTC (`timestamptz`), ditampilkan WIB lewat
  `formatWib()`.

## Yang masih perlu dibangun/disempurnakan

Ini scaffold awal yang sudah bisa dipakai, tapi beberapa bagian sengaja
disederhanakan dan perlu dilengkapi sebelum benar-benar dipakai harian:

1. **Integrasi Scalev** — baru disiapkan strukturnya (`scalev_sync_log` table,
   kolom `scalev_product_id`, folder `app/api/webhooks/` belum dibuat). Endpoint
   push stok & terima event RTS masih perlu diimplementasikan setelah endpoint
   resminya dicek.
2. **QC & terima FG dari maklon** — tabel `fg_batches` sudah ada tapi belum
   ada halaman UI-nya. Ini tempat status Reject dan Belum-BPOM per batch
   sebaiknya dicatat (terpisah dari tag BPOM per-SKU di Master item).
3. **Safety stock formula** — baru tersimpan sebagai `app_settings` (JSON) dan
   kolom `safety_stock_qty` per item; logika hitung otomatis dari formula
   belum diimplementasikan, saat ini nilainya harus diisi manual per item.
4. **RLS per role** — saat ini semua user yang login bisa baca & tulis semua
   tabel. Perlu dipersempit sesuai role (mis. Finance read-only, Warehouse
   Staff hanya bisa nulis ke `stock_movements`).
5. **Modul Nilai Stok & Rekap Bulanan** — belum dibuat sebagai halaman
   terpisah; saat ini datanya sudah bisa dihitung dari view `v_current_stock`
   dan `stock_movements`, tinggal dibuatkan tampilan bulanannya.
6. **Print surat jalan** masih HTML sederhana (`window.print()`), belum
   PDF generation.
7. **Ikon PWA** — `manifest.json` belum diisi icon (butuh logo PURVU).
