// Route transaksi POS v2 — C1/H15 fix (atomic, anti-kembar) + #95 (RBAC)
import { Elysia, t } from "elysia";
import { createTransaction, listTransactions } from "../services/transactionService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";

export const transactionRouter = new Elysia({ prefix: "/api/v2/transactions" })
  .post(
    "/",
    async ({ body, headers, set }) => {
      try {
        const user = await requireAuth(headers, ["kasir", "teknisi", "admin"]);
        const tx = await createTransaction({
          cashierId: user.id, // jangan percaya client — asal dari token
          items: body.items,
          paymentMethod: body.paymentMethod,
          amountPaid: body.amountPaid,
          tax: body.tax ?? 0,
          notes: body.notes,
        });
        set.status = 201;
        return { success: true, data: tx };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        items: t.Array(
          t.Object({ itemId: t.Number(), qty: t.Integer({ minimum: 1 }) })
        ),
        paymentMethod: t.Enum({
          Cash: "Cash",
          Transfer: "Transfer",
          QRIS: "QRIS",
          Card: "Card",
        }),
        amountPaid: t.Number(),
        tax: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
      }),
      tags: ["Transactions"],
    }
  )
  // read-only: semua role ter-login bisa lihat
  .get("/", async ({ query, headers, set }) => {
    try {
      await requireAuth(headers);
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      const page = query.page ? Number(query.page) : 1;
      const limit = query.limit ? Number(query.limit) : 20;
      return listTransactions({ page, limit, from, to });
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  });