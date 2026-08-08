// QA helper: buat user test untuk verifikasi #95 RBAC (tidak menyentuh admin asli)
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASS = "qa-rbac-pass-2026!";

async function upsert(username: string, role: "admin" | "kasir" | "teknisi") {
  const hash = await bcrypt.hash(PASS, 10);
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash: hash, role, isActive: true },
    create: { name: `QA ${role}`, username, passwordHash: hash, role },
  });
  console.log("OK", username, role);
}

await upsert("qa_admin", "admin");
await upsert("qa_kasir", "kasir");
await upsert("qa_teknisi", "teknisi");
await prisma.$disconnect();
