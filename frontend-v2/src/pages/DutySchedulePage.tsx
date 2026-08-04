import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Spinner, Alert, Field } from "../components/ui";

const DAYS = ["senin", "selasa", "rabu", "kamis", "jumat"] as const;
const DAY_LABELS: Record<string, string> = {
  senin: "Senin",
  selasa: "Selasa",
  rabu: "Rabu",
  kamis: "Kamis",
  jumat: "Jumat",
};

interface DutyUser {
  id: number;
  name: string;
  username: string;
  phone: string;
  jabatan: string | null;
}
interface DutySchedule {
  id: number;
  day: string;
  day_label: string;
  user: DutyUser;
}

export function DutySchedulePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [schedules, setSchedules] = useState<DutySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<DutyUser[]>([]);
  // form tambah
  const [selUserId, setSelUserId] = useState("");
  const [selDay, setSelDay] = useState("senin");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/v2/duty-schedules");
      setSchedules(Array.isArray(data?.data) ? (data.data as DutySchedule[]) : []);
    } catch (e) {
      setError("Gagal memuat jadwal piket.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Daftar user (untuk dropdown admin) — reuse akun aktif dari endpoint users
  useEffect(() => {
    if (!isAdmin) return;
    api
      .get("/v2/auth/users")
      .then((res) => setUsers(res.data?.data ?? []))
      .catch(() => setUsers([]));
  }, [isAdmin]);

  async function handleCreate() {
    if (!selUser) return;
    try {
      await api.post("/v2/duty-schedules", { userId: Number(selUser), day: selDay });
      setSelUserId("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal menambahkan jadwal.");
    }
  }

  async function handleMove(id: number, toDay: string) {
    try {
      await api.put(`/v2/duty-schedules/${id}`, { day: toDay });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal mengubah hari.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Hapus jadwal piket ini?")) return;
    try {
      await api.delete(`/v2/duty-schedules/${id}`);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal menghapus.");
    }
  }

  const selUser = users.find((u) => String(u.id) === selUserId);
  const byDay = (day: string) =>
    schedules.filter((s) => s.day === day).sort((a, b) => a.user.name.localeCompare(b.user.name));

  if (loading) return <Spinner label="Memuat jadwal piket..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Jadwal Piket Kebersihan</h1>
        <p className="text-sm text-slate-500">
          Jadwal piket Senin–Jumat. {isAdmin ? "Kelola dengan menambah/memindahkan petugas." : "Lihat jadwal tim."}
        </p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Form tambah (admin) */}
      {isAdmin && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Tambah jadwal</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Petugas">
              <select
                className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                value={selUserId}
                onChange={(e) => setSelUserId(e.target.value)}
              >
                <option value="">Pilih petugas…</option>
                {users
                  .filter((u) => u.id !== user?.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Hari">
              <select
                className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                value={selDay}
                onChange={(e) => setSelDay(e.target.value)}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LABELS[d]}
                  </option>
                ))}
              </select>
            </Field>
            <Button onClick={handleCreate} disabled={!selUser}>
              + Tambah
            </Button>
          </div>
        </Card>
      )}

      {/* Grid per hari */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {DAYS.map((day) => (
          <Card key={day} className="p-4">
            <h3 className="mb-3 border-b border-slate-100 pb-2 font-semibold text-brand-700">
              {DAY_LABELS[day]}
            </h3>
            {byDay(day).length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Kosong</p>
            ) : (
              <ul className="space-y-2">
                {byDay(day).map((s) => (
                  <li key={s.id} className="group rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{s.user.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {s.user.jabatan || s.user.username}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex shrink-0 items-center gap-1">
                          <select
                            className="rounded-md border border-slate-200 bg-white px-1 py-1 text-xs"
                            value={s.day}
                            onChange={(e) => handleMove(s.id, e.target.value)}
                          >
                            {DAYS.map((d) => (
                              <option key={d} value={d}>
                                {DAY_LABELS[d]}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                            aria-label={`Hapus ${s.user.name}`}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}