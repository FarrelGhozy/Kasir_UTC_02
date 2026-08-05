import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";
import { Spinner, Alert, Badge, StatCard, Button } from "../components/ui";

interface Item {
  id: number;
  sku: string;
  name: string;
  category: string;
  purchasePrice: string;
  sellingPrice: string;
  stock: number;
  minStockAlert: number;
  isActive: boolean;
}
interface Summary {
  totalItems?: number;
  lowStock?: number;
  stockValue?: number;
  [k: string]: unknown;
}

export function GudangPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // #108: import/export CSV
  const [importResult, setImportResult] = useState<{ added: number; updated: number; failed: number; errors: { row: number; sku?: string; error: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        api.get("/v2/inventory", { params: { limit: 100, search: search || undefined, lowStockOnly: lowOnly || undefined } }),
        api.get("/v2/inventory/summary"),
      ]);
      setItems(Array.isArray(listRes.data?.rows) ? (listRes.data.rows as Item[]) : []);
      setSummary((sumRes.data?.data ?? sumRes.data) as Summary);
    } catch {
      setError("Gagal memuat data gudang.");
    } finally {
      setLoading(false);
    }
  }, [search, lowOnly]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function toggleActive(it: Item) {
    try {
      await api.put(`/v2/inventory/${it.id}`, { isActive: !it.isActive });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Gagal mengubah status item.");
    }
  }

  const lowCount = items.filter((i) => i.stock <= i.minStockAlert).length;

  // ── #108: import/export CSV ────────────────────────────────────────────────
  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setImportResult(null);
    try {
      const text = await file.text();
      const r = await api.post("/v2/inventory/import", { csv: text });
      setImportResult(r.data);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Gagal import CSV.");
    }
  }

  async function downloadCsv(url: string, filename: string) {
    try {
      const r = await api.get(url, { responseType: "text" });
      const blob = new Blob([r.data as string], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch {
      setError("Gagal mengunduh file CSV.");
    }
  }

  if (loading) return <Spinner label="Memuat gudang..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gudang / Inventory</h1>
        <p className="text-sm text-slate-500">Kelola stok barang.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Item" value={String(summary.totalItems ?? items.length)} />
        <StatCard label="Stok Menipis" value={String(summary.lowStock ?? lowCount)} tone="amber" />
        <StatCard label="Nilai Stok" value={`Rp${Number(summary.stockValue ?? 0).toLocaleString("id-ID")}`} />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Cari nama / SKU…"
          className="min-w-56 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Stok menipis saja
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFilePicked} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            📥 Import CSV
          </Button>
          <Button variant="outline" onClick={() => downloadCsv("/v2/inventory/export", `inventory-${new Date().toISOString().slice(0, 10)}.csv`)}>
            📤 Export CSV
          </Button>
          <Button variant="outline" onClick={() => downloadCsv("/v2/inventory/template", "inventory-template.csv")}>
            📋 Template
          </Button>
        </div>
      </div>

      {/* #108: hasil import */}
      {importResult && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            importResult.failed > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <p className="font-semibold">
            Import selesai — <span className="text-emerald-700">{importResult.added} ditambah</span>,{" "}
            <span className="text-sky-700">{importResult.updated} diperbarui</span>,{" "}
            <span className={importResult.failed > 0 ? "text-red-600" : ""}>{importResult.failed} gagal</span>
          </p>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 max-h-32 list-inside list-disc overflow-auto text-xs">
              {importResult.errors.map((e, i) => (
                <li key={i}>
                  Baris {e.row}
                  {e.sku ? ` (${e.sku})` : ""}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Harga Jual</th>
              <th className="px-4 py-3">Stok</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{it.sku}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{it.name}</td>
                <td className="px-4 py-3">
                  <Badge status={it.category.toLowerCase()} />
                </td>
                <td className="px-4 py-3">Rp{Number(it.sellingPrice).toLocaleString("id-ID")}</td>
                <td className="px-4 py-3">
                  <span className={it.stock <= it.minStockAlert ? "font-bold text-red-500" : "text-slate-700"}>
                    {it.stock}
                  </span>
                  {it.stock <= it.minStockAlert && <span className="ml-1 text-[10px] text-red-400">⚠ menipis</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(it)} className="text-xs">
                    <Badge status={it.isActive ? "active" : "inactive"} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}