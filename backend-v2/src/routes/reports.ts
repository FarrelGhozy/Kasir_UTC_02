// Route laporan v2 — #105: endpoint terpusat laporan & analitik.
// Revenue (daily/monthly/range) → semua role ter-login (paritas main).
// Top items / cashier / technician / full-recap → ADMIN ONLY (paritas main).
import { Elysia } from "elysia";
import {
  revenueReport,
  topItemsReport,
  cashierPerformance,
  technicianPerformance,
  fullRecap,
} from "../services/reportService";
import { requireAuth, type IncomingHeaders } from "../middleware/auth";
import { mapError } from "../middleware/error";

function parseRange(query: Record<string, string | undefined>) {
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  if (from && isNaN(from.getTime())) throw Object.assign(new Error("[BIZ] Tanggal 'from' tidak valid"), { status: 400 });
  if (to && isNaN(to.getTime())) throw Object.assign(new Error("[BIZ] Tanggal 'to' tidak valid"), { status: 400 });
  if (from && to && from > to) throw Object.assign(new Error("[BIZ] Range tanggal tidak valid ('from' > 'to')"), { status: 400 });
  return { from, to };
}

const guardAny = async (headers: IncomingHeaders) => requireAuth(headers);
const guardAdmin = async (headers: IncomingHeaders) => requireAuth(headers, ["admin"]);

export const reportRouter = new Elysia({ prefix: "/api/v2/reports" })
  .get("/revenue", async ({ query, headers, set }) => {
    try {
      await guardAny(headers);
      const { from, to } = parseRange(query);
      return { success: true, data: await revenueReport({ from, to }) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // #105: alias paritas main — /reports/revenue/range
  .get("/revenue/range", async ({ query, headers, set }) => {
    try {
      await guardAny(headers);
      const { from, to } = parseRange(query);
      return { success: true, data: await revenueReport({ from, to }) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // #105: revenue hari ini (WIB)
  .get("/revenue/daily", async ({ headers, set }) => {
    try {
      await guardAny(headers);
      return { success: true, data: await revenueReport({}) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // #105: revenue bulan berjalan (WIB) — from = awal bulan
  .get("/revenue/monthly", async ({ headers, set }) => {
    try {
      await guardAny(headers);
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { success: true, data: await revenueReport({ from, to: now }) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // #105: top items — ADMIN ONLY
  .get("/top-items", async ({ query, headers, set }) => {
    try {
      await guardAdmin(headers);
      const { from, to } = parseRange(query);
      const limit = query.limit ? Number(query.limit) : 10;
      return { success: true, data: await topItemsReport({ from, to, limit }) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // #105: performa kasir — ADMIN ONLY
  .get("/cashiers", async ({ query, headers, set }) => {
    try {
      await guardAdmin(headers);
      const { from, to } = parseRange(query);
      return { success: true, data: await cashierPerformance({ from, to }) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // #105: workload teknisi — ADMIN ONLY
  .get("/technicians", async ({ query, headers, set }) => {
    try {
      await guardAdmin(headers);
      const { from, to } = parseRange(query);
      return { success: true, data: await technicianPerformance({ from, to }) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // #105: rekap lengkap semua transaksi — ADMIN ONLY
  .get("/full-recap", async ({ query, headers, set }) => {
    try {
      await guardAdmin(headers);
      const { from, to } = parseRange(query);
      const limit = query.limit ? Number(query.limit) : 100;
      return { success: true, data: await fullRecap({ from, to, limit }) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  });
