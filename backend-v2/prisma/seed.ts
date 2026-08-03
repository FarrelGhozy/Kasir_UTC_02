// Seed pengguna awal untuk dev (JANGAN untuk produksi)
// Jalankan: bun run prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("Admin@utc2026", 12);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Administrator",
      username: "admin",
      passwordHash: hash,
      role: "admin",
      isActive: true,
    },
  });
  console.log("✅ Seeded admin user:", admin.username, `(id=${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());