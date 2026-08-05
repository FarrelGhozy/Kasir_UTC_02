import { Link, useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { openNotaPdf } from "../lib/notaPdf";
import { Button, Card, Spinner, Alert } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

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

interface Detail {
  id: number;
  ticketNumber: string;
  status: string;
  device: { brand?: string; model?: string; issue?: string } | null;
  claim?: unknown;
  estimatedCost?: string | null;
  note?: string | null;
  createdAt: string;
  customer: { id: number; name: string; phone: string; address?: string } | null;
  technician: { id: number; name: string } | null;
  parts: { id: number; name: string | null; qty: number; price?: string; subtotal: number }[];
  logs: { id: number; action: string; note?: string | null; createdAt: string; actorName?: string }[];
}

export function ServiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "kasir" || user?.role === "teknisi";
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/v2/services/${id}`);
      setD(data?.data ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal memuat detail tiket.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote() {
    if (!note.trim()) return;
    setError("");
    try {
      await api.put(`/v2/services/${id}`, { notes: note });
      setNote("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal menyimpan catatan.");
    }
  }

  if (loading) return <Spinner label="Memuat detail tiket..." />;
  if (!d) return <Alert tone="error">{error || "Tiket tidak ditemukan."}</Alert>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/pelayanan" className="text-sm text-brand-600 hover:underline">
            ← Pelayanan
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">
            Tiket <span className="font-mono text-brand-700">{d.ticketNumber}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openNotaPdf("servis", d.id)}>
            🖨️ Cetak Nota PDF
          </Button>
          <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {STATUS_LABELS[d.status] ?? d.status}
          </span>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Info utama */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700">Pelanggan</h3>
          {d.customer ? (
            <div className="mt-2 text-sm">
              <p className="font-medium text-slate-800">{d.customer.name}</p>
              <p className="text-slate-500">{d.customer.phone}</p>
              {d.customer.address && <p className="text-slate-400">{d.customer.address}</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">—</p>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700">Device</h3>
          <p className="mt-2 text-sm text-slate-800">
            {d.device?.brand ? `${d.device.brand} ${d.device.model ?? ""}`.trim() : "—"}
          </p>
          {d.device?.issue && <p className="mt-1 text-sm text-slate-500">Keluhan: {d.device.issue}</p>}
          <p className="mt-2 text-xs text-slate-400">Teknisi: {d.technician?.name ?? "Belum ditugaskan"}</p>
        </Card>
      </div>

      {/* Parts */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-700">Part Digunakan ({d.parts.length})</h3>
        {d.parts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Belum ada part tercatat.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4">Part</th>
                <th className="py-2 pr-4">Qty</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {d.parts.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4">{p.name ?? "Item"}</td>
                  <td className="py-2 pr-4">{p.qty}</td>
                  <td className="py-2 text-right">Rp {Number(p.subtotal).toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Catatan / log */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-700">Riwayat</h3>
        {canEdit && (
          <div className="mt-3 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tambah catatan perbaikan..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <Button onClick={addNote} variant="outline">
              Tambah
            </Button>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {d.logs.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada aktivitas.</p>
          ) : (
            d.logs.map((l) => (
              <div key={l.id} className="relative border-l-2 border-slate-200 pl-4">
                <p className="text-sm font-medium text-slate-700">{l.action}</p>
                {l.note && <p className="text-xs text-slate-500">{l.note}</p>}
                <p className="text-xs text-slate-400">
                  {new Date(l.createdAt).toLocaleString("id-ID")}
                  {l.actorName ? ` · ${l.actorName}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}