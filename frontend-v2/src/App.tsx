import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./routes/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DutySchedulePage } from "./pages/DutySchedulePage";
import { PosPage } from "./pages/PosPage";
import { PelayananPage } from "./pages/PelayananPage";
import { GudangPage } from "./pages/GudangPage";
import { LaporanPage } from "./pages/LaporanPage";
import { NotaPage } from "./pages/NotaPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OrderPage } from "./pages/OrderPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { TechnicianManagementPage } from "./pages/TechnicianManagementPage";
import { BackupPage } from "./pages/BackupPage";
import { ForbiddenPage, NotFoundPage, ServerErrorPage } from "./pages/ErrorPages";
import { RequireAuth } from "./components/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/pelayanan" element={<PelayananPage />} />
          <Route path="/pelayanan/servis" element={<Navigate to="/pelayanan" replace />} />
          <Route path="/pelayanan/servis/:id" element={<ServiceDetailPage />} />
          <Route path="/pelayanan/pesanan" element={<OrderPage />} />
          <Route path="/pelayanan/pesanan/:id" element={<OrderDetailPage />} />
          <Route path="/gudang" element={<GudangPage />} />
          <Route path="/laporan" element={<LaporanPage />} />
          <Route path="/nota" element={<NotaPage />} />
          <Route path="/pengaturan" element={<SettingsPage />} />
          <Route path="/pengaturan/piket" element={<DutySchedulePage />} />
          <Route path="/pengaturan/pengguna" element={<UserManagementPage />} />
          <Route path="/pengaturan/teknisi" element={<TechnicianManagementPage />} />
          <Route path="/pengaturan/backup" element={<BackupPage />} />
        </Route>
      </Route>

      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}