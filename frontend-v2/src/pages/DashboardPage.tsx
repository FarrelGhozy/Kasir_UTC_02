import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import api from "../lib/api";

function formatIDR(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 w-24 bg-slate-200 rounded" />
      <div className="mt-2 h-6 w-32 bg-slate-200 rounded" />
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const res = await api.get("/v2/dashboard/summary");
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  // #106: seri 30 hari utk grafik
  const { data: trend } = useQuery({
    queryKey: ["dashboard-trend"],
    queryFn: async () => {
      const res = await api.get("/v2/dashboard/trend-30d");
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  if (isError) {
    const msg = error instanceof Error ? error.message : "Terjadi kesalahan";
    return (
      <div className="card border border-red-300">
        <p className="font-semibold text-red-600">Gagal memuat dashboard</p>
        <p className="mt-1 text-sm text-slate-500">{msg}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const isFull = data?.scope === "full";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-slate-500">
          Ringkasan aktivitas workshop · {data?.date ?? "..."}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Pendapatan Hari Ini"
            value={formatIDR(isFull ? data?.revenueToday ?? null : null)}
            sub={isFull ? undefined : "hanya akses kasir/admin"}
          />
          <StatCard
            label="Transaksi Hari Ini"
            value={isFull ? String(data?.transactionsToday ?? 0) : "—"}
          />
          <StatCard
            label="Stok Menipis"
            value={isFull ? String(data?.lowStockCount ?? 0) : "—"}
          />
          <StatCard
            label="Tiket Servis Aktif"
            value={String(data?.activeServiceTickets ?? 0)}
          />
        </div>
      )}

      {/* #106: grafik 30 hari */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold">
            Penghasilan 30 Hari{" "}
            {trend && trend.totals && (
              <span
                className={`ml-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                  trend.trend > 0 ? "bg-green-100 text-green-700" : trend.trend < 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {trend.trend > 0 ? "▲" : trend.trend < 0 ? "▼" : "•"} {Math.abs(trend.trend)}% vs periode sebelumnya
              </span>
            )}
          </h3>
          <div className="mt-3 h-56">
            {trend?.days?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.days} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(0)}rb` : String(v))} />
                  <Tooltip formatter={(v) => formatIDR(typeof v === "number" ? v : Number(v ?? 0))} labelStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" name="Penghasilan" stroke="#4f46e5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-400">Memuat data…</p>
            )}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold">Transaksi 30 Hari</h3>
          <div className="mt-3 h-56">
            {trend?.days?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.days} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip labelStyle={{ fontSize: 12 }} />
                  <Bar dataKey="transactions" name="Transaksi" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-slate-400">Memuat data…</p>
            )}
          </div>
        </div>
      </div>

      {isFull && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h3 className="font-semibold">Transaksi Terbaru</h3>
            {data?.recentTransactions?.length ? (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {data.recentTransactions.map((t: { id: number; invoiceNo: string; grandTotal: string }) => (
                  <li key={t.id} className="flex justify-between py-2">
                    <span>{t.invoiceNo}</span>
                    <span className="font-medium">{formatIDR(Number(t.grandTotal))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Belum ada transaksi hari ini</p>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold">Servis Terbaru</h3>
            {data?.recentServiceTickets?.length ? (
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {data.recentServiceTickets.map((t: any) => (
                  <li key={t.id} className="flex justify-between py-2">
                    <span>
                      {t.ticketNumber}
                      {t.customer?.name ? ` · ${t.customer.name}` : ""}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                      {t.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Belum ada tiket servis</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}