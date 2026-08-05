// Route backup/restore v2 — C2 fix (anti data-loss) + #95 (RBAC: admin only)
// #107: + manajemen file backup server-side (simpan/daftar/unduh/restore/hapus).
import { Elysia, t } from "elysia";
import {
  createBackup,
  restoreBackup,
  backupSummary,
  saveBackupToFile,
  listBackupFiles,
  getBackupFilePath,
  restoreFromFile,
  deleteBackupFile,
} from "../services/backupService";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";

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
    async ({ body, headers, set }) => {
      try {
        await requireAuth(headers, ["admin"]);
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
  )
  // ── #107: manajemen file backup server ────────────────────────────────────
  // POST /api/v2/backup/save → simpan backup sekarang ke file — ADMIN ONLY
  .post("/save", async ({ headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      const file = await saveBackupToFile();
      return { success: true, file };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Backup"] })
  // GET /api/v2/backup/files → daftar file backup server — ADMIN ONLY
  .get("/files", async ({ headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      return { success: true, files: listBackupFiles() };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Backup"] })
  // GET /api/v2/backup/files/:name → unduh file backup tersimpan — ADMIN ONLY
  .get("/files/:name", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      const p = getBackupFilePath(params.name);
      if (!p) {
        set.status = 404;
        return { success: false, error: "File backup tidak ditemukan" };
      }
      const { readFileSync } = await import("node:fs");
      const buf = readFileSync(p);
      set.headers["Content-Type"] = "application/gzip";
      set.headers["Content-Disposition"] = `attachment; filename="${params.name}"`;
      return buf;
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Backup"] })
  // POST /api/v2/backup/restore/:name → restore dari file tersimpan — ADMIN ONLY
  .post("/restore/:name", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      const { restoredRows } = await restoreFromFile(params.name);
      return { success: true, restoredRows };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Backup"] })
  // DELETE /api/v2/backup/files/:name → hapus file backup — ADMIN ONLY
  .delete("/files/:name", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers, ["admin"]);
      deleteBackupFile(params.name);
      return { success: true, deleted: params.name };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  }, { tags: ["Backup"] });