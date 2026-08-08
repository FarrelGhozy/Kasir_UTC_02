# DoD #92 — Migrasi & Lengkapi Frontend v2 (React + Vite + Tailwind + Router)

## Ringkasan
Frontend v2 tuntas sesuai peta rute #92. Semua fitur v1 yang relevan dibawa & rute yang
sebelumnya hilang sudah dibuat + natigasi sidebar diperbarui.

## Fitur / Rute yang DIBANGUN (baru)
| Rute | Halaman | Keterangan |
|------|---------|-----------|
| `/pengaturan` | SettingsPage (hub) | Kartu menu: Piket, Pengguna, Teknisi, Backup (admin) |
| `/pengaturan/pengguna` | UserManagementPage | CRUD user + reset password + toggle active (RBAC admin) |
| `/pengaturan/teknisi` | TechnicianManagementPage | Kelola role teknisi (RBAC admin) |
| `/pengaturan/backup` | BackupPage | Download JSON + checksum SHA-256 + restore (admin) |
| `/pelayanan/pesanan` | OrderPage | Monitoring pesanan khusus (special order) |
| `/pelayanan/pesanan/:id` | OrderDetailPage | Detail finansial + FSM status + catat pembayaran |
| `/pelayanan/servis/:id` | ServiceDetailPage | Detail tiket: pelanggan, device, parts, log timeline |
| `/pelayanan/servis` | redirect → `/pelayanan` | Paritas v1 (halaman pelayanan sudah ada) |
| favicon | `public/vite.svg` | Hilangkan 404 resource |

Sidebar ditambah nav "Pesanan 🛍️".

## Backend baru
- `routes/users.ts` + `services/userService.ts` — CRUD user/teknisi (ADMIN ONLY), bcrypt utk
  create & reset password, prevent hapus diri sendiri, password_hash tidak pernah bocor.
- `GET /api/v2/orders` (list) — `listOrders` di orderService via `listOrders` export.
- Konvensi: `create` return 200 (konsisten dgn route lain), `mapError`, `t.Object` schema.

## Verifikasi
- **TSC 0** (backend & frontend).
- **Regresi backend 75/75 PASS** (189 expect, 9 files) — naik dari 70 (termasuk 5 test #92).
- **E2E Playwright** — semua rute render non-404:
  `/pengaturan`, `/pengaturan/pengguna`, `/pengaturan/teknisi`, `/pengaturan/backup`,
  `/pengaturan/piket`, `/pelayanan/pesanan`, `/pelayanan`; detail order `/:id` render ✓.
- **RBAC teruji**: kasir → 403 pada `/users`; reset-password & toggle & delete user jalan.
- Live `172.20.20.200:8090` — container `utc_frontend_v2`, `utc_backend_v2` sehat.

## Nota
- Prod v1 (5300/27018) tidak disentuh selama kerja #92.
- Tidak ada secret/kredensial ditulis; semua lewat `.env`.