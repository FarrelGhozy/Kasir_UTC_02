import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { Card, Spinner, Alert, StatCard, Badge } from "../components/ui";

interface RevenueDay {
  date: string;
  pos: number;
  orders: number;
  total: number;
}

interface TransactionRow {
  id: number;
  invoiceNo: string;
  paymentMethod: string;
  grandTotal: string;
  date: string;
  cashier: { id: number; name: string } | null;
}

export function LaporanPage() {
  const [range, setRange] = useState("7d");
  const [days, setDays] = useState<RevenueDay[]>([]);
  const [totals, setTotals] = useState<{ pos: number; orders: number; total: number }>({ pos: 0, orders: 0, total: 0 });
  const [txs, setTxs] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const rangeTo = (r: string) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - ({ "7d": 7, "30d": 30, "90d": 90 } as Record<string, number>)[r]);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = rangeTo(range);
      const [revRes, txRes] = await Promise.all([
        api.get("/v2/orders/revenue", { params: { from, to } }),
        api.get("/v2/transactions", { params: { limit: 20, from, to } }),
      ]);
      const rev = revRes.data ?? {};
      setDays(Array.isArray(rev.days) ? (rev.days as RevenueDay[]) : []);
      setTotals((rev.totals as typeof totals) ?? { pos: 0, orders: 0, total: 0 });
      const tx = txRes.data ?? {};
      setTxs(Array.isArray(tx.rows) ? (tx.rows as TransactionRow[]) : []);
    } catch {
      setError("Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Memuat laporan..." />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan</h1>
          <p className="text-sm text-slate-500">Ringkasan pendapatan harian.</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="7d">7 hari</option>
          <option value="30d">30 hari</option>
          <option value="90d">90 hari</option>
        </select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="POS" value={`Rp${totals.pos.toLocaleString("id-ID")}`} tone="brand" />
        <StatCard label="Pesanan" value={`Rp${totals.orders.toLocaleString("id-ID")}`} tone="amber" />
        <StatCard label="Total" value={`Rp${totals.total.toLocaleString("id-ID")}`} tone="green" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Pendapatan per Hari</h2>
          {days.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Belum ada data.</p>
          ) : (
            <div className="space-y-1">
              {[...days].reverse().map((d) => (
                <div key={d.date} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-600">{d.date}</span>
                  <span className="font-semibold text-slate-800">Rp{d.total.toLocaleString("id-ID")}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Transaksi Terbaru</h2>
          {txs.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Belum ada transaksi.</p>
          ) : (
            <div className="space-y-1">
              {txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-brand-700">{t.invoiceNo}</p>
                    <p className="text-xs text-slate-400">{t.cashier?.name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={t.paymentMethod} />
                    <span className="font-semibold text-slate-800">
                      Rp{Number(t.grandTotal ?? 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}