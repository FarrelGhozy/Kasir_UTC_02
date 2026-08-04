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

const ROLE_LABELS: Record<string, string> = { admin: "Admin", kasir: "Kasir", teknisi: "Teknisi" };
const EMPTY = { name: "", username: "", password: "", role: "kasir", phone: "", jabatan: "" };

export function UserManagementPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/v2/users");
      setUsers(Array.isArray(data?.rows) ? data.rows : []);
    } catch {
      setError("Gagal memuat user (butuh role admin).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser() {
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
      setError(e?.response?.data?.error || "Gagal membuat user.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    if (u.id === me?.id) return; // jangan nonaktifkan diri sendiri
    setError("");
    try {
      await api.put(`/v2/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal mengubah status.");
    }
  }

  async function doReset() {
    if (!resetPw || resetPw.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/v2/users/${resetId}/reset-password`, { password: resetPw });
      setResetId(null);
      setResetPw("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal reset password.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(u: UserRow) {
    if (u.id === me?.id) return;
    if (!window.confirm(`Hapus user "${u.name}"?`)) return;
    setError("");
    try {
      await api.delete(`/v2/users/${u.id}`);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal menghapus user.");
    }
  }

  if (loading) return <Spinner label="Memuat user..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kelola Pengguna</h1>
          <p className="text-sm text-slate-500">Tambah, edit status, reset password, dan hapus user.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Tutup" : "+ User Baru"}</Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <Card className="grid gap-3 p-4 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nama lengkap *"
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
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="kasir">Kasir</option>
            <option value="teknisi">Teknisi</option>
            <option value="admin">Admin</option>
          </select>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="No. HP"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.jabatan}
            onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
            placeholder="Jabatan (cth: Teknisi HP)"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <div className="md:col-span-2">
            <Button onClick={createUser} loading={saving}>
              Simpan User
            </Button>
          </div>
        </Card>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">HP</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {u.name}
                  {u.id === me?.id && <span className="ml-1 text-xs text-slate-400">(kamu)</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.username}</td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.phone || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {u.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setResetId(u.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
                    >
                      Reset PW
                    </button>
                    {u.id !== me?.id && (
                      <>
                        <button
                          onClick={() => toggleActive(u)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                        >
                          {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          onClick={() => removeUser(u)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Hapus
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-sm p-5">
            <h3 className="font-semibold text-slate-800">Reset Password</h3>
            <p className="mt-1 text-sm text-slate-500">Masukkan password baru untuk user ini.</p>
            <input
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              type="password"
              autoFocus
              placeholder="Password baru (min 6)"
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setResetId(null); setResetPw(""); }}>
                Batal
              </Button>
              <Button onClick={doReset} loading={saving}>
                Simpan
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}