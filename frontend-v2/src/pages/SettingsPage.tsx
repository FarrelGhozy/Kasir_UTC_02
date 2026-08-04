import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { Card, Alert, Spinner } from "../components/ui";

interface BkTables {
  [k: string]: number;
}

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [summary, setSummary] = useState<BkTables | null>(null);
  const [backupVisible, setBackupVisible] = useState(false);

  async function loadSummary() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.get("/backup/summary");
      setSummary(r.data?.tables ?? {});
      setBackupVisible(true);
    } catch {
      setMsg({ type: "err", text: "Gagal memuat ringkasan backup." });
    } finally {
      setLoading(false);
    }
  }

  async function downloadBackup() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.get("/backup");
      const sha = r.headers?.["x-backup-sha256"] ?? "";
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `utc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: "ok", text: `Backup berhasil diunduh${sha ? ` · SHA-256 ${sha.slice(0, 16)}…` : ""}` });
    } catch {
      setMsg({ type: "err", text: "Gagal membuat backup." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola konfigurasi sistem, backup, dan jadwal piket.</p>
      </div>

      {msg && <Alert tone={msg.type === "ok" ? "success" : "error"}>{msg.text}</Alert>}
      {loading && <Spinner />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Jadwal Piket */}
        <Card className="flex flex-col">
          <div className="mb-3 text-3xl">📅</div>
          <h3 className="font-semibold text-slate-900">Jadwal Piket</h3>
          <p className="mt-1 flex-1 text-sm text-slate-500">Atur jadwal piket harian karyawan.</p>
          <Link
            to="/pengaturan/piket"
            className="mt-4 inline-flex w-fit items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Buka Jadwal Piket →
          </Link>
        </Card>

        {/* Backup & Restore — ADMIN ONLY */}
        {isAdmin ? (
          <Card className="flex flex-col">
            <div className="mb-3 text-3xl">💾</div>
            <h3 className="font-semibold text-slate-900">Backup & Restore</h3>
            <p className="mt-1 flex-1 text-sm text-slate-500">
              Unduh snapshot JSON database (dengan checksum) atau lihat ringkasan tabel.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={loadSummary}
                className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                Ringkasan
              </button>
              <button
                onClick={downloadBackup}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Unduh Backup
              </button>
            </div>
            {backupVisible && summary && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Isi backup</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
                  {Object.entries(summary).map(([k, v]) => (
                    <span key={k} className="capitalize">
                      {k.replace(/_/g, " ")}: <strong className="text-slate-900">{v}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : null}
      </div>

      {!isAdmin && (
        <p className="text-xs text-slate-400">
          Menu Backup &amp; Restore hanya tersedia untuk role <strong>admin</strong>.
        </p>
      )}
    </div>
  );
}