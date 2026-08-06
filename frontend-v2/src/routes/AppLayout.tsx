import { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { BRAND } from "../lib/brand";
import api from "../lib/api";

const NAV: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/pos", label: "POS", icon: "🛒" },
  { to: "/pelayanan", label: "Pelayanan", icon: "🔧" },
  { to: "/pelayanan/pesanan", label: "Pesanan", icon: "🛍️" },
  { to: "/gudang", label: "Gudang", icon: "📦" },
  { to: "/laporan", label: "Laporan", icon: "📈" },
  { to: "/nota", label: "Nota", icon: "🧾" },
  { to: "/pengaturan", label: "Pengaturan", icon: "⚙️" },
  { to: "/pengaturan/piket", label: "Jadwal Piket", icon: "📅" },
];

// #startup-ux: sidebar desktop + drawer mobile. Sebelumnya sidebar 240px FIXED
// di semua ukuran layar → di HP konten cuma tersisa ~135px (tidak terpakai).
export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wa, setWa] = useState<"CONNECTED" | "DISCONNECTED" | "STARTING" | "UNREACHABLE" | "ERROR" | null>(null);

  // status internal WAHA (quiet, tidak blokir UI)
  useEffect(() => {
    api
      .get("/wa/status")
      .then((r) => setWa(r.data?.status ?? null))
      .catch(() => setWa("DISCONNECTED"));
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition aria-current:bg-brand-50 ${
      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
    } ${collapsed ? "justify-center" : ""}`;

  const waDot = (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        wa === "CONNECTED" ? "bg-green-500" : wa === "STARTING" ? "bg-amber-400" : "bg-red-400"
      }`}
      aria-hidden="true"
    />
  );

  const userBox = (
    <div className="mt-2 rounded-lg bg-slate-50 p-3">
      <p className="truncate text-sm font-medium text-slate-700" title={user?.name}>
        {user?.name}
      </p>
      <p className="text-xs capitalize text-slate-400">{user?.role}</p>
      <Link
        to="/profil"
        className="mt-2 block w-full rounded-md bg-white px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100"
      >
        Profil & Ganti Password →
      </Link>
      <button
        onClick={handleLogout}
        className="mt-1 w-full rounded-md bg-white px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-50"
      >
        Keluar →
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── Sidebar desktop (≥md) ─────────────────────────────── */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all md:flex ${
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
          {!collapsed && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              {waDot}
              <span className="text-xs text-slate-500">WhatsApp {wa ?? "…"}</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`w-full rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 ${collapsed ? "" : "text-left"}`}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? "»" : "« Ciutkan"}
          </button>
          {userBox}
        </div>
      </aside>

      {/* ── Drawer mobile (<md) ───────────────────────────────── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigasi utama (mobile)"
        aria-hidden={!menuOpen}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <img src={BRAND.logo} alt={`Logo ${BRAND.name}`} className="h-8 w-auto" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{BRAND.name}</p>
            <p className="text-[10px] text-slate-400">v2.0.0</p>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <span aria-hidden="true">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            {waDot}
            <span className="text-xs text-slate-500">WhatsApp {wa ?? "…"}</span>
          </div>
          {userBox}
        </div>
      </aside>

      {/* ── Kolom utama: topbar mobile + konten ───────────────── */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur md:hidden">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Buka menu navigasi"
          >
            ☰
          </button>
          <img src={BRAND.logo} alt="" className="h-7 w-auto" />
          <span className="truncate text-sm font-bold text-slate-900">{BRAND.name}</span>
          <span className="ml-auto">{waDot}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
