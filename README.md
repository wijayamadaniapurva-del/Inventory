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

## Revisi kelima: transparansi logo, role Owner/Finance, hapus job order, tanggal kadaluarsa bahan baku

- **Logo icon sekarang transparan** (background putihnya dihilangkan lewat
  color-key + alpha ramp supaya tepinya tetap halus, bagian krem di dalam
  mark tidak ikut tembus). File yang berubah: `public/logo-icon.png`,
  `src/app/icon.png`, `public/logo-192.png`, `public/logo-512.png`.
- **Kalau logo di halaman login masih belum muncul** setelah upload ulang:
  kemungkinan besar file `public/logo-full.jpg` belum benar-benar ke-upload
  ke repo (bukan bug di kode — build lokal saya lolos tanpa masalah).
  Cara cek: buka `https://<domain-vercel-kamu>/logo-full.jpg` langsung di
  browser. Kalau muncul gambar → masalahnya di cache/Vercel, coba redeploy.
  Kalau 404 → file itu memang belum ada di repo, upload ulang khusus folder
  `public/`.
- **Role Owner**: sekarang murni viewer untuk Job Order & Shipment — bisa
  buka daftar dan detail, tapi tombol "Job order baru", "Tambah shipment",
  dan "Tutup job order" tidak muncul untuknya. Ini mengoreksi desain awal
  yang sempat bilang "actual output diisi owner" — sekarang itu jadi tugas
  SPV/Warehouse Staff, Owner cuma melihat hasilnya.
- **Role Finance**: sekarang juga bisa membuka Job Order & Shipment
  (sebelumnya tidak bisa sama sekali), sifatnya viewer sama seperti Owner,
  termasuk bisa buka/cetak surat jalan tiap shipment.
- **Role Settings**: dipersempit jadi SPV saja (Owner tidak lagi termasuk),
  menjawab pertanyaan terbuka dari revisi sebelumnya.
- **Hapus Job Order**: tombol hapus (ikon 🗑) muncul di daftar Job Order,
  khusus untuk role SPV, dengan konfirmasi sebelum benar-benar terhapus.
  Menghapus job order otomatis ikut menghapus semua shipment-nya.
- **Pembatasan role di atas bukan cuma sembunyi tombol** — saya juga
  perketat aturan di level database (Row Level Security), supaya Owner/
  Finance memang tidak bisa input job order walau dicoba lewat cara lain
  di luar UI. Ini butuh SQL tambahan, lihat instruksi di chat.
- **Tanggal kadaluarsa bahan baku**: field baru "Tanggal kadaluarsa
  (opsional)" muncul di Input Stok setiap kali tipe "Masuk" + kategori
  "Bahan baku" dipilih. Tersimpan di kolom `stock_movements.expiry_date`
  (baru), dan otomatis muncul juga di kartu "Mendekati kadaluarsa" di
  Dashboard bersama data dari FG.
- **Soal harga di shipment**: itu **harga per satuan** (per Liter untuk
  ethanol/bibit, per Pcs untuk botol/stiker, dst), bukan harga beli per
  batch pembelian. Total yang tertera di layar = qty dikali harga per
  satuan itu. Kalau harga beli aktualmu per batch beda dari qty × harga
  default, edit saja harga per satuan di Settings → Master item supaya
  hasil kali-nya sesuai.

## Revisi keenam: logo permanen, biaya jasa fleksibel, Riwayat lengkap, export, konfirmasi aksi

- **Logo login sekarang di-embed langsung di kode** (base64, file
  `src/components/login-logo-data.ts`) — tidak lagi bergantung pada file
  `public/logo-full.jpg` ter-upload dengan benar, jadi seharusnya tidak
  akan gagal muncul lagi.
- **Biaya jasa maklon bisa diisi/diubah kapan saja** dari halaman detail
  Job Order (klik "(ubah)" di sebelah angkanya), tidak cuma saat job order
  dibuka pertama kali.
- **Material yang dikirim ke maklon (Shipment) sekarang otomatis tercatat
  di Riwayat** sebagai tipe "transfer" ke nama maklon yang jelas (bukan
  cuma label generik "Maklon"), lengkap dengan catatan job order/SKU mana
  yang terkait.
- **Riwayat tidak lagi menampilkan entri ke customer** (penjualan reguler
  memang seharusnya sinkron dari Scalev terpisah, bukan tercampur di log
  pergerakan material internal ini).
- **Export Excel** ditambahkan di halaman Stok (seluruh item semua
  kategori, termasuk tab "Semua" baru dengan total nilai keseluruhan) dan
  Riwayat (mengikuti filter yang sedang aktif).
- **Semua tombol submit sekarang minta konfirmasi OK/Batal** sebelum benar-benar tersimpan (Input Stok, Job Order baru, Tutup Job Order, Tambah Shipment, Master Item, Maklon).
- **Label "FG" diganti jadi "Finish Good"** di seluruh tampilan.
- **Tanggal kadaluarsa sekarang juga bisa diisi untuk Finish Good**, tidak
  cuma bahan baku, di Input Stok.
- **Soal actual output & stok FG**: menutup Job Order (mengisi actual
  output) TIDAK otomatis menambah stok FG — itu murni angka untuk
  perhitungan HPP. Stok FG baru bertambah kalau memang di-input manual
  lewat Input Stok (Masuk → Finish Good) setelah lolos QC. Belum ada
  layar QC khusus (poin #2 di bawah), jadi untuk sekarang itu masih
  langkah manual terpisah — tapi memang tidak ada auto-update yang
  melewati proses itu.
- **Soal stok per batch dengan tanggal kadaluarsa berbeda**: saat ini
  belum dipisah — Stok menjumlahkan semua qty per SKU jadi satu angka
  total, tidak peduli itu dari batch mana atau kadaluarsa kapan. Detail
  per-batch tetap tercatat mentah di `stock_movements` (dan muncul
  terpisah di alert "Mendekati kadaluarsa"), cuma belum ditampilkan
  sebagai baris stok yang terpisah per batch di halaman Stok. Ini
  perubahan struktural yang cukup besar (perlu FEFO — first-expired-
  first-out — untuk tentukan batch mana yang dikurangi duluan saat
  barang keluar) — didiskusikan dulu di chat sebelum dikerjakan.

## Yang masih perlu dibangun/disempurnakan

Ini scaffold awal yang sudah bisa dipakai, tapi beberapa bagian sengaja
disederhanakan dan perlu dilengkapi sebelum benar-benar dipakai harian:

1. **Integrasi Scalev** — baru disiapkan strukturnya (`scalev_sync_log` table,
   kolom `scalev_product_id`, folder `app/api/webhooks/` belum dibuat). Endpoint
   push stok & terima event RTS masih perlu diimplementasikan setelah endpoint
   resminya dicek.
2. **QC & terima FG dari maklon** — tabel `fg_batches` sudah ada tapi belum
   ada halaman UI-nya. Ini tempat status Reject dan Belum-BPOM per batch
   sebaiknya dicatat (terpisah dari tag BPOM per-SKU di Master item), dan
   idealnya jadi gerbang resmi sebelum stok FG bertambah (saat ini
   menambah stok FG masih manual lewat Input Stok, tidak lewat proses QC
   terstruktur).
3. **Safety stock formula** — baru tersimpan sebagai `app_settings` (JSON) dan
   kolom `safety_stock_qty` per item; logika hitung otomatis dari formula
   belum diimplementasikan, saat ini nilainya harus diisi manual per item.
4. **RLS per role** — sudah diperketat untuk Job Order/Shipment (lihat
   revisi kelima), tabel lain (master_items, maklon, app_settings) masih
   permisif untuk semua user yang login; persempit lagi kalau perlu.
5. **Modul Rekap Bulanan** — halaman Stok sudah ada (dengan export Excel),
   tapi rekap per-bulan (bukan cuma snapshot saat ini) belum dibuat.
6. **Print surat jalan** masih HTML sederhana (`window.print()`), belum
   PDF generation.
7. **Ikon PWA** — sudah pakai logo AWM (lihat revisi keempat).
8. **Stok per batch/kadaluarsa** — saat ini diagregasi per SKU saja, belum
   dipisah per batch/tanggal kadaluarsa (lihat revisi keenam untuk detail).

## Revisi ketujuh: logo permanen transparan, format Rupiah, Master Data

- **Logo login sekarang transparan juga** (background putihnya dihilangkan
  dengan teknik sama seperti logo icon), jadi tidak ada lagi kotak putih
  yang kelihatan menempel di halaman login.
- Teks "Masuk dengan akun yang sudah didaftarkan admin." dihapus dari
  halaman login.
- **Semua field harga/biaya sekarang pakai format Rupiah dengan pemisah
  ribuan** (mis. "Rp 3.000.000", bukan "3000000") — komponen baru
  `components/currency-input.tsx`, dipakai di Biaya Jasa Maklon (buka job
  order & ubah belakangan) dan Harga di Master Data.
- **"Settings" diganti nama jadi "Master Data"** — karena isinya memang
  murni data master (item & maklon), bukan pengaturan aplikasi. Kalau
  nanti ada fitur pengaturan sungguhan (mis. rumus safety stock), bisa
  ditambah sebagai bagian terpisah nanti.
- **Tag BPOM/Non-BPOM**: ini sebenarnya sudah ada sejak beberapa revisi
  lalu, di Master Data → tab "Finish Good" → kolom "Tag BPOM" (bisa
  diedit langsung per SKU, dan ada juga saat tambah item baru). Kemungkinan
  belum ketemu karena menu Master Data cuma muncul untuk role SPV — kalau
  testing pakai role lain, memang tidak akan kelihatan di sidebar.

## Revisi kedelapan: safety stock formula, bug shipment kosong, bug ghost data, layout Input Stok

- **Safety Stock sekarang dihitung dari formula**, bukan angka manual:
  rata-rata pemakaian harian x lead time (hari) x (1 + faktor buffer%).
  Dikelola dari Master Data → Safety Stock (SPV only) — faktor buffer satu
  angka global (`app_settings` key `safety_stock_buffer_percent`), dua
  field lain per item (`master_items.avg_daily_usage`, `.lead_time_days`).
  Kolom lama `safety_stock_qty` tidak dipakai lagi (dibiarkan ada di
  skema, tidak dihapus, supaya tidak perlu migrasi drop kolom).
- **Shipment kosong sekarang benar-benar tidak bisa disimpan** — tombol
  submit disable di frontend, dan validasi asli ada di fungsi database
  baru `create_shipment()` yang membuat shipment + shipment_items +
  entri Riwayat sekaligus dalam satu transaksi atomik (kalau gagal di
  tengah jalan, semuanya batal, tidak ada data setengah jadi).
- **Bug ghost data di Stok diperbaiki** — akar masalahnya: view
  `v_current_stock` tidak pernah menyaring `is_active`, jadi item yang
  diarsipkan tetap nongol. Sudah difilter di semua query yang pakai view
  ini (Dashboard, Stok).
- **Pola hapus item di Master Data disempurnakan**: sekarang coba hapus
  permanen dulu (berhasil kalau item itu belum pernah dipakai di transaksi
  manapun — foreign key yang menentukan, bukan pengecekan manual), kalau
  gagal (karena sudah pernah dipakai) otomatis fallback ke arsipkan
  seperti sebelumnya. Pesan status ditampilkan supaya user tahu mana yang
  terjadi.
- **Halaman Input Stok**: layout 2 kolom (form + panel "Input terakhir"
  menampilkan 8 input terbaru), dan date picker tanggal kadaluarsa diganti
  jadi komponen custom (`components/date-picker.tsx`) yang senada dengan
  dropdown/input lain di form yang sama — bukan lagi widget bawaan browser.

## Revisi kesembilan: rekap bulanan otomatis (cron)

- **Setiap tanggal 1, sistem otomatis merekam snapshot nilai stok bulan
  sebelumnya** lewat Vercel Cron (`vercel.json`, jadwal `0 17 1 * *` UTC
  = sekitar tengah malam WIB tanggal 1) yang memanggil
  `src/app/api/cron/monthly-snapshot`. Tersimpan di tabel baru
  `monthly_stock_snapshots` (satu baris per item per bulan: qty, harga,
  nilai — nama item disalin apa adanya saat itu, jadi tidak berubah
  walau nanti item di-rename/diarsipkan).
- Cron route ini pakai **Supabase service role key** (bukan anon key),
  karena cron tidak pernah login sebagai user — makanya ada 2 env var
  baru yang WAJIB ditambahkan di Vercel (lihat instruksi di chat):
  `SUPABASE_SERVICE_ROLE_KEY` dan `CRON_SECRET`. `CRON_SECRET` yang
  memverifikasi bahwa permintaan itu benar dari Vercel Cron, bukan dari
  sembarang orang yang tahu URL-nya.
- **Halaman baru Stok → Rekap Bulanan** — pilih bulan dari dropdown,
  lihat rincian per item, export ke Excel. Muncul kosong sampai cron
  pertama kali jalan (tanggal 1 bulan berikutnya) — untuk data bulan-
  bulan sebelumnya yang sudah lewat, tidak bisa direkonstruksi otomatis
  karena stok historisnya tidak tercatat sebagai snapshot.
- `src/proxy.ts` disesuaikan supaya route di bawah `/api/*` tidak ikut
  diarahkan ke halaman login (cron tidak punya sesi login sama sekali).

## Revisi kesepuluh: QC menggantikan input manual actual output, Audit Trail

- **Alur Job Order berubah**: FG yang balik dari maklon sekarang wajib
  lewat pencatatan **QC** dulu (lolos / reject, per batch, bisa dicatat
  beberapa kali untuk pengiriman bertahap) sebelum Job Order bisa
  ditutup. Actual output **tidak lagi diketik manual** — otomatis
  dihitung dari total qty yang lolos QC (`fungsi database
  close_job_order()`).
- Tiap qty yang lolos QC otomatis menambah stok FG (`submit_qc_batch()`)
  **dan** ditandai `job_order_id`-nya — begitu juga tiap shipment bahan
  baku ke maklon (lewat `create_shipment()` yang sudah ada). Ini yang
  bikin audit trail sekarang bisa ditelusuri per Job Order.
- **Halaman baru Audit Trail** — daftar semua Job Order dengan ringkasan
  target vs lolos QC vs reject vs selisih, baris yang ada selisihnya
  otomatis ditandai warna merah muda. Klik baris untuk buka detail
  lengkapnya di halaman Job Order.
- Kolom baru `stock_movements.job_order_id` dan tabel view baru
  `v_job_order_variance` (dipakai halaman Audit Trail).
- **Belum diselesaikan** (didiskusikan dulu di chat): variance di titik
  perpindahan Gudang L2 → L1 belum bisa ditelusuri presisi, karena itu
  butuh pelacakan stok per-batch (bukan per-SKU teragregasi seperti
  sekarang) — ini keputusan yang sama dengan pertanyaan kadaluarsa Adele
  sebelumnya, masih ditunda.
- **Integrasi RTS dari Scalev** masih belum dibangun (baru sebatas
  rencana: webhook masuk dari Scalev ke webapp ini, arahnya memang
  seperti itu sesuai desain awal) — perlu dicek dulu format webhook RTS
  Scalev yang persis sebelum diimplementasikan.

## Revisi kesebelas: stok dipisah per lantai gudang

- **Stok sekarang dipecah per lantai** (Gudang L2 / Gudang L1), bukan
  cuma satu angka total — karena FG yang lolos QC tidak otomatis pindah
  ke L1 (keterbatasan ruang), jadi bisa saja ada stok yang "nyangkut" di
  L2 menunggu dipindah manual. `v_current_stock` sekarang punya kolom
  `qty_gudang_l2` dan `qty_gudang_l1` di samping `qty_on_hand` (total,
  tetap dipakai apa adanya untuk kartu nilai di Dashboard).
- Halaman Stok menampilkan dua kolom terpisah "Stok L2" dan "Stok L1"
  untuk semua kategori (bukan cuma FG) — export Excel juga ikut pecah.

## Revisi kedua belas: pisahkan selisih produksi maklon vs reject QC

- Kartu Job Order sekarang menunjukkan **"Diterima dari maklon"** dan
  **"Selisih produksi maklon"** (target − diterima) terpisah dari
  **"Reject QC"** — sebelumnya cuma ada satu angka "Selisih dari target"
  yang menggabungkan dua penyebab berbeda jadi satu, gampang disalah-
  artikan (kebetulan di satu contoh kasus angkanya sama, padahal
  penyebabnya beda: kurang kirim dari maklon vs gagal QC).
- Tidak ada perubahan skema database untuk ini — murni perhitungan ulang
  di tampilan dari data yang sudah ada (`fg_batches`).

## Revisi ketiga belas: Transfer dibatasi per kategori, item stok-0 disaring

- **Transfer** sekarang cuma bisa untuk kategori Packaging (khusus arah
  Gudang L2 ↔ Vendor Cat, untuk proses cat botol) dan Finish Good (cuma
  arah Gudang L2 → L1, dikunci otomatis, tidak ada dropdown bebas lagi).
  Bahan baku tidak lagi muncul di Transfer — pengirimannya ke maklon
  selalu lewat Job Order & Shipment.
- **Masuk** sekarang cuma untuk Bahan baku dan Packaging. Finish Good
  dikeluarkan dari daftar kategori Masuk karena stok FG sekarang resminya
  masuk lewat fitur QC (supaya semua stok FG tetap tertaut ke Job Order
  asalnya) — bukan keputusan final, gampang dikembalikan kalau ternyata
  masih dibutuhkan.
- **Item dengan stok 0 di lokasi asal disaring dari dropdown** (bukan
  cuma di-disable) saat Transfer — khusus untuk asal Gudang L2 yang
  datanya akurat; untuk asal Vendor Cat belum ada data stok tertelusur,
  jadi belum difilter di sana.
- **Keluar tidak diubah** — masih menunggu konfirmasi apakah use case-nya
  (KOL/karyawan, write-off) masih dipakai.
