// LaporanPage v2 — #105: laporan lengkap & analitik.
// Tab: Pendapatan (harian/mingguan range) • Top Items (admin) • Performa Kasir (admin) • Workload Teknisi (admin) • Rekap Lengkap (admin)
import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { Card, Spinner, Alert, StatCard, Badge } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

interface RevenueDay {
  date: string;
  pos: number;
  orders: number;
  total: number;
}
interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}
interface CashierRow {
  cashierId: number | null;
  cashierName: string;
  transactions: number;
  revenue: number;
}
interface TechRow {
  technicianId: number | null;
  technicianName: string;
  tickets: number;
  completed: number;
  revenue: number;
}
interface RecapRow {
  id: number;
  source: "pos" | "servis" | "order";
  ref: string;
  customer: string | null;
  status: string;
  amount: number;
  date: string;
}

const TABS = [
  { id: "pendapatan", label: "Pendapatan" },
  { id: "top", label: "Top Items" },
  { id: "kasir", label: "Performa Kasir" },
  { id: "teknisi", label: "Workload Teknisi" },
  { id: "rekap", label: "Rekap Lengkap" },
];

export function LaporanPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState("pendapatan");
  const [range, setRange] = useState("30d");
  const [days, setDays] = useState<RevenueDay[]>([]);
  const [totals, setTotals] = useState<{ pos: number; orders: number; total: number }>({ pos: 0, orders: 0, total: 0 });
  const [top, setTop] = useState<TopItem[]>([]);
  const [cashiers, setCashiers] = useState<CashierRow[]>([]);
  const [techs, setTechs] = useState<TechRow[]>([]);
  const [recap, setRecap] = useState<RecapRow[]>([]);
  const [recapTotals, setRecapTotals] = useState<{ pos: number; servis: number; order: number; grandTotal: number } | null>(null);
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
    setError("");
    try {
      const { from, to } = rangeTo(range);
      const params = { from, to };
      if (tab === "pendapatan") {
        const rev = (await api.get("/v2/reports/revenue", { params })).data ?? {};
        setDays(Array.isArray(rev.data?.days) ? rev.data.days : []);
        setTotals(rev.data?.totals ?? { pos: 0, orders: 0, total: 0 });
      } else if (tab === "top" && isAdmin) {
        const r = (await api.get("/v2/reports/top-items", { params })).data ?? {};
        setTop(Array.isArray(r.data?.rows) ? r.data.rows : []);
      } else if (tab === "kasir" && isAdmin) {
        const r = (await api.get("/v2/reports/cashiers", { params })).data ?? {};
        setCashiers(Array.isArray(r.data?.rows) ? r.data.rows : []);
      } else if (tab === "teknisi" && isAdmin) {
        const r = (await api.get("/v2/reports/technicians", { params })).data ?? {};
        setTechs(Array.isArray(r.data?.rows) ? r.data.rows : []);
      } else if (tab === "rekap" && isAdmin) {
        const r = (await api.get("/v2/reports/full-recap", { params })).data ?? {};
        setRecap(Array.isArray(r.data?.rows) ? r.data.rows : []);
        setRecapTotals(r.data?.totals ?? null);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }, [tab, range, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs = isAdmin ? TABS : TABS.filter((t) => t.id === "pendapatan");

  if (loading) return <Spinner label="Memuat laporan..." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan</h1>
          <p className="text-sm text-slate-500">Analitik pendapatan, produk, dan performa tim.</p>
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

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Tab: Pendapatan */}
      {tab === "pendapatan" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="POS" value={`Rp${totals.pos.toLocaleString("id-ID")}`} tone="brand" />
            <StatCard label="Pesanan" value={`Rp${totals.orders.toLocaleString("id-ID")}`} tone="amber" />
            <StatCard label="Total" value={`Rp${totals.total.toLocaleString("id-ID")}`} tone="green" />
          </div>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Pendapatan per Hari (WIB)</h2>
            {days.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Belum ada data.</p>
            ) : (
              <div className="max-h-96 space-y-1 overflow-auto">
                {[...days].reverse().map((d) => (
                  <div key={d.date} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-600">{d.date}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">POS Rp{d.pos.toLocaleString("id-ID")}</span>
                      <span className="text-xs text-amber-500">Order Rp{d.orders.toLocaleString("id-ID")}</span>
                      <span className="w-32 text-right font-semibold text-slate-800">Rp{d.total.toLocaleString("id-ID")}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Tab: Top Items */}
      {tab === "top" && isAdmin && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Produk Terlaris</h2>
          {top.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Belum ada data.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {top.map((it, i) => (
                    <tr key={`${it.name}-${i}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{it.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{it.qty}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">Rp{it.revenue.toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Performa Kasir */}
      {tab === "kasir" && isAdmin && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Performa Kasir</h2>
          {cashiers.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Belum ada data.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Kasir</th>
                    <th className="px-4 py-3 text-right">Transaksi</th>
                    <th className="px-4 py-3 text-right">Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashiers.map((c) => (
                    <tr key={c.cashierId ?? "null"} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{c.cashierName}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{c.transactions}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">Rp{c.revenue.toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Workload Teknisi */}
      {tab === "teknisi" && isAdmin && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Workload Teknisi</h2>
          {techs.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">Belum ada data.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Teknisi</th>
                    <th className="px-4 py-3 text-right">Tiket</th>
                    <th className="px-4 py-3 text-right">Selesai</th>
                    <th className="px-4 py-3 text-right">Pendapatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {techs.map((t) => (
                    <tr key={t.technicianId ?? "null"} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{t.technicianName}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{t.tickets}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{t.completed}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">Rp{t.revenue.toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Rekap Lengkap */}
      {tab === "rekap" && isAdmin && (
        <>
          {recapTotals && (
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="POS" value={`Rp${recapTotals.pos.toLocaleString("id-ID")}`} tone="brand" />
              <StatCard label="Servis" value={`Rp${recapTotals.servis.toLocaleString("id-ID")}`} tone="amber" />
              <StatCard label="Order" value={`Rp${recapTotals.order.toLocaleString("id-ID")}`} tone="brand" />
              <StatCard label="Grand Total" value={`Rp${recapTotals.grandTotal.toLocaleString("id-ID")}`} tone="green" />
            </div>
          )}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Rekap Semua Transaksi</h2>
            {recap.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Belum ada data.</p>
            ) : (
              <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">No. Ref</th>
                      <th className="px-4 py-3">Sumber</th>
                      <th className="px-4 py-3">Pelanggan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recap.map((r, i) => (
                      <tr key={`${r.source}-${r.id}-${i}`} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-500">{r.date}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-brand-700">{r.ref}</td>
                        <td className="px-4 py-2.5"><Badge status={r.source} /></td>
                        <td className="px-4 py-2.5 text-slate-700">{r.customer ?? "—"}</td>
                        <td className="px-4 py-2.5 capitalize text-slate-500">{r.status}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-800">Rp{r.amount.toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
