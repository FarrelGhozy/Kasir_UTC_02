// Route backup/restore v2 — C2 fix (anti data-loss)
import { Elysia, t } from "elysia";
import { createBackup, restoreBackup, backupSummary } from "../services/backupService";

export const backupRouter = new Elysia({ prefix: "/api/v2/backup" })
  // GET /api/v2/backup → unduh backup JSON (dengan checksum)
  .get("/", async ({ set }) => {
    const { json, sha256 } = await createBackup();
    set.headers["Content-Type"] = "application/json";
    set.headers["Content-Disposition"] = `attachment; filename="utc-backup-${new Date().toISOString().slice(0, 10)}.json"`;
    set.headers["X-Backup-Sha256"] = sha256;
    return json;
  })
  // GET /api/v2/backup/summary → ringkasan isi backup (tanpa restore)
  .get("/summary", async () => {
    const { json } = await createBackup();
    return { success: true, tables: backupSummary(json) };
  })
  // POST /api/v2/backup/restore → restore AMAN (validasi dulu, lalu transaksi)
  .post(
    "/restore",
    async ({ body, set }) => {
      try {
        const { restoredRows } = await restoreBackup(body.backup);
        return { success: true, restoredRows };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gagal restore";
        // error validasi = client error; error DB = server error
        const isValidation = msg.includes("korup") || msg.includes("tidak dikenal");
        set.status = isValidation ? 400 : 500;
        return { success: false, error: msg };
      }
    },
    {
      body: t.Object({ backup: t.String() }),
    }
  );