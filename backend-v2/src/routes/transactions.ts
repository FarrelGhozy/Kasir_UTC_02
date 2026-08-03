// Route transaksi POS v2 — C1/H15 fix (atomic, anti-kembar)
import { Elysia, t } from "elysia";
import { createTransaction, listTransactions } from "../services/transactionService";

/** Ekstrak pesan business error (tanpa mengubah error lain jadi 500) */
function businessError(e: unknown): { status: number; body: { error: string } } {
  const msg = e instanceof Error ? e.message : "Terjadi kesalahan";
  // error bisnis kita lemparkan sebagai Error biasa bertanda [BIZ]
  if (msg.startsWith("[BIZ]")) {
    return { status: 400, body: { error: msg.replace("[BIZ]", "").trim() } };
  }
  console.error("[transactions] error:", e);
  return { status: 500, body: { error: "Internal Server Error" } };
}

export const transactionRouter = new Elysia({ prefix: "/api/v2/transactions" })
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const tx = await createTransaction({
          cashierId: body.cashierId,
          items: body.items,
          paymentMethod: body.paymentMethod,
          amountPaid: body.amountPaid,
          tax: body.tax ?? 0,
          notes: body.notes,
        });
        set.status = 201;
        return { success: true, data: tx };
      } catch (e) {
        const r = businessError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        cashierId: t.Number(),
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
    }
  )
  .get("/", async ({ query }) => {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    return listTransactions({ page, limit, from, to });
  });