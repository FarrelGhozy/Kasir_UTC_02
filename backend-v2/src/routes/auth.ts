import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { config } from "../config/env";
import { prisma } from "../index";
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
    async ({ body, jwt, set }) => {
      const { username, password } = body;
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
  .get("/me", async ({ jwt, headers }) => {
    const auth = headers.authorization || "";
    const token = auth.replace("Bearer ", "");
    const payload = await jwt.verify(token);
    if (!payload) return { error: "Unauthorized" };
    return { sub: payload.sub, role: payload.role, name: payload.name };
  });