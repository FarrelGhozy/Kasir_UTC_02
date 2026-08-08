// Prisma client singleton — pisah dari index.ts biar service/test bisa
// import tanpa menyalakan server (EADDRINUSE di test).
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
