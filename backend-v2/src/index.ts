import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { PrismaClient } from "@prisma/client";
import { config, assertSecureConfig } from "./config/env";
import { authRouter } from "./routes/auth";
import { transactionRouter } from "./routes/transactions";
import { backupRouter } from "./routes/backup";
import { SECURITY_HEADERS } from "./middleware/security";
import { prisma } from "./db";

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
    const err = error as Error;
    const isProd = config.NODE_ENV === "production";
    console.error(
      `[${new Date().toISOString()}] [ERROR:${code}] ${request?.method} ${request?.url}`,
      err?.message
    );
    if (!isProd && err?.stack) console.error(err.stack);
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validasi gagal", message: err?.message };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not Found" };
    }
    set.status = 500;
    return {
      error: "Internal Server Error",
      message: isProd ? "Terjadi kesalahan pada server. Silakan coba lagi." : err?.message,
    };
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
  .listen(config.PORT);

console.log(
  `\n🟢 Kasir UTC v2 backend jalan di http://localhost:${config.PORT}\n` +
    `   Swagger : http://localhost:${config.PORT}/docs\n` +
    `   Env     : ${config.NODE_ENV}\n`
);

export type App = typeof app;