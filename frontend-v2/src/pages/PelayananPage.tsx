import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Button, Card, Spinner, Alert } from "../components/ui";
import { ServiceWizard } from "../components/ServiceWizard";

interface Ticket {
  id: number;
  ticketNumber: string;
  device: { brand?: string; model?: string } | null;
  customer: { name: string; phone: string } | null;
  technician: { id: number; name: string } | null;
  status: string;
  price?: string;
  createdAt: string;
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

export function PelayananPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/v2/services", { params: { limit: 50 } });
      setTickets(Array.isArray(data?.rows) ? (data.rows as Ticket[]) : []);
      if (toast) setTimeout(() => setToast(""), 3000);
    } catch {
      setError("Gagal memuat tiket servis.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Memuat tiket servis..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pelayanan Servis</h1>
          <p className="text-sm text-slate-500">Kelola tiket servis pelanggan.</p>
        </div>
        <Button onClick={() => setShowWizard((v) => !v)}>{showWizard ? "Tutup" : "+ Tiket Baru"}</Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {toast && <Alert tone="success">{toast}</Alert>}

      {showWizard && (
        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Buat Tiket Servis Baru</h2>
          <ServiceWizard
            onDone={() => {
              setShowWizard(false);
              setToast("Tiket servis berhasil dibuat ✓");
              load();
            }}
          />
        </Card>
      )}

      {tickets.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">Belum ada tiket servis.</Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">No. Tiket</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Teknisi</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-brand-700">{t.ticketNumber}</td>
                  <td className="px-4 py-3">
                    {t.device?.brand ? `${t.device.brand} ${t.device.model ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{t.customer?.name ?? "—"}</p>
                    {t.customer?.phone && <p className="text-xs text-slate-400">{t.customer.phone}</p>}
                  </td>
                  <td className="px-4 py-3">{t.technician?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/pelayanan/servis/${t.id}`}
                      className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                      aria-label={`Detail tiket ${t.ticketNumber}`}
                    >
                      {STATUS_LABELS[t.status] ?? t.status}
                    </Link>
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