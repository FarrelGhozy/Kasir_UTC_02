import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./routes/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DutySchedulePage } from "./pages/DutySchedulePage";
import { PosPage } from "./pages/PosPage";
import { PelayananPage } from "./pages/PelayananPage";
import { GudangPage } from "./pages/GudangPage";
import { LaporanPage } from "./pages/LaporanPage";
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
          <Route path="/gudang" element={<GudangPage />} />
          <Route path="/laporan" element={<LaporanPage />} />
          <Route path="/pengaturan/piket" element={<DutySchedulePage />} />
        </Route>
      </Route>

      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}