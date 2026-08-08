import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui";

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const items = [
    {
      to: "/pengaturan/piket",
      icon: "📅",
      title: "Jadwal Piket",
      desc: "Atur jadwal piket harian karyawan.",
      adminOnly: false,
    },
    {
      to: "/pengaturan/pengguna",
      icon: "👥",
      title: "Kelola Pengguna",
      desc: "Tambah user, ubah role & status, reset password.",
      adminOnly: true,
    },
    {
      to: "/pengaturan/teknisi",
      icon: "🔧",
      title: "Kelola Teknisi",
      desc: "Tambah & kelola teknisi (role teknisi).",
      adminOnly: true,
    },
    {
      to: "/pengaturan/backup",
      icon: "💾",
      title: "Backup & Restore",
      desc: "Unduh snapshot JSON database & restore.",
      adminOnly: true,
    },
  ].filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola konfigurasi sistem, user, backup, dan jadwal piket.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <Card key={i.to} className="flex flex-col">
            <div className="mb-3 text-3xl">{i.icon}</div>
            <h3 className="font-semibold text-slate-900">{i.title}</h3>
            <p className="mt-1 flex-1 text-sm text-slate-500">{i.desc}</p>
            <Link
              to={i.to}
              className="mt-4 inline-flex w-fit items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Buka {i.title} →
            </Link>
          </Card>
        ))}
      </div>

      {!isAdmin && (
        <p className="text-xs text-slate-400">
          Menu Kelola Pengguna, Teknisi, dan Backup hanya tersedia untuk role <strong>admin</strong>.
        </p>
      )}
    </div>
  );
}