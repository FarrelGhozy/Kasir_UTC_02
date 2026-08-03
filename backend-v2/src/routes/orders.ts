// Route Special Order v2 — FSM ketat + payment sinkron (H1/H2/H13/H14) + #95 (RBAC)
import { Elysia, t } from "elysia";
import {
  createOrder,
  transitionOrderStatus,
  addOrderPayment,
  orderFinancials,
} from "../services/orderService";
import { claimWarranty } from "../services/warrantyService";
import { revenueReport } from "../services/reportService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";

export const orderRouter = new Elysia({ prefix: "/api/v2/orders" })
  // buat order baru (DP otomatis tercatat sebagai payment) — kasir/teknisi/admin
  .post(
    "/",
    async ({ body, headers, set }) => {
      try {
        const user = await requireAuth(headers, ["kasir", "teknisi", "admin"]);
        const order = await createOrder({ ...body, handledById: body.handledById ?? user.id });
        set.status = 201;
        return { success: true, data: order };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        customerId: t.Optional(t.Number()),
        itemName: t.String(),
        itemDescription: t.Optional(t.String()),
        estimatedPrice: t.Number(),
        downPayment: t.Optional(t.Number()),
        handledById: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
      }),
    }
  )
  // detail keuangan order — semua role ter-login
  .get("/:id", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers);
      return { success: true, data: await orderFinancials(Number(params.id)) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // transisi status — FSM ketat (Picked_Up hanya dari Arrived) — kasir/teknisi/admin
  .patch(
    "/:id/status",
    async ({ params, body, headers, set }) => {
      try {
        await requireAuth(headers, ["kasir", "teknisi", "admin"]);
        const data = await transitionOrderStatus(Number(params.id), body.status);
        return { success: true, data };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        status: t.Enum({ Pending: "Pending", Searching: "Searching", Ordered: "Ordered", Arrived: "Arrived", Picked_Up: "Picked_Up", Cancelled: "Cancelled" }),
      }),
    }
  )
  // catat pembayaran → status otomatis Lunas kalau lunas — kasir/teknisi/admin
  .post(
    "/:id/payments",
    async ({ params, body, headers, set }) => {
      try {
        const user = await requireAuth(headers, ["kasir", "teknisi", "admin"]);
        const data = await addOrderPayment({
          orderId: Number(params.id),
          amount: body.amount,
          method: body.method,
          createdById: body.createdById ?? user.id,
        });
        return { success: true, data };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        amount: t.Number(),
        method: t.Enum({ Cash: "Cash", Transfer: "Transfer", QRIS: "QRIS", Card: "Card" }),
        createdById: t.Optional(t.Number()),
      }),
    }
  );

// ── Warranty claim (M8) — teknisi/kasir/admin ────────────────────────────────
export const warrantyRouter = new Elysia({ prefix: "/api/v2/warranty" })
  .post(
    "/claim",
    async ({ body, headers, set }) => {
      try {
        await requireAuth(headers, ["teknisi", "kasir", "admin"]);
        const ticket = await claimWarranty({ ...body, device: body.device ?? {} });
        set.status = 201;
        return { success: true, data: ticket };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        sourceTicketId: t.Number(),
        customerId: t.Optional(t.Number()),
        device: t.Optional(t.Any()),
        technicianId: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
      }),
    }
  );

// ── Report revenue (H2: POS + order payments) — admin/kasir/teknisi ───────────
export const reportRouter = new Elysia({ prefix: "/api/v2/reports" })
  .get("/revenue", async ({ query, headers, set }) => {
    try {
      await requireAuth(headers, ["admin", "kasir", "teknisi"]);
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      return { success: true, data: await revenueReport({ from, to }) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  });