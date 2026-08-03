import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { config, assertSecureConfig } from "./config/env";
import { authRouter } from "./routes/auth";
import { transactionRouter } from "./routes/transactions";
import { backupRouter } from "./routes/backup";
import { orderRouter, warrantyRouter, reportRouter } from "./routes/orders";
import { SECURITY_HEADERS } from "./middleware/security";
import { mapError } from "./middleware/error";

// SEC-1: validasi config wajib sebelum server jalan
assertSecureConfig();

const app = new Elysia()
  .onAfterHandle(({ set }) => {
    // M6: Security headers global
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) set.headers[k] = v;
  })
  .use(
    cors({
      origin: config.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    })
  )
  .use(
    // Swagger hanya di development — jangan expose schema API ke production
    config.NODE_ENV === "production"
      ? new Elysia()
      : swagger({
          path: "/docs",
          documentation: {
            info: { title: "Kasir UTC v2 API", version: "2.0.0" },
            tags: [{ name: "Health" }, { name: "Auth" }],
          },
        })
  )
  .onError(({ code, error, set, request }) => {
    // #99: satu sumber error (mapError). VALIDATION/NOT_FOUND dari Elysia langsung di-map.
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validasi gagal", message: error?.message };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not Found" };
    }
    const r = mapError(error);
    set.status = r.status;
    return r.body;
  })
  .get("/health", () => ({
    status: "ok",
    service: "kasir-utc-v2-backend",
    time: new Date().toISOString(),
  }))
  // Alias untuk konsistensi via Vite proxy (/api → 5300)
  .get("/api/health", ({ set }) => {
    return { status: "ok", service: "kasir-utc-v2-backend" };
  })
  .use(authRouter)
  .use(transactionRouter)
  .use(backupRouter)
  .use(orderRouter)
  .use(warrantyRouter)
  .use(reportRouter)
  .listen(config.PORT);

console.log(
  `\n🟢 Kasir UTC v2 backend jalan di http://localhost:${config.PORT}\n` +
    `   Swagger : http://localhost:${config.PORT}/docs\n` +
    `   Env     : ${config.NODE_ENV}\n`
);

export type App = typeof app;
