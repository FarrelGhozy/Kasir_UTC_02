import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Spinner, Alert, Badge } from "../components/ui";

interface Item {
  id: number;
  sku: string;
  name: string;
  category: string;
  sellingPrice: string;
  stock: number;
}
interface CartLine {
  item: Item;
  qty: number;
}

export function PosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState("Cash");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // #112: ringkasan transaksi hari ini (WIB) dari backend
  const [today, setToday] = useState<{ date: string; totalTransactions: number; totalRevenue: number; byMethod: Record<string, number> } | null>(null);

  // #112: quick-amount — nominal cepat tambah ke uang dibayar
  const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];
  function addQuick(amount: number) {
    setPaid(String((Number(paid) || 0) + amount));
  }

  const loadToday = useCallback(async () => {
    try {
      const { data } = await api.get("/v2/transactions/summary/today");
      setToday(data?.data ?? null);
    } catch {
      // ringkasan opsional — jangan ganggu POS kalau gagal
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/v2/inventory", { params: { limit: 100, search: search || undefined } });
      setItems(Array.isArray(data?.rows) ? (data.rows as Item[]) : []);
    } catch {
      setError("Gagal memuat produk.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const cartTotal = cart.reduce((s, l) => s + Number(l.item.sellingPrice) * l.qty, 0);
  // #112: kembalian dihitung live sebelum transaksi disimpan
  const paidAmount = Number(paid) || cartTotal;
  const change = paidAmount - cartTotal;

  function addToCart(item: Item) {
    setCart((c) => {
      const ex = c.find((l) => l.item.id === item.id);
      if (ex) return c.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { item, qty: 1 }];
    });
  }
  function setQty(id: number, qty: number) {
    setCart((c) => (qty <= 0 ? c.filter((l) => l.item.id !== id) : c.map((l) => (l.item.id === id ? { ...l, qty } : l))));
  }

  async function checkout() {
    if (!cart.length || !user) return;
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post("/v2/transactions", {
        cashierId: user.id,
        items: cart.map((l) => ({ itemId: l.item.id, qty: l.qty })),
        paymentMethod: method,
        amountPaid: paid || String(cartTotal),
      });
      setSuccess(`Transaksi ${data?.transaction?.invoiceNo ?? ""} berhasil!`);
      setCart([]);
      setPaid("");
      load();
      loadToday();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Transaksi gagal.");
    }
  }

  if (loading) return <Spinner label="Memuat produk..." />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Katalog */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">POS — Kasir</h1>
          <p className="text-sm text-slate-500">Klik produk untuk menambah ke keranjang.</p>
          {/* #112: ringkasan transaksi hari ini */}
          {today && (
            <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-700">Hari ini ({today.date})</span>
              <span className="rounded-full bg-white px-2 py-0.5 font-medium text-slate-600">{today.totalTransactions} transaksi</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">Rp{today.totalRevenue.toLocaleString("id-ID")}</span>
            </div>
          )}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Cari produk / SKU…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
        {items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-400">Tidak ada produk ditemukan.</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => addToCart(it)}
                disabled={it.stock <= 0}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <div className="flex items-center justify-between">
                  <Badge status={it.category.toLowerCase()} />
                  <span className={`text-xs ${it.stock <= 0 ? "text-red-500" : "text-slate-400"}`}>
                    stok {it.stock}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm font-medium text-slate-800">{it.name}</p>
                <p className="mt-1 text-sm font-bold text-brand-700">
                  Rp{Number(it.sellingPrice).toLocaleString("id-ID")}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Keranjang */}
      <Card className="flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-4">
        <h2 className="text-sm font-semibold text-slate-700">Keranjang</h2>
        {cart.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">Kosong — klik produk di samping.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-auto">
            {cart.map((l) => (
              <li key={l.item.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-700">{l.item.name}</p>
                  <p className="text-[10px] text-slate-400">Rp{Number(l.item.sellingPrice).toLocaleString("id-ID")}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setQty(l.item.id, l.qty - 1)} className="h-6 w-6 rounded bg-white text-xs shadow-sm">−</button>
                  <span className="w-5 text-center text-xs font-bold">{l.qty}</span>
                  <button onClick={() => setQty(l.item.id, l.qty + 1)} className="h-6 w-6 rounded bg-white text-xs shadow-sm">+</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between border-t border-slate-100 pt-2 text-sm">
          <span className="text-slate-500">Total</span>
          <span className="font-bold text-slate-900">Rp{cartTotal.toLocaleString("id-ID")}</span>
        </div>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
        >
          <option value="Cash">TUNAI</option>
          <option value="QRIS">QRIS</option>
          <option value="Card">DEBIT/KARTU</option>
          <option value="Transfer">TRANSFER</option>
        </select>
        <input
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
          placeholder={`Dibayar (Rp) — default ${cartTotal.toLocaleString("id-ID")}`}
          type="number"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
        {/* #112: quick-amount — tambah nominal cepat */}
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              onClick={() => addQuick(q)}
              type="button"
              className="rounded-lg border border-brand-200 bg-brand-50 px-1 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
            >
              +{q >= 1000 ? `${q / 1000}rb` : q}
            </button>
          ))}
        </div>
        {/* #112: kembalian live sebelum disimpan */}
        <div
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {change >= 0 ? `Kembalian: Rp${change.toLocaleString("id-ID")}` : `Kurang: Rp${Math.abs(change).toLocaleString("id-ID")}`}
        </div>
        <Button onClick={checkout} disabled={!cart.length}>
          Bayar Rp{cartTotal.toLocaleString("id-ID")}
        </Button>
      </Card>
    </div>
  );
}