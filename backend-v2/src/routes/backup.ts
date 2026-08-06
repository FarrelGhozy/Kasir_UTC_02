// Route backup/restore v2 — C2 fix (anti data-loss) + #95 (RBAC: admin only)
import { Elysia, t } from "elysia";
import { createBackup, restoreBackup, backupSummary } from "../services/backupService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";
import { checkRateLimit } from "../middleware/security";

export const backupRouter = new Elysia({ prefix: "/api/v2/backup" })
  // GET /api/v2/backup → unduh backup JSON (dengan checksum) — ADMIN ONLY
  .get("/", async ({ headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      const { json, sha256 } = await createBackup();
      set.headers["Content-Type"] = "application/json";
      set.headers["Content-Disposition"] = `attachment; filename="utc-backup-${new Date().toISOString().slice(0, 10)}.json"`;
      set.headers["X-Backup-Sha256"] = sha256;
      return json;
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // GET /api/v2/backup/summary → ringkasan isi backup — ADMIN ONLY
  .get("/summary", async ({ headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      const { json } = await createBackup();
      return { success: true, tables: backupSummary(json) };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })
  // POST /api/v2/backup/restore → restore AMAN (validasi dulu, lalu transaksi) — ADMIN ONLY
  .post(
    "/restore",
    async ({ body, headers, set, request }) => {
      try {
        await requireAuth(headers, ["admin"]);
        // #113: restore = operasi destruktif — rate limit per-IP
        const rl = checkRateLimit(request, "backup-restore");
        if (!rl.allowed) {
          set.status = 429;
          return { success: false, error: `Terlalu banyak permintaan — coba lagi dalam ${rl.retryAfterSec} detik` };
        }
        const { restoredRows } = await restoreBackup(body.backup);
        return { success: true, restoredRows };
      } catch (e) {
        const r = mapError(e);
        set.status = r.status;
        return { success: false, error: r.body.error };
      }
    },
    {
      body: t.Object({ backup: t.String() }),
      tags: ["Backup"],
    }
  );