import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { Button, Card, Spinner, Alert } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

interface UserRow {
  id: number;
  name: string;
  username: string;
  role: string;
  phone: string;
  isActive: boolean;
  jabatan: string | null;
}

const EMPTY = { name: "", username: "", password: "", role: "teknisi", phone: "", jabatan: "" };

export function TechnicianManagementPage() {
  const { user: me } = useAuth();
  const [teknisi, setTeknisi] = useState<UserRow[]>([]);
  // #111: workload per teknisi {aktif, selesai, total, estimasi biaya}
  const [workloads, setWorkloads] = useState<Record<number, { active: number; completed: number; total: number; estimatedRevenue: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/v2/users");
      const rows = Array.isArray(data?.rows) ? (data.rows as UserRow[]) : [];
      const techs = rows.filter((u) => u.role === "teknisi");
      setTeknisi(techs);
      // #111: fetch workload tiap teknisi (paralel; gagal satu → abaikan)
      const wl = await Promise.all(
        techs.map(async (t) => {
          try {
            const r = await api.get(`/v2/services/technician/${t.id}/workload`);
            return [t.id, r.data?.data] as const;
          } catch {
            return [t.id, null] as const;
          }
        })
      );
      setWorkloads(Object.fromEntries(wl.filter(([, w]) => w)));
    } catch {
      setError("Gagal memuat teknisi (butuh role admin).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createTeknisi() {
    if (!form.name || !form.username || !form.password) {
      setError("Nama, username & password wajib diisi.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/v2/users", form);
      setShowForm(false);
      setForm(EMPTY);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal membuat teknisi.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    if (u.id === me?.id) return;
    setError("");
    try {
      await api.put(`/v2/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal mengubah status.");
    }
  }

  if (loading) return <Spinner label="Memuat teknisi..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kelola Teknisi</h1>
          <p className="text-sm text-slate-500">Teknisi adalah user dengan role teknisi (bisa garap tiket servis).</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Tutup" : "+ Teknisi Baru"}</Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <Card className="grid gap-3 p-4 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nama teknisi *"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="Username *"
            autoComplete="off"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Password * (min 6)"
            type="password"
            autoComplete="new-password"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="No. HP (WA)"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.jabatan}
            onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
            placeholder="Keahlian (cth: HP / Laptop)"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <div className="md:col-span-2">
            <Button onClick={createTeknisi} loading={saving}>
              Simpan Teknisi
            </Button>
          </div>
        </Card>
      )}

      {teknisi.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">Belum ada teknisi. Tambahkan lewat form di atas.</Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">HP / WA</th>
                <th className="px-4 py-3">Keahlian</th>
                <th className="px-4 py-3">Beban Kerja</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teknisi.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.username}</td>
                  <td className="px-4 py-3 text-slate-600">{u.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{u.jabatan || "—"}</td>
                  <td className="px-4 py-3">
                    {workloads[u.id] ? (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                          {workloads[u.id].active} aktif
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {workloads[u.id].completed} selesai
                        </span>
                        <span className="text-xs text-slate-400">· {workloads[u.id].total} total</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">…</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => toggleActive(u)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                      >
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}