// User management service v2 — #92/#95: kelola pengguna & teknisi (RBAC admin).
// Konvensi v2: biz(), select tanpa password_hash (IRT), bcrypt utk hash.
import { prisma } from "../db";
import * as bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

function biz(msg: string, status = 400): Error {
  const e = new Error(`[BIZ] ${msg}`) as Error & { status: number };
  e.status = status;
  return e;
}

const ROLES: Role[] = ["admin", "kasir", "teknisi"];

/** Select aman — tidak pernah bocorkan password_hash. */
export const safeUserSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  phone: true,
  isActive: true,
  jabatan: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function parseRole(raw?: string): Role {
  if (!raw) throw biz("Role wajib diisi");
  const r = raw.trim().toLowerCase() as Role;
  if (!ROLES.includes(r)) throw biz("Role tidak valid. Gunakan: admin, kasir, teknisi");
  return r;
}

export function parseBool(raw?: unknown, fallback?: boolean): boolean | undefined {
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  throw biz("Nilai boolean tidak valid");
}

export async function listUsers(q?: string) {
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
          { jabatan: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const rows = await prisma.user.findMany({
    where,
    select: safeUserSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return { rows, total: rows.length };
}

export async function createUser(input: {
  name: string;
  username: string;
  password: string;
  role?: string;
  phone?: string;
  jabatan?: string;
  isActive?: unknown;
}) {
  if (!input.name?.trim()) throw biz("Nama wajib diisi");
  if (!input.username?.trim()) throw biz("Username wajib diisi");
  if (!input.password || input.password.length < 6) throw biz("Password minimal 6 karakter");
  const exists = await prisma.user.findUnique({ where: { username: input.username.trim() } });
  if (exists) throw biz("Username sudah dipakai", 409);
  const hash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: {
      name: input.name.trim(),
      username: input.username.trim(),
      passwordHash: hash,
      role: parseRole(input.role),
      phone: input.phone ?? "",
      jabatan: input.jabatan ?? null,
      isActive: parseBool(input.isActive, true) ?? true,
    },
    select: safeUserSelect,
  });
}

export async function updateUser(
  id: number,
  input: { name?: string; role?: string; phone?: string; jabatan?: string; isActive?: unknown }
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw biz("User tidak ditemukan", 404);
  const active = parseBool(input.isActive);
  return prisma.user.update({
    where: { id },
    data: {
      name: input.name?.trim() || undefined,
      role: input.role ? parseRole(input.role) : undefined,
      phone: input.phone !== undefined ? input.phone : undefined,
      jabatan: input.jabatan !== undefined ? input.jabatan || null : undefined,
      isActive: active,
    },
    select: safeUserSelect,
  });
}

export async function resetPassword(id: number, newPassword: string) {
  if (!newPassword || newPassword.length < 6) throw biz("Password minimal 6 karakter");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw biz("User tidak ditemukan", 404);
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
  return { success: true, message: "Password berhasil di-reset" };
}

export async function deleteUser(id: number, actorId: number) {
  if (id === actorId) throw biz("Tidak bisa menghapus akun sendiri", 400);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw biz("User tidak ditemukan", 404);
  await prisma.user.delete({ where: { id } });
  return { success: true, message: "User dihapus" };
}