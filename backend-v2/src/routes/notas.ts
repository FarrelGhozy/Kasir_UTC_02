// Route nota v2 — #101: riwayat & detail nota (POS + servis).
// RBAC (#95): semua role ter-login bisa lihat riwayat & detail.
import { Elysia, t } from "elysia";
import { listNotas, getNota } from "../services/notaService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";

export const notaRouter = new Elysia({ prefix: "/api/v2/notas" })
  .get("/", async ({ query, headers, set }) => {
    try {
      await requireAuth(headers);
      const type = query.type as string | undefined;
      const limit = query.limit ? Number(query.limit) : 50;
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      return listNotas({ type, limit, from, to });
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  .get("/:source/:id", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers);
      return getNota(params.source, Number(params.id));
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  });