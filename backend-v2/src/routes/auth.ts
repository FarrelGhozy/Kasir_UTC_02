import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../config/env";
import { prisma } from "../index";
import { checkLoginRateLimit } from "../middleware/security";
import * as bcrypt from "bcryptjs";

export const authRouter = new Elysia({ prefix: "/api/v2/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: config.JWT_SECRET,
      exp: config.JWT_EXPIRES_IN,
    })
  )
  .post(
    "/login",
    async ({ body, jwt, set, request }) => {
      const { username, password } = body;

      // SEC-6: rate limit per IP+username — cek SEBELUM bcrypt (hemat CPU & blokir brute)
      const rl = checkLoginRateLimit(request, username);
      if (!rl.allowed) {
        set.status = 429;
        set.headers["Retry-After"] = String(rl.retryAfterSec);
        return {
          error: "Terlalu banyak percobaan login. Coba lagi nanti.",
          retryAfterSec: rl.retryAfterSec,
        };
      }

      const user = await prisma.user.findUnique({
        where: { username },
      });
      if (!user || !user.isActive) {
        set.status = 401;
        return { error: "Kredensial salah" };
      }
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        set.status = 401;
        return { error: "Kredensial salah" };
      }

      const token = await jwt.sign({
        sub: String(user.id),
        role: user.role,
        name: user.name,
      });
      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        },
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
      tags: ["Auth"],
    }
  )
  .get("/me", async ({ jwt, headers, set }) => {
    const auth = headers.authorization || "";
    const token = auth.replace("Bearer ", "");
    const payload = await jwt.verify(token);
    if (!payload) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    // SEC-5: verifikasi user ke DB tiap request — nonaktif/demote langsung ditolak
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    return user;
  });