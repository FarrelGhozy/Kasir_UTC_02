import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data } = await api.get("/health");
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-slate-500">
          Ringkasan aktivitas workshop & penjualan
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">Status Backend</p>
          <p className="mt-1 text-lg font-semibold">
            {isLoading ? "..." : data?.status === "ok" ? "✅ Online" : "⚠️ Offline"}
          </p>
        </div>
      </div>
    </div>
  );
}