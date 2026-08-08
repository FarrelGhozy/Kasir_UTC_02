import { lazy, Suspense } from "react";
import type { ReactElement } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./routes/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { ForbiddenPage, NotFoundPage, ServerErrorPage } from "./pages/ErrorPages";
import { PageLoader } from "./components/PageLoader";

// #startup-ux: lazy per-halaman → tiap route jadi chunk sendiri.
// recharts (Dashboard), browser-image-compression (Pelayanan/Order), ServiceWizard
// hanya di-download saat halaman itu dibuka — dulu SEMUA ikut di bundle 795KB
// sehingga buka halaman apa pun terasa berat (terutama di HP).
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const PosPage = lazy(() => import("./pages/PosPage").then((m) => ({ default: m.PosPage })));
const PelayananPage = lazy(() => import("./pages/PelayananPage").then((m) => ({ default: m.PelayananPage })));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetailPage").then((m) => ({ default: m.ServiceDetailPage })));
const OrderPage = lazy(() => import("./pages/OrderPage").then((m) => ({ default: m.OrderPage })));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })));
const GudangPage = lazy(() => import("./pages/GudangPage").then((m) => ({ default: m.GudangPage })));
const LaporanPage = lazy(() => import("./pages/LaporanPage").then((m) => ({ default: m.LaporanPage })));
const NotaPage = lazy(() => import("./pages/NotaPage").then((m) => ({ default: m.NotaPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const DutySchedulePage = lazy(() => import("./pages/DutySchedulePage").then((m) => ({ default: m.DutySchedulePage })));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage").then((m) => ({ default: m.UserManagementPage })));
const TechnicianManagementPage = lazy(() => import("./pages/TechnicianManagementPage").then((m) => ({ default: m.TechnicianManagementPage })));
const BackupPage = lazy(() => import("./pages/BackupPage").then((m) => ({ default: m.BackupPage })));

// Fallback Suspense: feedback instan saat chunk route sedang dimuat
// (chunk kecil → tampil sekejap, bukan layar kosong).
const withLoader = (el: ReactElement) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={withLoader(<LoginPage />)} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={withLoader(<DashboardPage />)} />
          <Route path="/pos" element={withLoader(<PosPage />)} />
          <Route path="/pelayanan" element={withLoader(<PelayananPage />)} />
          <Route path="/pelayanan/servis" element={<Navigate to="/pelayanan" replace />} />
          <Route path="/pelayanan/servis/:id" element={withLoader(<ServiceDetailPage />)} />
          <Route path="/pelayanan/pesanan" element={withLoader(<OrderPage />)} />
          <Route path="/pelayanan/pesanan/:id" element={withLoader(<OrderDetailPage />)} />
          <Route path="/gudang" element={withLoader(<GudangPage />)} />
          <Route path="/laporan" element={withLoader(<LaporanPage />)} />
          <Route path="/nota" element={withLoader(<NotaPage />)} />
          <Route path="/pengaturan" element={withLoader(<SettingsPage />)} />
          <Route path="/profil" element={withLoader(<ProfilePage />)} />
          <Route path="/pengaturan/piket" element={withLoader(<DutySchedulePage />)} />
          <Route path="/pengaturan/pengguna" element={withLoader(<UserManagementPage />)} />
          <Route path="/pengaturan/teknisi" element={withLoader(<TechnicianManagementPage />)} />
          <Route path="/pengaturan/backup" element={withLoader(<BackupPage />)} />
        </Route>
      </Route>

      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
