import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BRAND } from "../lib/brand";

const NAV: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/pos", label: "POS", icon: "🛒" },
  { to: "/pelayanan", label: "Pelayanan", icon: "🔧" },
  { to: "/gudang", label: "Gudang", icon: "📦" },
  { to: "/laporan", label: "Laporan", icon: "📈" },
  { to: "/nota", label: "Nota", icon: "🧾" },
  { to: "/pengaturan", label: "Pengaturan", icon: "⚙️" },
  { to: "/pengaturan/piket", label: "Jadwal Piket", icon: "📅" },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition aria-current:bg-brand-50 ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
    } ${collapsed ? "justify-center" : ""}`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-all ${
          collapsed ? "w-16" : "w-60"
        }`}
        aria-label="Navigasi utama"
      >
        <div className={`flex items-center gap-2 border-b border-slate-200 px-4 py-3 ${collapsed ? "justify-center" : ""}`}>
          <img src={BRAND.logo} alt={`Logo ${BRAND.name}`} className="h-8 w-auto" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{BRAND.name}</p>
              <p className="text-[10px] text-slate-400">v2.0.0</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={navLink}
              title={collapsed ? n.label : undefined}
              aria-label={collapsed ? n.label : undefined}
            >
              <span aria-hidden="true">{n.icon}</span>
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`w-full rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 ${collapsed ? "" : "text-left"}`}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? "»" : "« Ciutkan"}
          </button>
          <div className="mt-2 rounded-lg bg-slate-50 p-3">
            <p className="truncate text-sm font-medium text-slate-700" title={user?.name}>{user?.name}</p>
            <p className="text-xs capitalize text-slate-400">{user?.role}</p>
            <button
              onClick={handleLogout}
              className="mt-2 w-full rounded-md bg-white px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-50"
            >
              Keluar →
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}