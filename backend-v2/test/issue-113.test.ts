// Test #113 — Security config: validasi env, rate limit admin ops, audit file.
// 1) validateJwtSecret: tolak kosong/pendek/placeholder, terima secret kuat.
// 2) checkRateLimit: kunci setelah melewati limit per-IP (namespace terpisah).
// 3) Audit file: docker-compose.v2.yml & .env.example bebas hardcoded secret.
import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateJwtSecret, config } from "../src/config/env";
import { checkRateLimit, checkLoginRateLimit } from "../src/middleware/security";

const STRONG = "a".repeat(64); // 64 char, bukan placeholder

describe("validasi env #113", () => {
  test("JWT_SECRET kosong → throw [SEC-1]", () => {
    expect(() => validateJwtSecret("")).toThrow(/\[SEC-1\]/);
  });

  test("JWT_SECRET < 32 char → throw", () => {
    expect(() => validateJwtSecret("short-secret")).toThrow(/\[SEC-1\]/);
  });

  test("JWT_SECRET placeholder → throw (change_this_in_production)", () => {
    expect(() => validateJwtSecret("change_this_in_production_abcdefghijklmnopq")).toThrow(/placeholder/);
    expect(() => validateJwtSecret(`secret-${"x".repeat(56)}`)).toThrow(/placeholder/);
  });

  test("JWT_SECRET kuat (64 char acak) → lolos tanpa throw", () => {
    expect(() => validateJwtSecret(STRONG)).not.toThrow();
  });

  test("CORS default bukan wildcard — origin eksplisit localhost:8090", () => {
    expect(config.CORS_ORIGIN).not.toBe("*");
    expect(config.CORS_ORIGIN).toContain("localhost");
  });
});

describe("rate limit admin ops #113", () => {
  const mkReq = (ip: string) => new Request("http://localhost", { headers: { "x-real-ip": ip } });

  test("limit kecil (max=3): ke-4 ditolak + retryAfterSec > 0, namespace sama", () => {
    const req = mkReq("10.0.0.113");
    for (let i = 1; i <= 3; i++) {
      const r = checkRateLimit(req, "audit-test", 3);
      expect(r.allowed).toBe(true);
    }
    const blocked = checkRateLimit(req, "audit-test", 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  test("namespace berbeda → bucket terpisah (tidak saling blok)", () => {
    const req = mkReq("10.0.0.113");
    expect(checkRateLimit(req, "ns-a", 2).allowed).toBe(true);
    expect(checkRateLimit(req, "ns-a", 2).allowed).toBe(true);
    expect(checkRateLimit(req, "ns-a", 2).allowed).toBe(false); // ns-a penuh
    expect(checkRateLimit(req, "ns-b", 2).allowed).toBe(true); // ns-b masih kosong
  });

  test("IP berbeda → tidak terblok oleh IP lain", () => {
    const a = mkReq("10.0.0.201");
    const b = mkReq("10.0.0.202");
    checkRateLimit(a, "ip-test", 1);
    expect(checkRateLimit(a, "ip-test", 1).allowed).toBe(false);
    expect(checkRateLimit(b, "ip-test", 1).allowed).toBe(true);
  });

  test("checkLoginRateLimit: lockout per IP+username", () => {
    const req = mkReq("10.0.0.250");
    // MAX_REQUESTS default = 20 (RATE_LIMIT_MAX); lewati 21x agar pasti kena limit
    for (let i = 0; i < 21; i++) checkLoginRateLimit(req, "user-a");
    const r = checkLoginRateLimit(req, "user-a");
    expect(r.allowed).toBe(false);
    // username berbeda pada IP sama → bucket berbeda
    expect(checkLoginRateLimit(req, "user-b").allowed).toBe(true);
  });
});

describe("audit file #113 — bebas hardcoded secret", () => {
  const composePath = resolve(import.meta.dir, "../../docker-compose.v2.yml");
  const envExPath = resolve(import.meta.dir, "../.env.example");

  test("file yang diaudit ada", () => {
    expect(existsSync(composePath)).toBe(true);
    expect(existsSync(envExPath)).toBe(true);
  });

  test("docker-compose.v2.yml: tidak ada secret hardcoded; password via env interpolation", () => {
    const c = readFileSync(composePath, "utf8");
    // pola secret dari audit main tidak boleh muncul
    expect(c).not.toMatch(/adminutc28/i);
    expect(c).not.toMatch(/change_this_in_production/i);
    // POSTGRES_PASSWORD wajib via ${...} (bukan literal)
    expect(c).toMatch(/POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:?/);
    // DATABASE_URL tidak boleh memuat password literal (harus ${VAR} atau ***)
    expect(c).toMatch(/DATABASE_URL: postgresql:\/\/utc:\$\{POSTGRES_PASSWORD\}@/);
  });

  test(".env.example: secret placeholder kosong + instruksi generate", () => {
    const e = readFileSync(envExPath, "utf8");
    expect(e).toMatch(/JWT_SECRET=""/);
    expect(e).toMatch(/openssl rand -hex 32/);
    expect(e).toMatch(/SEED_ADMIN_PASSWORD=""/);
    expect(e).not.toMatch(/adminutc28/i);
  });
});
