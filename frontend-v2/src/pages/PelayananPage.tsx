import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Button, Badge } from "../components/ui";
import { ServiceWizard } from "../components/ServiceWizard";

interface Ticket {
  id: number;
  ticketNumber: string;
  device: Record<string, unknown> | null;
  customer: { id: number; name: string; phone?: string; email?: string; type?: string } | null;
  technician: { id: number; name: string } | null;
  status: string;
  notes?: string | null;
  paymentMethod?: string | null;
  paymentProof?: string | null;
  parts: { id: number; itemId: number; name?: string; qty: number; price?: string }[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  Queue: "Antrian",
  Diagnosing: "Diagnosa",
  In_Progress: "Perbaikan",
  Waiting_Part: "Tunggu Part",
  Ready_For_Pickup: "Siap Ambil",
  Completed: "Selesai",
  Picked_Up: "Diambil",
  Cancelled: "Batal",
};

const STATUS_ORDER: string[] = [
  "Queue",
  "Diagnosing",
  "Waiting_Part",
  "In_Progress",
  "Completed",
  "Ready_For_Pickup",
  "Picked_Up",
];

const DONE_STATUSES = ["Completed", "Picked_Up", "Cancelled"];

function formatDT(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Durasi sejak masuk / selesai, warna mengikuti jumlah jam (#93). */
function cardDuration(t: Ticket): { label: string; value: string; color: string } {
  const start = new Date(t.createdAt).getTime();
  const now = Date.now();
  const hours = (now - start) / (1000 * 60 * 60);
  if (t.status === "Completed" || t.status === "Picked_Up" || t.status === "Cancelled") {
    const end = new Date(t.updatedAt).getTime();
    const dur = Math.max(0, (end - start) / (1000 * 60 * 60));
    const label = t.status === "Cancelled" ? "Dibalas" : "Durasi Servis";
    return { label, value: `${dur.toFixed(1)} jam`, color: "text-slate-600" };
  }
  const color = hours > 48 ? "text-red-600 font-semibold" : hours > 24 ? "text-amber-600 font-semibold" : "text-slate-500";
  return { label: "Durasi Masuk", value: `${hours.toFixed(1)} jam`, color };
}

export function PelayananPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/v2/services", { params: { limit: 100 } });
      setTickets(Array.isArray(data?.rows) ? (data.rows as Ticket[]) : []);
    } catch {
      setError("Gagal memuat tiket servis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = useCallback(
    async (id: number, status: string) => {
      try {
        await api.patch(`/v2/services/${id}/status`, { status });
        setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
        setToast(`Status → ${STATUS_LABELS[status] ?? status} ✓`);
        setTimeout(() => setToast(""), 3000);
      } catch {
        setError("Gagal mengubah status.");
      }
    },
    []
  );

  const notify = useCallback(
    async (id: number) => {
      try {
        await api.post(`/v2/wa/services/${id}/notify`, {});
        setToast("Notifikasi WA dikirim ✓");
        setTimeout(() => setToast(""), 3000);
      } catch {
        setToast("Kirim WA gagal (cek sesi WAHA)");
        setTimeout(() => setToast(""), 3000);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <svg className="mr-3 h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Memuat tiket servis...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pelayanan Servis</h1>
          <p className="text-sm text-slate-500">Kelola tiket servis pelanggan.</p>
        </div>
        <div className="flex items-center gap-2">
          {toast && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{toast}</span>}
          <Button onClick={() => setShowWizard((v) => !v)}>{showWizard ? "Tutup" : "+ Tiket Baru"}</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {showWizard && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Buat Tiket Servis Baru</h2>
          <ServiceWizard
            onDone={() => {
              setShowWizard(false);
              setToast("Tiket servis berhasil dibuat ✓");
              setTimeout(() => setToast(""), 3000);
              load();
            }}
          />
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
          <p className="text-4xl">🧾</p>
          <p className="mt-2 text-sm text-slate-400">
            {showWizard ? "Mulai isi wizard untuk membuat tiket." : "Belum ada tiket servis."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tickets.map((t) => {
            const dur = cardDuration(t);
            const isDone = DONE_STATUSES.includes(t.status);
            const device = (t.device ?? {}) as Record<string, unknown>;
            const photos = Array.isArray(device.photos) ? (device.photos as string[]) : [];
            const photo = photos[0];
            return (
              <article
                key={t.id}
                className={`flex flex-col rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
                  isDone ? "border-emerald-200 border-l-4 border-l-emerald-400" : "border-slate-200 border-l-4 border-l-brand-500"
                }`}
              >
                {/* Header: nomor + waktu || badge + teknisi */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div>
                    <Link
                      to={`/pelayanan/servis/${t.id}`}
                      className="font-mono text-sm font-bold text-brand-700 hover:underline"
                    >
                      #{t.ticketNumber}
                    </Link>
                    <p className="text-xs text-slate-400">{formatDT(t.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <Badge status={STATUS_LABELS[t.status] ?? t.status} />
                    {t.technician && (
                      <p className="mt-1 text-xs text-slate-500">
                        🔧 {t.technician.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3 px-4 py-3">
                  {/* Pelanggan */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pelanggan</p>
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {t.customer?.name ?? "—"}
                        {t.customer?.type && (
                          <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
                            {t.customer.type}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">{t.customer?.phone ?? "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Durasi</p>
                      <p className={`text-sm ${dur.color}`}>{dur.value}</p>
                      <p className="text-[10px] text-slate-400">{dur.label}</p>
                    </div>
                  </div>

                  {/* Perangkat + foto */}
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Perangkat</p>
                      <p className="truncate text-base font-bold text-brand-700">
                        {String(device.type ?? "")} {String(device.brand ?? "")} {String(device.model ?? "")}
                      </p>
                      <p className="line-clamp-2 text-xs font-medium text-red-600">
                        {String(device.symptoms ?? device.issue ?? "")}
                      </p>
                      {t.parts.length > 0 && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          🧩 {t.parts.reduce((n, p) => n + p.qty, 0)} part
                        </p>
                      )}
                    </div>
                    {photo ? (
                      <img src={photo} alt="Unit" className="h-16 w-16 flex-shrink-0 rounded-lg border border-slate-200 object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl">🖼️</div>
                    )}
                  </div>

                  {/* Status select */}
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Status
                    </label>
                    <select
                      value={t.status}
                      disabled={isDone}
                      onChange={(e) => changeStatus(t.id, e.target.value)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-sm font-semibold focus:outline-none disabled:cursor-not-allowed ${
                        isDone
                          ? "border-slate-200 bg-slate-50 text-slate-500"
                          : "border-brand-300 bg-brand-50 text-brand-700"
                      }`}
                      aria-label="Ubah status tiket"
                    >
                      <option value="" disabled>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </option>
                      {STATUS_ORDER.filter((s) => s !== t.status).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s] ?? s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Footer aksi */}
                <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
                  <Link
                    to={`/pelayanan/servis/${t.id}`}
                    className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                  >
                    👁️ Detail
                  </Link>
                  {!isDone && (
                    <>
                      <Link
                        to={`/pelayanan/servis/${t.id}?tab=parts`}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        🧩 Part
                      </Link>
                      <button
                        onClick={() => notify(t.id)}
                        disabled={!t.customer?.phone}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title={t.customer?.phone ? "Kirim notifikasi WA" : "Pelanggan tanpa no. WA"}
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                          <path d="M12 2A10 10 0 002 12a9.9 9.9 0 001.7 5.4L2 22l4.7-1.6A10 10 0 1012 2zm5.5 13.3c-.3.8-1.5 1.5-2.2 1.5s-1.2.3-4-1-3.7-4.4-3.8-4.6-.9-1.2-.9-2.3.6-1.6.8-1.8.5-.3.7-.3h.5c.2 0 .4-.1.6.5s.7 1.7.8 1.8a.5.5 0 010 .4c-.1.2-.2.3-.4.5l-.4.5c-.2.2-.4.4-.2.7a6 6 0 001 1.3c.4.5 1.1 1 1.7 1.4a17 17 0 002.4 1.4c.3.2.5.2.7.1l1.2-1.2c.2-.3.4-.2.7-.1s1.7.8 2 .9a.8.8 0 01.5.7.6.6 0 01-.2.2z" />
                        </svg>
                        WA
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}