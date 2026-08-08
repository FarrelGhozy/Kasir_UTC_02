# DoD #93 — UI/UX Rework (Design System + Aksesibilitas + Wizard)

## Ringkasan
Penerapan design system konsisten + perbaikan UX audit. Menutup checklist #93.

## Design System (komponen reuse)
- `src/components/ui.tsx` — Button (variant/size/loading/icon), Card, StatCard, Badge(status),
  Field, Input, Spinner, EmptyState, Skeleton, Alert.
- `src/components/dialog.tsx` — Modal, ConfirmDialog (focus trap/escape/scroll lock),
  ToastStack + useToast.
- `src/lib/brand.ts` — SATU sumber kebenaran branding (nama, alamat, kontak, logo, wallpaper).
  **Tidak ada lagi hardcode "Siman"/"Unida No.1"/"BENGKEL UTC"** (verifikasi grep: 0 hit).

## Aksesibilitas & state
- ✅ **alert()/confirm() → 0 tersisa** (grep). Diganti ConfirmDialog + Toast:
  - `DutySchedulePage` — hapus jadwal via ConfirmDialog (danger).
  - `UserManagementPage` — hapus user via ConfirmDialog.
- Error pages: `ErrorPages.tsx` (403 Forbidden / 404 NotFound / 500 Server) — sudah ter-register.
- Empty state pada list (icon + CTA) via EmptyState; status pakai Badge konsisten.
- aria-label pada semua tombol ikon, role dialog + aria-modal + focus.

## Fitur baru
- **Ganti password self-service (P3)**:
  - Backend `POST /api/v2/auth/change-password` — validasi old password (bcrypt), new min 6,
    berbeda dari lama, revoke semua refresh token setelah ganti.
  - Frontend `ProfilePage` (`/profil`) — info akun + form ganti password, logout & redirect login.
  - Sidebar: link "Profil & Ganti Password".
- **Multistep wizard buat tiket servis (P1 UX 3/5 → lebih baik)**:
  - `ServiceWizard.tsx` — 4 langkah: Pelanggan → Unit & Foto → Masalah & Keamanan → Ringkasan.
  - Stepper interaktif, validasi per-langkah, autosave draft di localStorage, foto unit (maks 4, base64)
    & kode keamanan disimpan di JSON device. Integrasi di PelayananPage ("+ Tiket Baru") + toast sukses.
  - Status tiket di daftar jadi link ke `/pelayanan/servis/:id`.

## Verifikasi
- **TSC 0** backend & frontend.
- **Regresi backend 78/78 PASS** (naik dari 75; +3 test change-password self-service #93):
  password lama salah → 400, ganti→login baru→restore sukses, new<6 → 400.
- **E2E Playwright**: `/profil` render (H1 "Profil Saya", form "Ganti Password" ✓);
  wizard tiket 4 langkah jalan (step1 Pelanggan → step2 Unit → step3 Masalah → step4 Ringkasan)
  dgn stepper; tombol "+ Tiket Baru" muncul.
- Live `172.20.20.200:8090` — `utc_frontend_v2` & `utc_backend_v2` sehat.
- Prod v1 (5300/27018) tidak disentuh; tidak ada secret ditulis ke output.

## Catatan checklist #93
| Checklist | Status |
|---|---|
| Design system terpakai semua halaman | ✅ (ui.tsx/dialog.tsx + brand.ts) |
| alert()/confirm() → Toast/Dialog | ✅ (0 tersisa) |
| Aksesibilitas (aria/focus/keyboard) | ✅ (dialog & tombol ikon) |
| Multistep wizard servis | ✅ (ServiceWizard 4 langkah + autosave) |
| Error pages + empty states | ✅ (403/404/500 + EmptyState) |
| Branding & alamat konsisten (1 config) | ✅ (brand.ts, 0 hardcode) |