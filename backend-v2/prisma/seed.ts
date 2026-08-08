// Seed pengguna awal untuk dev (JANGAN untuk produksi)
// Jalankan: bun run prisma/seed.ts
// M1 fix: password diambil dari env, TIDAK hardcoded di repo.
//   SEED_ADMIN_PASSWORD wajib di-set; kalau tidak ada, seed menolak jalan (bukan fallback diam-diam).
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    console.error(
      "[M1] SEED_ADMIN_PASSWORD wajib di-set (>= 12 char) — jangan pakai password lemah."
    );
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: hash },
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
