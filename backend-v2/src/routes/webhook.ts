// Route webhook WAHA v2 — #102: terima event masuk dari WAHA (NOWEB engine).
// Divalidasi header X-Api-Key (secret dari env config). Event disimpan ringan
// (tanpa model baru — console + response OK), karena v1 hanya butuh jejak "message".
import { Elysia } from "elysia";
import { config } from "../config/env";
import { mapError } from "../middleware/error";

export const webhookRouter = new Elysia()
  // POST /api/v2/waha-webhook — event dari WAHA (message dll.)
  .post("/api/v2/waha-webhook", async ({ headers, body, set }) => {
    try {
      const key = (headers as Record<string, string | undefined>)["x-api-key"];
      if (!config.WAHA_API_KEY || key !== config.WAHA_API_KEY) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }
      const event = (body as any)?.event ?? "message";
      // Jejak ringan — WAHA NOWEB kirim event; tidak ada aksi bisnis otomatis di v2
      console.log(`[WAHA-webhook] event=${event} payload_keys=${Object.keys((body as any) ?? {}).join(",")}`);
      return { success: true, received: true };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  });