// Route duty-schedules v2 — #100: jadwal piket kebersihan.
// RBAC (#95): kelola (POST/PUT/DELETE) khusus admin; baca (GET) semua role.
import { Elysia, t } from "elysia";
import {
  listSchedules,
  listByDay,
  listMySchedule,
  listTodaySchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from "../services/dutyScheduleService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";

export const dutyScheduleRouter = new Elysia({ prefix: "/api/v2/duty-schedules" })
  // ── Kelola (admin) ─────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, headers, set }) => {
      try {
        await requireAuth(headers, ["admin"]);
        const r = await createSchedule(body.userId, body.day);
        set.status = 201;
        return r;
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({ userId: t.Integer(), day: t.String() }),
      tags: ["DutySchedule"],
    }
  )
  .put(
    "/:id",
    async ({ params, body, headers, set }) => {
      try {
        await requireAuth(headers, ["admin"]);
        return await updateSchedule(Number(params.id), body.day);
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ day: t.Optional(t.String()) }),
      tags: ["DutySchedule"],
    }
  )
  .delete(
    "/:id",
    async ({ params, headers, set }) => {
      try {
        await requireAuth(headers, ["admin"]);
        return await deleteSchedule(Number(params.id));
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      tags: ["DutySchedule"],
    }
  )
  // ── Baca (semua role) ──────────────────────────────────────────────────────
  .get("/", async ({ headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      return await listSchedules();
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  .get("/day/:day", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      return await listByDay(params.day);
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  .get("/my", async ({ headers, set }) => {
    try {
      const user = await requireAuth(headers);
      return await listMySchedule(user.id);
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  .get("/today", async ({ headers, set }) => {
    try {
      await requireAuth(headers);
      return await listTodaySchedule();
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  });