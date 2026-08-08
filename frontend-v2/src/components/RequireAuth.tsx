import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function RequireAuth() {
  const { isAuthenticated, bootstrapping } = useAuth();

  // Saat halaman dimuat ulang, sesi masih dipulihkan dari refresh-token cookie.
  // JANGAN redirect ke /login dulu — tunggu bootstrap selesai (sebentar).
  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse text-sm text-slate-400">Memuat sesi...</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}