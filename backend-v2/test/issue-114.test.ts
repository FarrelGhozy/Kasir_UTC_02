// Test #114 — Pattern lock 9-titik perangkat.
// 1) validatePatternLock: tolak invalid (<4 titik, duplikat, digit 0/non-digit), terima valid, opsional.
// 2) sanitizeDevice: sisipkan patternLock valid; invalid → throw; kosong → field dihapus.
// 3) createServiceTicket: pola tersimpan di device.patternLock & terbaca kembali.
import { describe, expect, test, afterAll } from "bun:test";
import { prisma } from "../src/db";
import { validatePatternLock, sanitizeDevice, createServiceTicket } from "../src/services/serviceService";

const createdIds: number[] = [];
let createdCustomerIds: number[] = [];

describe("validatePatternLock #114", () => {
  test("kosong/undefined → undefined (opsional)", () => {
    expect(validatePatternLock(undefined)).toBeUndefined();
    expect(validatePatternLock(null)).toBeUndefined();
    expect(validatePatternLock("")).toBeUndefined();
  });

  test("pola valid 4–9 titik → string sama", () => {
    expect(validatePatternLock("1-3-5-7-9")).toBe("1-3-5-7-9");
    expect(validatePatternLock("1-2-3-4")).toBe("1-2-3-4");
    expect(validatePatternLock("1-2-3-4-5-6-7-8-9")).toBe("1-2-3-4-5-6-7-8-9");
  });

  test("pola < 4 titik → throw [BIZ]", () => {
    expect(() => validatePatternLock("1-2-3")).toThrow(/Pola kunci tidak valid/);
    expect(() => validatePatternLock("1-2")).toThrow(/Pola kunci tidak valid/);
  });

  test("titik duplikat → throw", () => {
    expect(() => validatePatternLock("1-1-2-3")).toThrow(/tidak boleh berulang/);
    expect(() => validatePatternLock("5-2-5-1")).toThrow(/tidak boleh berulang/);
  });

  test("bukan angka / di luar 1-9 / bukan string → throw", () => {
    expect(() => validatePatternLock("1-2-3-0")).toThrow(/Pola kunci tidak valid/);
    expect(() => validatePatternLock("1-2-3-10")).toThrow(/Pola kunci tidak valid/);
    expect(() => validatePatternLock("a-b-c-d")).toThrow(/Pola kunci tidak valid/);
    expect(() => validatePatternLock(1234 as unknown)).toThrow(/Pola kunci tidak valid/);
    expect(() => validatePatternLock("1,2,3,4")).toThrow(/Pola kunci tidak valid/);
  });

  test("sanitizeDevice: sisipkan patternLock, pertahankan field lain", () => {
    const d = sanitizeDevice({ brand: "Samsung", issue: "LCD", patternLock: "2-4-6-8" });
    expect((d as Record<string, unknown>).brand).toBe("Samsung");
    expect((d as Record<string, unknown>).patternLock).toBe("2-4-6-8");
    // pola invalid → throw
    expect(() => sanitizeDevice({ brand: "X", patternLock: "1-1-2-3" })).toThrow();
  });
});

describe("createServiceTicket dgn pattern lock #114", () => {
  afterAll(async () => {
    if (createdIds.length) {
      await prisma.serviceLog.deleteMany({ where: { serviceTicketId: { in: createdIds } } });
      await prisma.serviceTicket.deleteMany({ where: { id: { in: createdIds } } });
    }
    if (createdCustomerIds.length) {
      await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
    }
    await prisma.$disconnect();
  });

  test("pola tersimpan di device.patternLock & terbaca kembali", async () => {
    const t = await createServiceTicket({
      customerName: `PL Test ${Date.now()}`,
      device: { brand: "Samsung", model: "A54", issue: "LCD", patternLock: "1-3-5-7-9" },
    });
    createdIds.push(t.id);
    if (t.customerId) createdCustomerIds.push(t.customerId);
    expect((t.device as Record<string, unknown>).patternLock).toBe("1-3-5-7-9");
    expect((t.device as Record<string, unknown>).brand).toBe("Samsung");

    const back = await prisma.serviceTicket.findUnique({ where: { id: t.id } });
    expect((back!.device as Record<string, unknown>).patternLock).toBe("1-3-5-7-9");
  });

  test("tanpa pola → device.patternLock undefined (opsional)", async () => {
    const t = await createServiceTicket({
      customerName: `PL NoPattern ${Date.now()}`,
      device: { brand: "Oppo", issue: "Baterai" },
    });
    createdIds.push(t.id);
    if (t.customerId) createdCustomerIds.push(t.customerId);
    expect((t.device as Record<string, unknown>).patternLock).toBeUndefined();
  });

  test("pola invalid saat create → ditolak", async () => {
    await expect(
      createServiceTicket({ customerName: "PL Bad", device: { brand: "X", issue: "Y", patternLock: "1-2-3" } })
    ).rejects.toThrow(/Pola kunci tidak valid/);
  });
});
