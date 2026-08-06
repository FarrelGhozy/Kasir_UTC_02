import { useState, useCallback, useEffect } from "react";
import api from "../lib/api";
import { Button, Card, Spinner, Alert } from "../components/ui";

interface BkTables {
  [k: string]: number;
}

interface BkFile {
  name: string;
  size: number;
  sizeHuman: string;
  mtime: string;
}

export function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [summary, setSummary] = useState<BkTables | null>(null);
  const [restoreJson, setRestoreJson] = useState("");
  const [restored, setRestored] = useState<Record<string, number> | null>(null);
  const [files, setFiles] = useState<BkFile[] | null>(null);

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

  async function loadFiles() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.get("/backup/files");
      setFiles(r.data?.files ?? []);
    } catch {
      setMsg({ type: "err", text: "Gagal memuat daftar file backup." });
    } finally {
      setLoading(false);
    }
  }

  // #107: simpan backup ke server (file .json.gz)
  async function saveToServer() {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post("/backup/save");
      setMsg({ type: "ok", text: `Backup tersimpan: ${r.data?.file?.name} (${r.data?.file?.sizeHuman})` });
      await loadFiles();
    } catch {
      setMsg({ type: "err", text: "Gagal menyimpan backup ke server." });
    } finally {
      setLoading(false);
    }
  }

  // #107: unduh file backup tersimpan
  async function downloadFile(f: BkFile) {
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.get(`/backup/files/${encodeURIComponent(f.name)}`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: "ok", text: `File ${f.name} terunduh.` });
    } catch {
      setMsg({ type: "err", text: "Gagal mengunduh file." });
    } finally {
      setLoading(false);
    }
  }

  // #107: restore dari file tersimpan — konfirmasi keras dulu
  async function restoreFromFile(f: BkFile) {
    if (!window.confirm(`⚠️ Restore dari ${f.name} akan MENIMPA semua data saat ini. Lanjutkan?`)) return;
    setLoading(true);
    setMsg(null);
    try {
      const r = await api.post(`/backup/restore/${encodeURIComponent(f.name)}`);
      setRestored(r.data?.restoredRows ?? {});
      setMsg({ type: "ok", text: `Restore dari ${f.name} berhasil.` });
    } catch (e: any) {
      setMsg({ type: "err", text: e?.response?.data?.error || "Restore gagal." });
    } finally {
      setLoading(false);
    }
  }

  // #107: hapus file backup — konfirmasi
  async function deleteFile(f: BkFile) {
    if (!window.confirm(`Hapus file backup ${f.name}?`)) return;
    setLoading(true);
    setMsg(null);
    try {
      await api.delete(`/backup/files/${encodeURIComponent(f.name)}`);
      setMsg({ type: "ok", text: `File ${f.name} dihapus.` });
      await loadFiles();
    } catch {
      setMsg({ type: "err", text: "Gagal menghapus file." });
    } finally {
      setLoading(false);
    }
  }

  // muat daftar file saat halaman pertama dibuka
  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadBackup = useCallback(async () => {
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
  }, []);

  const doRestore = useCallback(async () => {
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
  }, [restoreJson]);

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
            <Button variant="outline" onClick={saveToServer} loading={loading}>
              💽 Simpan ke Server
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

      {/* #107: file backup server-side */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">Backup Server</h3>
            <p className="mt-1 text-sm text-slate-500">
              File backup tersimpan di server (folder <code className="rounded bg-slate-100 px-1">backups/</code>). Retensi otomatis 30 hari, minimal 1 file dipertahankan.
            </p>
          </div>
          <Button variant="outline" onClick={loadFiles}>
            🔄 Muat Ulang
          </Button>
        </div>
        <div className="mt-4">
          {files === null ? (
            <p className="py-4 text-center text-xs text-slate-400">Klik "Muat Ulang" untuk melihat daftar file.</p>
          ) : files.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Belum ada file backup di server. Klik "💽 Simpan ke Server" untuk membuatnya.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nama File</th>
                    <th className="px-4 py-3">Ukuran</th>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {files.map((f) => (
                    <tr key={f.name} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{f.name}</td>
                      <td className="px-4 py-3 text-slate-500">{f.sizeHuman}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(f.mtime).toLocaleString("id-ID")}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => downloadFile(f)}
                            className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                          >
                            ⬇ Unduh
                          </button>
                          <button
                            onClick={() => restoreFromFile(f)}
                            className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                          >
                            ♻ Restore
                          </button>
                          <button
                            onClick={() => deleteFile(f)}
                            className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                          >
                            🗑 Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}