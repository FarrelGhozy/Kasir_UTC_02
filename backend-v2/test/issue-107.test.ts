// Test #107 — Backup file server-side.
// 1) saveBackupToFile → file .json.gz valid (bisa di-gunzip, JSON valid, versi 1).
// 2) listBackupFiles → berisi file yang baru disimpan; terurut terbaru dulu.
// 3) sanitizeBackupFilename → tolak path traversal, terima nama normal.
// 4) restoreFromFile → restore aman (transaksi) tanpa error.
// 5) cleanupOldBackups → safety-net: jangan hapus file terakhir.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import {
  saveBackupToFile,
  listBackupFiles,
  sanitizeBackupFilename,
  restoreFromFile,
  deleteBackupFile,
  cleanupOldBackups,
  getBackupFilePath,
} from "../src/services/backupService";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { BACKUP_DIR } from "../src/services/backupService";

let savedName = "";
let beforeCount = 0;

beforeAll(async () => {
  beforeCount = listBackupFiles().length;
  const f = await saveBackupToFile();
  savedName = f.name;
});

afterAll(async () => {
  // bersihkan file test yang dibuat (jangan sentuh file lain)
  if (savedName) {
    try {
      deleteBackupFile(savedName);
    } catch {
      // abaikan
    }
  }
});

describe("Backup file server-side #107", () => {
  test("saveBackupToFile → file .json.gz valid & bisa dibaca ulang", async () => {
    expect(savedName).toMatch(/^backup_\d{4}-\d{2}-\d{2}T[\d-]+\.json\.gz$/);
    const p = getBackupFilePath(savedName);
    expect(p).not.toBeNull();
    const raw = readFileSync(p!);
    expect(raw.length).toBeGreaterThan(0);
    const decompressed = Bun.gunzipSync(raw);
    const parsed = JSON.parse(Buffer.from(decompressed).toString("utf8"));
    expect(parsed.version).toBe(1);
    expect(parsed.tables).toBeTruthy();
    expect(Array.isArray(parsed.tables.users)).toBe(true);
  });

  test("listBackupFiles → memuat file baru, terurut terbaru", async () => {
    const files = listBackupFiles();
    expect(files.length).toBe(beforeCount + 1);
    expect(files[0]!.name).toBe(savedName);
    for (const f of files) {
      expect(typeof f.size).toBe("number");
      expect(f.sizeHuman).toBeTruthy();
      expect(typeof f.mtime).toBe("string");
    }
  });

  test("sanitizeBackupFilename → tolak path traversal", () => {
    expect(sanitizeBackupFilename("../../.env")).toBeNull();
    expect(sanitizeBackupFilename("..%2F..%2F.env")).toBeNull();
    expect(sanitizeBackupFilename("/etc/passwd")).toBeNull();
    expect(sanitizeBackupFilename("backup_2026-08-01.json.gz")).toBe("backup_2026-08-01.json.gz");
    expect(sanitizeBackupFilename("a b.json")).toBeNull(); // spasi ditolak
  });

  test("getBackupFilePath → null utk file ilegal/tidak ada", () => {
    expect(getBackupFilePath("../../.env")).toBeNull();
    expect(getBackupFilePath("tidak-ada.json.gz")).toBeNull();
  });

  test("restoreFromFile → restore aman tanpa error (data sama)", async () => {
    const res = await restoreFromFile(savedName);
    expect(res.restoredRows).toBeGreaterThan(0);
    // DB tetap sehat: ada user admin
    const { prisma } = await import("../src/db");
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    expect(adminCount).toBeGreaterThanOrEqual(1);
  });

  test("cleanupOldBackups → safety-net minimal 1 file", async () => {
    // simpan 1 file baru lagi → pasti ada >= 1 file
    const f2 = await saveBackupToFile();
    try {
      const res = cleanupOldBackups();
      expect(res.kept).toBeGreaterThanOrEqual(1);
      const files = listBackupFiles();
      expect(files.length).toBeGreaterThanOrEqual(1);
    } finally {
      deleteBackupFile(f2.name);
    }
  });
});
