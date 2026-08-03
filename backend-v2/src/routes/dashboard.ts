// Route dashboard v2 — #98: summary bisnis role-aware.
import { Elysia } from "elysia";
import { dashboardSummary } from "../services/dashboardService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";

export const dashboardRouter = new Elysia({ prefix: "/api/v2/dashboard" })
  .get("/summary", async ({ headers, set }) => {
    try {
      const user = await requireAuth(headers);
      return { success: true, data: await dashboardSummary(user) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Dashboard"] });