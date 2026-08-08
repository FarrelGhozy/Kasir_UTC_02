import { useState, type FormEvent } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card, Button, Alert } from "../components/ui";
import { useNavigate } from "react-router-dom";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const ROLE_LABEL: Record<string, string> = { admin: "Admin", kasir: "Kasir", teknisi: "Teknisi" };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (newPw.length < 6) return setError("Password baru minimal 6 karakter.");
    if (newPw !== confirmPw) return setError("Konfirmasi password tidak cocok.");
    if (oldPw === newPw) return setError("Password baru harus berbeda dari yang lama.");
    setSaving(true);
    try {
      await api.post("/v2/auth/change-password", { oldPassword: oldPw, newPassword: newPw });
      setMsg("Password berhasil diganti. Silakan login ulang.");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => {
        logout();
        nav("/login");
      }, 1400);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal mengganti password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profil Saya</h1>
        <p className="text-sm text-slate-500">Lihat informasi akun dan ganti password.</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">{user?.name}</p>
            <p className="text-sm text-slate-500">@{user?.username}</p>
          </div>
          <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {user ? ROLE_LABEL[user.role] ?? user.role : ""}
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Ganti Password</h2>
        {error && <Alert tone="error">{error}</Alert>}
        {msg && <Alert tone="success">{msg}</Alert>}
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            placeholder="Password lama"
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="Password baru (min. 6 karakter)"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Ulangi password baru"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}