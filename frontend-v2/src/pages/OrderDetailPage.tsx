import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { openNotaPdf } from "../lib/notaPdf";
import { Button, Card, Spinner, Alert } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

const STATUS_LABELS: Record<string, string> = {
  Pending: "Menunggu",
  Searching: "Dicari",
  Ordered: "Dipesan",
  Arrived: "Sudah Tiba",
  Picked_Up: "Diambil",
  Cancelled: "Batal",
};
// transisi valid (FSM #88): Pending→Searching/Cancelled, Searching→Ordered/Cancelled,
// Ordered→Arrived/Cancelled, Arrived→Picked_Up/Cancelled
const NEXT: Record<string, string[]> = {
  Pending: ["Searching", "Cancelled"],
  Searching: ["Ordered", "Cancelled"],
  Ordered: ["Arrived", "Cancelled"],
  Arrived: ["Picked_Up", "Cancelled"],
};
const PAY_METHODS = ["Cash", "Transfer", "QRIS", "Card"];

interface Detail {
  id: number; // #104: untuk cetak PDF nota
  estimatedPrice: string;
  paidAmount: string;
  remaining: string;
  paymentStatus: string;
  status: string;
  orderNumber: string;
  payments: { id: number; amount: string; method: string; paidAt: string }[];
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "kasir" || user?.role === "teknisi";
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pay, setPay] = useState({ amount: "", method: "Cash" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/v2/orders/${id}`);
      setD(data?.data ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal memuat detail pesanan.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(to: string) {
    setError("");
    try {
      await api.patch(`/v2/orders/${id}/status`, { status: to });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal mengubah status.");
    }
  }

  async function addPayment() {
    if (!pay.amount) {
      setError("Nominal pembayaran wajib diisi.");
      return;
    }
    setError("");
    try {
      await api.post(`/v2/orders/${id}/payments`, {
        amount: Number(pay.amount),
        method: pay.method,
      });
      setPay({ amount: "", method: "Cash" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal mencatat pembayaran.");
    }
  }

  if (loading) return <Spinner label="Memuat detail..." />;
  if (!d)
    return <Alert tone="error">{error || "Pesanan tidak ditemukan."}</Alert>;

  const nxt = NEXT[d.status] ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/pelayanan/pesanan" className="text-sm text-brand-600 hover:underline">
            ← Kembali
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">
            Pesanan <span className="font-mono text-brand-700">{d.orderNumber}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openNotaPdf("order", d.id)}>
            🖨️ Cetak Nota PDF
          </Button>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              d.paymentStatus === "Lunas" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {d.paymentStatus === "Lunas" ? "Lunas" : "Belum Lunas"}
          </span>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 text-center">
          <p className="text-xs uppercase text-slate-400">Estimasi</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            Rp {Number(d.estimatedPrice).toLocaleString("id-ID")}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs uppercase text-slate-400">Total Dibayar</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">
            Rp {Number(d.paidAmount).toLocaleString("id-ID")}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs uppercase text-slate-400">Sisa</p>
          <p className="mt-1 text-xl font-bold text-amber-600">
            Rp {Number(d.remaining).toLocaleString("id-ID")}
          </p>
        </Card>
      </div>

      {canWrite && nxt.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">Ubah Status</p>
          <div className="flex flex-wrap gap-2">
            {nxt.map((s) => (
              <Button key={s} variant={s === "Cancelled" ? "danger" : "primary"} onClick={() => changeStatus(s)}>
                {STATUS_LABELS[s] ?? s}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {canWrite && d.paymentStatus !== "Lunas" && (
        <Card className="grid gap-3 p-4 md:grid-cols-3">
          <input
            value={pay.amount}
            onChange={(e) => setPay({ ...pay, amount: e.target.value })}
            placeholder="Nominal bayar (Rp)"
            type="number"
            min={0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <select
            value={pay.method}
            onChange={(e) => setPay({ ...pay, method: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {PAY_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Button onClick={addPayment}>Catat Pembayaran</Button>
        </Card>
      )}

      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">Riwayat Pembayaran</p>
        {d.payments.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada pembayaran.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4">Metode</th>
                <th className="py-2 pr-4 text-right">Nominal</th>
                <th className="py-2">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {d.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-4">{p.method}</td>
                  <td className="py-2 pr-4 text-right font-medium">
                    Rp {Number(p.amount).toLocaleString("id-ID")}
                  </td>
                  <td className="py-2 text-xs text-slate-400">
                    {new Date(p.paidAt).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}