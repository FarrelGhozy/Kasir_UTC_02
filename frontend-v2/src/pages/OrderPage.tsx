import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Button, Card, Spinner, Alert } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { compressToDataUrl } from "../lib/photoCompress";

interface Order {
  id: number;
  orderNumber: string;
  itemName: string;
  status: string;
  paymentStatus: string;
  estimatedPrice: string;
  paidAmount: string;
  remaining: string;
  customer: { id: number; name: string; phone: string } | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  Pending: "Menunggu",
  Searching: "Dicari",
  Ordered: "Dipesan",
  Arrived: "Sudah Tiba",
  Picked_Up: "Diambil",
  Cancelled: "Batal",
};
const PAY_LABELS: Record<string, string> = {
  Lunas: "Lunas",
  Belum_Lunas: "Belum Lunas",
};

export function OrderPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "kasir" || user?.role === "teknisi";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ itemName: "", itemDescription: "", estimatedPrice: "", downPayment: "", notes: "" });
  // #109: foto barang (dataURL hasil kompresi browser)
  const [photo, setPhoto] = useState<string | null>(null);
  const [compressMsg, setCompressMsg] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/v2/orders");
      const rows = data?.data?.rows;
      setOrders(Array.isArray(rows) ? rows : []);
    } catch {
      setError("Gagal memuat pesanan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createOrder() {
    if (!form.itemName || !form.estimatedPrice) {
      setError("Nama barang & estimasi harga wajib diisi.");
      return;
    }
    try {
      await api.post("/v2/orders", {
        itemName: form.itemName,
        itemDescription: form.itemDescription || undefined,
        estimatedPrice: Number(form.estimatedPrice),
        downPayment: form.downPayment ? Number(form.downPayment) : undefined,
        notes: form.notes || undefined,
        photo: photo ?? undefined, // #109
      });
      setShowForm(false);
      setForm({ itemName: "", itemDescription: "", estimatedPrice: "", downPayment: "", notes: "" });
      setPhoto(null);
      setCompressMsg("");
      setError("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal membuat pesanan.");
    }
  }

  // #109: pilih foto → kompres di browser → dataURL
  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCompressMsg("Mengompresi foto…");
    setError("");
    try {
      const url = await compressToDataUrl(file);
      setPhoto(url);
      setCompressMsg(`Foto siap (${Math.round(url.length / 1024)} KB).`);
    } catch {
      setCompressMsg("");
      setError("Gagal mengompresi foto. Coba gambar lain.");
    }
  }

  if (loading) return <Spinner label="Memuat pesanan..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pesanan Khusus</h1>
          <p className="text-sm text-slate-500">Monitoring special order: status barang & pembayaran.</p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Tutup" : "+ Pesanan Baru"}</Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <Card className="grid gap-3 p-4 md:grid-cols-2">
          <input
            value={form.itemName}
            onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            placeholder="Nama barang *"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.itemDescription}
            onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
            placeholder="Deskripsi / spesifikasi"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.estimatedPrice}
            onChange={(e) => setForm({ ...form, estimatedPrice: e.target.value })}
            placeholder="Estimasi harga (Rp) *"
            type="number"
            min={0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            value={form.downPayment}
            onChange={(e) => setForm({ ...form, downPayment: e.target.value })}
            placeholder="Uang muka (Rp)"
            type="number"
            min={0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Catatan"
            rows={2}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none md:col-span-2"
          />
          {/* #109: foto barang */}
          <div className="md:col-span-2">
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPicked} />
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => photoRef.current?.click()}>
                📷 Foto Barang
              </Button>
              {compressMsg && <span className="text-xs text-slate-500">{compressMsg}</span>}
              {photo && (
                <>
                  <img src={photo} alt="Foto barang" className="h-14 w-14 rounded-lg border border-slate-200 object-cover" />
                  <button type="button" onClick={() => { setPhoto(null); setCompressMsg(""); }} className="text-xs text-red-500 hover:underline">
                    Hapus foto
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="md:col-span-2">
            <Button onClick={createOrder}>Simpan Pesanan</Button>
          </div>
        </Card>
      )}

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">Belum ada pesanan khusus.</Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">No. Order</th>
                <th className="px-4 py-3">Barang</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Estimasi</th>
                <th className="px-4 py-3 text-right">Dibayar</th>
                <th className="px-4 py-3 text-right">Sisa</th>
                <th className="px-4 py-3">Pembayaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-brand-700">
                    <Link to={`/pelayanan/pesanan/${o.id}`} className="hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{o.itemName}</td>
                  <td className="px-4 py-3">{o.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    Rp {Number(o.estimatedPrice).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600">
                    Rp {Number(o.paidAmount).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    Rp {Number(o.remaining).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.paymentStatus === "Lunas"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {PAY_LABELS[o.paymentStatus] ?? o.paymentStatus}
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