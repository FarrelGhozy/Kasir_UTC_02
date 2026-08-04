import { useState } from "react";
import api from "../lib/api";
import { Button, Card, Spinner, Alert } from "../components/ui";

interface BkTables {
  [k: string]: number;
}

export function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [summary, setSummary] = useState<BkTables | null>(null);
  const [restoreJson, setRestoreJson] = useState("");
  const [restored, setRestored] = useState<Record<string, number> | null>(null);

  async function loadSummary() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.get("/backup/summary");
      setSummary(r.data?.tables ?? {});
    } catch {
      setMsg({ type: "err", text: "Gagal memuat ringkasan backup (butuh role admin)." });
    } finally {
      setLoading(false);
    }
  }

  async function downloadBackup() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.get("/backup");
      const sha = (r.headers as any)?.["x-backup-sha256"] ?? "";
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `utc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: "ok", text: `Backup terunduh${sha ? ` · SHA-256 ${sha.slice(0, 16)}…` : ""}` });
    } catch {
      setMsg({ type: "err", text: "Gagal membuat backup." });
    } finally {
      setLoading(false);
    }
  }

  async function doRestore() {
    if (!restoreJson.trim()) {
      setMsg({ type: "err", text: "Tempel isi file backup JSON pada kolom." });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post("/backup/restore", { backup: restoreJson });
      setRestored(r.data?.restoredRows ?? {});
      setMsg({ type: "ok", text: "Restore berhasil." });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.response?.data?.error || "Restore gagal. Pastikan JSON valid." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Backup & Restore</h1>
        <p className="mt-1 text-sm text-slate-500">
          Unduh snapshot JSON database (dengan checksum), lihat ringkasan tabel, atau restore dari backup.
        </p>
      </div>

      {msg && <Alert tone={msg.type === "ok" ? "success" : "error"}>{msg.text}</Alert>}
      {loading && <Spinner />}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-semibold text-slate-800">Export</h3>
          <p className="mt-1 text-sm text-slate-500">Unduh JSON berisi semua data, dengan checksum SHA-256 di header.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={downloadBackup}>💾 Unduh Backup</Button>
            <Button variant="outline" onClick={loadSummary}>
              Ringkasan
            </Button>
          </div>
          {summary && (
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

        <Card className="p-4">
          <h3 className="font-semibold text-slate-800">Restore</h3>
          <p className="mt-1 text-sm text-slate-500">
            Tempel isi file backup JSON. Restore aman: validasi dulu, lalu transaksi penuh.
          </p>
          <textarea
            value={restoreJson}
            onChange={(e) => setRestoreJson(e.target.value)}
            rows={6}
            placeholder='{"users": [...], "items": [...]}'
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none"
          />
          <div className="mt-3">
            <Button onClick={doRestore} loading={loading} variant="warning">
              Restore Data
            </Button>
          </div>
          {restored && (
            <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
              Total baris dipulihkan: {Object.values(restored).reduce((a, b) => a + (b ?? 0), 0)}
              <div className="mt-1 flex flex-wrap gap-2">
                {Object.entries(restored).map(([k, v]) => (
                  <span key={k} className="rounded bg-emerald-100 px-1.5 py-0.5">
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}