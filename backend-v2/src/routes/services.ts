// Route service ticket v2 — #97: CRUD tiket + FSM status + parts + fee + logs.
// RBAC (#95): tulis teknisi/kasir/admin; baca semua role ter-login.
import { Elysia, t } from "elysia";
import {
  createServiceTicket,
  listServiceTickets,
  getServiceTicket,
  updateServiceTicket,
  transitionServiceStatus,
  addServicePart,
  removeServicePart,
  setServiceFee,
  deleteServiceTicket,
  serviceLogs,
} from "../services/serviceService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";

export const serviceRouter = new Elysia({ prefix: "/api/v2/services" })
  // ── CRUD tiket ────────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, headers, set }) => {
      try {
        const user = await requireAuth(headers, ["teknisi", "kasir", "admin"]);
        const ticket = await createServiceTicket({ ...body, createdBy: user.name });
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
        customerName: t.Optional(t.String()),
        customerPhone: t.Optional(t.String()),
        device: t.Optional(t.Any()),
        technicianId: t.Optional(t.Number()),
        technicianName: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        serviceFee: t.Optional(t.Number()),
      }),
      tags: ["Services"],
    }
  )
  .get("/", async ({ query, headers, set }) => {
    try {
      await requireAuth(headers);
      return listServiceTickets({
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
        status: query.status,
        technicianId: query.technicianId ? Number(query.technicianId) : undefined,
        search: query.search,
      });
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Services"] })
  .get("/logs", async ({ query, headers, set }) => {
    try {
      await requireAuth(headers);
      const ticketId = query.ticketId ? Number(query.ticketId) : undefined;
      return { success: true, data: await serviceLogs(ticketId) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Services"] })
  .get("/:id", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers);
      return { success: true, data: await getServiceTicket(Number(params.id)) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Services"] })
  .put(
    "/:id",
    async ({ params, body, headers, set }) => {
      try {
        await requireAuth(headers, ["teknisi", "kasir", "admin"]);
        return { success: true, data: await updateServiceTicket(Number(params.id), body) };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        device: t.Optional(t.Any()),
        technicianId: t.Optional(t.Number()),
        technicianName: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        paymentMethod: t.Optional(
          t.Enum({ Cash: "Cash", Transfer: "Transfer", QRIS: "QRIS", Card: "Card" })
        ),
      }),
      tags: ["Services"],
    }
  )
  .delete("/:id", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      return { success: true, data: await deleteServiceTicket(Number(params.id)) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Services"] })
  // ── FSM status ────────────────────────────────────────────────────────────
  .patch(
    "/:id/status",
    async ({ params, body, headers, set }) => {
      try {
        const user = await requireAuth(headers, ["teknisi", "kasir", "admin"]);
        const ticket = await transitionServiceStatus({
          ticketId: Number(params.id),
          to: body.status,
          note: body.note,
          createdBy: user.name,
        });
        return { success: true, data: ticket };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        status: t.Enum({
          Queue: "Queue",
          Diagnosing: "Diagnosing",
          In_Progress: "In_Progress",
          Waiting_Part: "Waiting_Part",
          Completed: "Completed",
          Ready_For_Pickup: "Ready_For_Pickup",
          Picked_Up: "Picked_Up",
          Cancelled: "Cancelled",
        }),
        note: t.Optional(t.String()),
      }),
      tags: ["Services"],
    }
  )
  // ── Parts ─────────────────────────────────────────────────────────────────
  .post(
    "/:id/parts",
    async ({ params, body, headers, set }) => {
      try {
        const user = await requireAuth(headers, ["teknisi", "kasir", "admin"]);
        const part = await addServicePart({
          ticketId: Number(params.id),
          itemId: body.itemId,
          qty: body.qty,
          createdById: user.id,
        });
        set.status = 201;
        return { success: true, data: part };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        itemId: t.Number(),
        qty: t.Integer({ minimum: 1 }),
      }),
      tags: ["Services"],
    }
  )
  .delete("/:id/parts/:partId", async ({ params, headers, set }) => {
    try {
      const user = await requireAuth(headers, ["teknisi", "kasir", "admin"]);
      const result = await removeServicePart({
        ticketId: Number(params.id),
        partId: Number(params.partId),
        createdById: user.id,
      });
      return { success: true, data: result };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Services"] })
  // ── Service fee ───────────────────────────────────────────────────────────
  .patch(
    "/:id/service-fee",
    async ({ params, body, headers, set }) => {
      try {
        await requireAuth(headers, ["teknisi", "kasir", "admin"]);
        const ticket = await setServiceFee({
          ticketId: Number(params.id),
          fee: body.fee,
        });
        return { success: true, data: ticket };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({ fee: t.Number() }),
      tags: ["Services"],
    }
  );