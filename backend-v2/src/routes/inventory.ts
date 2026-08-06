// Route inventory v2 — #97: CRUD item, adjust stock (audited), low-stock, summary.
// RBAC (#95): baca semua role; tulis kasir/teknisi/admin; summary admin/kasir (nilai inventori utk laporan).
import { Elysia, t } from "elysia";
import {
  createItem,
  listItems,
  getItem,
  updateItem,
  adjustStock,
  inventorySummary,
  deleteItem,
} from "../services/inventoryService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";
import { checkRateLimit } from "../middleware/security";

export const inventoryRouter = new Elysia({ prefix: "/api/v2/inventory" })
  // ── CRUD ──────────────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, headers, set, request }) => {
      try {
        const user = await requireAuth(headers, ["kasir", "teknisi", "admin"]);
        // #113: limit write inventory per-IP (anti brute/spam massal)
        const rl = checkRateLimit(request, "inventory-write");
        if (!rl.allowed) {
          set.status = 429;
          return { success: false, error: `Terlalu banyak permintaan — coba lagi dalam ${rl.retryAfterSec} detik` };
        }
        const item = await createItem({ ...body, createdById: user.id });
        set.status = 201;
        return { success: true, data: item };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        sku: t.String(),
        name: t.String(),
        category: t.Optional(t.String()),
        purchasePrice: t.Optional(t.Number()),
        sellingPrice: t.Number(),
        stock: t.Optional(t.Integer()),
        minStockAlert: t.Optional(t.Integer()),
        description: t.Optional(t.String()),
      }),
      tags: ["Inventory"],
    }
  )
  .get("/", async ({ query, headers, set }) => {
    try {
      await requireAuth(headers);
      return listItems({
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 20,
        search: query.search,
        category: query.category,
        lowStockOnly: query.lowStock === "true",
      });
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Inventory"] })
  .get("/summary", async ({ headers, set }) => {
    try {
      await requireAuth(headers, ["admin", "kasir"]);
      return { success: true, data: await inventorySummary() };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Inventory"] })
  .get("/:id", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers);
      return { success: true, data: await getItem(Number(params.id)) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Inventory"] })
  .put(
    "/:id",
    async ({ params, body, headers, set }) => {
      try {
        await requireAuth(headers, ["kasir", "teknisi", "admin"]);
        return { success: true, data: await updateItem(Number(params.id), body) };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        category: t.Optional(t.String()),
        purchasePrice: t.Optional(t.Number()),
        sellingPrice: t.Optional(t.Number()),
        minStockAlert: t.Optional(t.Integer()),
        description: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      tags: ["Inventory"],
    }
  )
  .delete("/:id", async ({ params, headers, set, request }) => {
    try {
      await requireAuth(headers, ["kasir", "teknisi", "admin"]);
      // #113: limit delete per-IP (anti penghapusan massal otomatis)
      const rl = checkRateLimit(request, "inventory-write");
      if (!rl.allowed) {
        set.status = 429;
        return { success: false, error: `Terlalu banyak permintaan — coba lagi dalam ${rl.retryAfterSec} detik` };
      }
      return { success: true, data: await deleteItem(Number(params.id)) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Inventory"] })
  // ── Adjust stok (stock opname / koreksi) ──────────────────────────────────
  .post(
    "/adjust-stock",
    async ({ body, headers, set }) => {
      try {
        const user = await requireAuth(headers, ["kasir", "teknisi", "admin"]);
        const item = await adjustStock({ ...body, createdById: user.id });
        return { success: true, data: item };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        itemId: t.Number(),
        delta: t.Integer(),
        reason: t.String(),
      }),
      tags: ["Inventory"],
    }
  );