import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { openNotaPdf } from "../lib/notaPdf";
import { Spinner, Alert, Badge } from "../components/ui";

interface Row {
  id: number;
  invoiceNo: string;
  grandTotal?: string;
  total?: string;
  paymentMethod?: string;
  createdAt: string;
  name?: string;
  status?: string;
  customer?: string;
  type: "pos" | "service";
  ref?: string;
}

export function NotaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, svRes] = await Promise.all([
        api.get("/v2/transactions", { params: { limit: 50 } }),
        api.get("/v2/services", { params: { limit: 50 } }),
      ]);
      const tx: Row[] = ((txRes.data?.rows ?? []) as any[]).map((t) => ({
        id: t.id,
        invoiceNo: t.invoiceNo ?? `TRX-${t.id}`,
        grandTotal: t.grandTotal ?? t.total ?? "0",
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt ?? t.date,
        type: "pos" as const,
      }));
      const sv: Row[] = ((svRes.data?.rows ?? []) as any[]).map((s: any) => ({
        id: s.id,
        invoiceNo: s.ticketNumber ?? `SRV-${s.id}`,
        grandTotal: s.price ?? s.amount ?? "0",
        status: s.status,
        createdAt: s.createdAt,
        customer: s.customer?.name,
        type: "service" as const,
      }));
      setRows([...tx, ...sv]);
    } catch {
      setError("Gagal memuat riwayat nota.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = rows
    .filter((r) => (filter === "all" ? true : r.type === filter))
    .filter((r) => {
      if (!q) return true;
      const txt = `${r.invoiceNo} ${r.customer ?? ""}`.toLowerCase();
      return txt.includes(q.toLowerCase());
    });

  if (loading) return <Spinner label="Memuat nota..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Riwayat Nota</h1>
        <p className="text-sm text-slate-500">Semua nota transaksi POS & servis.</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Cari nomor / pelanggan…"
          className="min-w-56 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        {(["all", "pos", "service"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              filter === f ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {f === "all" ? "Semua" : f === "pos" ? "POS" : "Servis"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">No. Nota</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  Tidak ada nota ditemukan.
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-brand-700">{r.invoiceNo}</td>
                  <td className="px-4 py-3">
                    <Badge status={r.type === "pos" ? "pos" : "service"} />
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.customer ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-500">{r.status ?? "Lunas"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(r.createdAt ?? Date.now()).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    Rp{Number(r.grandTotal ?? r.total ?? 0).toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openNotaPdf(r.type === "pos" ? "pos" : "servis", r.id)}
                      className="rounded-md border border-brand-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      🖨️ PDF
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}