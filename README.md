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

## Perbaikan UI, akses role, dan performa navigasi (putaran kedua)

- **Login pakai username**, bukan email — lihat `get_email_by_username()` di
  `supabase/schema.sql` dan `src/app/login/page.tsx`. Email tetap ada di
  Supabase Auth, tapi tidak pernah diketik/dilihat pengguna. Username diisi
  lewat kolom `username` di tabel `profiles`.
- **Job Order & Shipment sekarang juga muncul untuk Warehouse Staff**, tidak
  cuma SPV/Owner — sebelumnya modul ini sebenarnya sudah ada di kode, hanya
  tersembunyi dari menu karena daftar role di `components/app-shell.tsx`
  belum menyertakan `warehouse_staff`. Settings tetap khusus SPV/Owner.
- **Layout jadi sidebar kiri persisten** (`components/app-shell.tsx`),
  dengan versi drawer untuk layar kecil — menggantikan tab horizontal di
  atas. Tiap halaman sekarang punya judul (`<h1 className="page-title">`)
  di dalam konten, tidak cuma mengandalkan tab aktif.
- **Palet warna netral hangat (stone) + satu warna aksen (indigo)**,
  konsisten di seluruh halaman (`tailwind.config.ts`, `globals.css`).
  Kartu dashboard sekarang berubah warna sesuai kondisi datanya (`card`,
  `card-warning`, `card-danger`, `card-accent` di `globals.css`) — misal
  kartu "Mendekati kadaluarsa" baru oranye kalau memang ada datanya, kartu
  "Di bawah safety stock" dipindah ke paling atas dashboard supaya info
  mendesak terlihat duluan.
- **`loading.tsx` di setiap halaman** (`src/app/(app)/*/loading.tsx`) —
  skeleton kotak-kotak yang muncul instan saat pindah menu, sebelum data
  dari Supabase selesai diambil. Ini penambahan paling berdampak untuk
  kesan "lambat" saat navigasi, karena semua halaman pakai
  `dynamic = "force-dynamic"` (selalu ambil data terbaru — sengaja, demi
  akurasi data untuk fungsi audit), sehingga `<Link>` prefetch bawaan
  Next.js (sudah dipakai sejak awal) tidak banyak membantu untuk halaman
  se-dinamis ini; skeleton yang memberi feedback instan.
- Date input distyle senada dengan dropdown/input lain (border, radius,
  tinggi seragam) — ikon kalender bawaan browser tidak bisa di-restyle
  total tanpa library date-picker terpisah, jadi itu satu-satunya bagian
  yang masih terlihat sedikit "bawaan browser".

## Revisi ketiga: harga, stok, maklon, logo

- **Ke mana harga Rp 900.000 / Rp 12.750.000 di shipment kamu berasal?**
  Dari `default_price` yang saya isi sebagai **contoh/placeholder** di seed
  data `supabase/schema.sql` (Ethanol Rp45.000/L, bibit parfum Rp850.000/L)
  waktu bikin skema pertama kali — bukan harga asli. Sekarang sudah bisa
  diubah langsung dari Settings → Master item (lihat poin berikutnya),
  tinggal diedit ke harga sebenarnya.
- **Harga sekarang bisa diatur dari UI** — kolom "Harga" ditambahkan di
  form Tambah Item dan bisa diedit inline per item di
  Settings → Master item. Snapshot harga per Shipment tetap jalan seperti
  sebelumnya (tidak berubah walau Master Harga diedit belakangan).
- **Settings → Maklon** (halaman baru) — ganti nama maklon, atur apakah
  maklon itu perlu dikirim ethanol/bibit, tambah maklon baru. Ada tab kecil
  di atas Settings untuk pindah antara "Master item" dan "Maklon".
- **Halaman Stok** (baru, menu sendiri di sidebar) — tabel stok per item,
  dikelompokkan per kategori (Bahan baku/Packaging/FG), lengkap dengan
  qty saat ini, harga, dan nilai. Ini yang sebelumnya belum ada — Dashboard
  cuma menunjukkan total per kategori, bukan rincian per item.
- **Link "Cetak surat jalan" sekarang buka tab baru**, tidak menggantikan
  halaman Job Order yang sedang dibuka.
- **Logo/favicon** — ditambahkan di `app/icon.svg` (favicon), login,
  sidebar, dan surat jalan lewat komponen `components/logo.tsx`. Ini masih
  **placeholder monogram "P"**, bukan logo asli PURVU — tinggal ganti isi
  file itu begitu ada logo resminya, otomatis konsisten di ke-4 tempat itu.

## Revisi keempat: logo asli

- Logo asli PT Apurva Wijaya Madani (AWM) sudah dipasang, menggantikan
  monogram placeholder:
  - `public/logo-icon.png` — mark ikon saja, dipakai di sidebar/mobile top
    bar lewat `components/logo.tsx`, dan juga jadi favicon (`src/app/icon.png`,
    format Next.js untuk auto-detect favicon).
  - `public/logo-full.jpg` — lockup lengkap (ikon + nama perusahaan),
    dipakai di halaman login.
  - `public/logo-192.png` & `logo-512.png` — ukuran standar untuk ikon PWA
    (Add to Home Screen), direferensikan di `public/manifest.json`.
- Nama aplikasi tetap "PURVU Inventory" di teks (sidebar, login) — yang
  diganti cuma mark visualnya ke identitas AWM sesuai fail yang dikirim.

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
