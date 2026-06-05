# Arcadia Studio (DaikiWebgacor)

Website server Minecraft roleplay dengan sistem login/register, member area, pengumuman, showcase pengembangan server, dan admin panel.

## Panduan Menjalankan Aplikasi

Aplikasi ini dibangun menggunakan **pnpm workspaces** yang memisahkan antara frontend (React + Vite), backend API server (Express), dan library database (Drizzle ORM).

Aplikasi ini telah dikonfigurasi agar dapat dijalankan dengan mudah baik di **Lokal (Windows/macOS/Linux)** maupun kembali di **Replit**.

---

### Persiapan Awal (Lokal & Replit)

1. **Gunakan Node.js v20+**
   Rekomendasi versi Node.js yang digunakan adalah **v24** (sesuai spesifikasi Replit).

2. **Install PNPM**
   Pastikan pnpm terinstall global di komputer Anda:
   ```bash
   npm install -g pnpm
   ```

3. **Konfigurasi Environment Variables (`.env`)**
   Buat file `.env` di root folder project. Anda bisa menduplikat file `.env.example` yang sudah disediakan:
   ```bash
   copy .env.example .env
   ```
   Lalu isi nilai-nilai berikut:
   * **`DATABASE_URL`**: URL koneksi database PostgreSQL Anda (misalnya `postgresql://username:password@localhost:5432/daikiweb`).
   * **`CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`**: Key autentikasi Clerk Anda (dari Clerk Dashboard).
   * **`VITE_CLERK_PUBLISHABLE_KEY`**: Key publishable Clerk untuk frontend (harus sama dengan `CLERK_PUBLISHABLE_KEY`).

---

### Cara Menjalankan di Lokal (Local Development)

#### 1. Install Dependencies & Sinkronisasi Database
Pastikan database PostgreSQL lokal Anda sudah menyala, lalu jalankan perintah berikut secara berurutan di terminal root:
```bash
# 1. Install seluruh package/dependencies
pnpm install

# 2. Build libraries & schemas
pnpm run build

# 3. Sinkronisasikan struktur database Drizzle ke PostgreSQL lokal Anda
pnpm --filter @workspace/db run push
```

#### 2. Jalankan Server Pengembangan (Dev Mode)
Untuk menjalankan frontend (port `5173`) dan backend API server (port `5000`) secara bersamaan:
```bash
pnpm run dev
```

* **Frontend** akan berjalan di: `http://localhost:5173`
* **Backend API** akan berjalan di: `http://localhost:5000`
* *Note:* Setiap request API dari frontend ke `/api` secara otomatis akan di-proxy oleh Vite ke backend server lokal (port 5000) tanpa mengalami kendala CORS.

---

### Cara Menjalankan Kembali di Replit (Replit Environment)

Jika Anda memindahkan kode ini kembali ke Replit:

1. **Replit Secrets**
   Pastikan Anda telah mendaftarkan environment variables berikut pada tab **Secrets** (ikon gembok) di workspace Replit Anda:
   * `DATABASE_URL`
   * `CLERK_PUBLISHABLE_KEY`
   * `CLERK_SECRET_KEY`
   * `VITE_CLERK_PUBLISHABLE_KEY`

2. **System Database**
   Di Replit, database PostgreSQL biasanya sudah terintegrasi dan `DATABASE_URL` akan terisi otomatis. Anda tinggal menjalankan perintah push database:
   ```bash
   pnpm --filter @workspace/db run push
   ```

3. **Tombol Run Replit**
   File konfigurasi `.replit` sudah otomatis ter-setting. Anda tinggal menekan tombol **Run** berwarna hijau di atas, dan Replit akan otomatis menginstal package serta menyalakan port server.

---

### Daftar Perintah Penting (Workspace Scripts)

* **`pnpm run dev`**: Menjalankan frontend dan backend API server secara paralel.
* **`pnpm run build`**: Membangun/men-compile seluruh library dan backend API server.
* **`pnpm run typecheck`**: Melakukan validasi tipe data TypeScript di seluruh workspace.
* **`pnpm --filter @workspace/api-spec run codegen`**: Meregenerasi otomatis React API hooks & skema Zod berdasarkan spec OpenAPI (`lib/api-spec/openapi.yaml`).
* **`pnpm --filter @workspace/db run push`**: Melakukan push migrasi database Drizzle ke PostgreSQL target.
