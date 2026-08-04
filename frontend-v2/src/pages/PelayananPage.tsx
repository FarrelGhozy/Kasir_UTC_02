import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { Button, Card, Spinner, Alert } from "../components/ui";

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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", brand: "", model: "", issue: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/v2/services", { params: { limit: 50 } });
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

  async function createTicket() {
    if (!form.customerName || !form.brand) {
      setError("Nama pelanggan & merek device wajib diisi.");
      return;
    }
    try {
      await api.post("/v2/services", {
        customer: { name: form.customerName, phone: form.customerPhone },
        device: { brand: form.brand, model: form.model, issue: form.issue },
      });
      setShowForm(false);
      setForm({ customerName: "", customerPhone: "", brand: "", model: "", issue: "" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal membuat tiket.");
    }
  }

  if (loading) return <Spinner label="Memuat tiket servis..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pelayanan Servis</h1>
          <p className="text-sm text-slate-500">Kelola tiket servis pelanggan.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Tutup" : "+ Tiket Baru"}</Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <Card className="grid gap-3 p-4 md:grid-cols-2">
          <input
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            placeholder="Nama pelanggan *"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.customerPhone}
            onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
            placeholder="No. HP"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            placeholder="Merek device * (cth: Samsung)"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="Tipe / model"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <textarea
            value={form.issue}
            onChange={(e) => setForm({ ...form, issue: e.target.value })}
            placeholder="Keluhan / kerusakan"
            rows={2}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none md:col-span-2"
          />
          <div className="md:col-span-2">
            <Button onClick={createTicket}>Simpan Tiket</Button>
          </div>
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
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
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