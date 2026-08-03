import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h1 className="text-lg font-bold text-brand-600">Kasir UTC</h1>
          <p className="text-xs text-slate-400">v2.0.0</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLink to="/" end className={navLink}>
            📊 Dashboard
          </NavLink>
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700">{user?.name}</p>
          <p className="text-xs capitalize text-slate-400">{user?.role}</p>
          <button
            onClick={handleLogout}
            className="mt-2 text-sm text-red-500 hover:text-red-600"
          >
            Keluar →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}