// Route user management v2 — #92/#95: kelola pengguna & teknisi (ADMIN ONLY).
import { Elysia, t } from "elysia";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";
import {
  listUsers,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
} from "../services/userService";

export const userRouter = new Elysia({ prefix: "/api/v2/users" })
  // GET /api/v2/users?q= → daftar user (admin)
  .get("/", async ({ headers, set, query }) => {
    try {
      await requireAuth(headers, ["admin"]);
      return await listUsers(query.q);
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // POST /api/v2/users → buat user/teknisi baru (admin)
  .post(
    "/",
    async ({ headers, set, body }) => {
      try {
        await requireAuth(headers, ["admin"]);
        return { success: true, user: await createUser(body) };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        username: t.String(),
        password: t.String(),
        role: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        jabatan: t.Optional(t.String()),
        isActive: t.Optional(t.Union([t.Boolean(), t.String()])),
      }),
      tags: ["Users"],
    }
  )
  // PUT /api/v2/users/:id → update profil/role (admin)
  .put(
    "/:id",
    async ({ headers, set, params, body }) => {
      try {
        await requireAuth(headers, ["admin"]);
        return { success: true, user: await updateUser(Number(params.id), body) };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        role: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        jabatan: t.Optional(t.String()),
        isActive: t.Optional(t.Union([t.Boolean(), t.String()])),
      }),
      tags: ["Users"],
    }
  )
  // POST /api/v2/users/:id/reset-password → reset password (admin)
  .post(
    "/:id/reset-password",
    async ({ headers, set, params, body }) => {
      try {
        await requireAuth(headers, ["admin"]);
        return await resetPassword(Number(params.id), body.password);
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({ password: t.String() }),
      tags: ["Users"],
    }
  )
  // DELETE /api/v2/users/:id → hapus (admin; bukan akun sendiri)
  .delete("/:id", async ({ headers, set, params }) => {
    try {
      const actor = await requireAuth(headers, ["admin"]);
      return await deleteUser(Number(params.id), actor.id);
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  });
