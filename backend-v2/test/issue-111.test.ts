// Test #111 — Endpoint workload teknisi.
// getTechnicianWorkload: teknisi tak ada → throw [BIZ]; hitung aktif/selesai/total/revenue
// per status FSM v2; tiket tanpa teknisi tidak ikut; Cancelled tidak dihitung.
import { describe, expect, test, afterAll } from "bun:test";
import { prisma } from "../src/db";
import { getTechnicianWorkload } from "../src/services/serviceService";

const createdIds: number[] = [];

async function mk(ticketNumber: string, technicianId: number | null, status: string, serviceFee?: number) {
  const t = await prisma.serviceTicket.create({
    data: {
      ticketNumber,
      device: { brand: "Tes", type: "WL" },
      technicianId,
      status: status as any,
      serviceFee: serviceFee ?? 0,
    },
  });
  createdIds.push(t.id);
  return t;
}

describe("Workload teknisi #111", () => {
  afterAll(async () => {
    await prisma.serviceTicket.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  test("teknisi tidak ditemukan → throw [BIZ]", async () => {
    await expect(getTechnicianWorkload(999_999)).rejects.toThrow(/tidak ditemukan/);
  });

  test("hitung aktif/selesai/total/revenue dari beberapa status", async () => {
    await mk("WL-UNIT-1", 6, "Queue", 100000);
    await mk("WL-UNIT-2", 6, "In_Progress", 150000);
    await mk("WL-UNIT-3", 6, "Completed", 75000);
    await mk("WL-UNIT-4", 6, "Cancelled", 50000); // tidak dihitung

    const wl = await getTechnicianWorkload(6);
    expect(wl.active).toBe(2);
    expect(wl.completed).toBe(1);
    expect(wl.total).toBe(3);
    expect(wl.byStatus).toMatchObject({ Queue: 1, In_Progress: 1, Completed: 1 });
    expect(wl.byStatus.Cancelled).toBeUndefined();
    expect(wl.estimatedRevenue).toBe(325000);
    expect(wl.technicianName).toBeTruthy();
  });

  test("tiket tanpa teknisi tidak ikut dihitung", async () => {
    const before = await getTechnicianWorkload(6);
    await mk("WL-UNIT-5", null, "In_Progress", 90000);
    const after = await getTechnicianWorkload(6);
    expect(after.total).toBe(before.total);
  });
});
