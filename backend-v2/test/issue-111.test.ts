// Test #111 — Endpoint workload teknisi.
// getTechnicianWorkload: teknisi tak ada → throw [BIZ]; hitung aktif/selesai/total/revenue
// per status FSM v2; tiket tanpa teknisi tidak ikut; Cancelled tidak dihitung.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { prisma } from "../src/db";
import { getTechnicianWorkload } from "../src/services/serviceService";

const createdIds: number[] = [];
const createdUsers: number[] = [];

// Teknisi dibuat sendiri (id dinamis). Di awal DB (fresh/dev) tidak ada
// jaminan id = 6 — setelah #86 migrasi, urutan user berubah total.
let techId = 0;

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
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: {
        name: "QA Teknisi #111",
        username: `qa_teknisi_111_${Date.now()}`,
        passwordHash: "-",
        role: "teknisi",
      },
    });
    techId = u.id;
    createdUsers.push(u.id);
  });

  afterAll(async () => {
    await prisma.serviceTicket.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.$disconnect();
  });

  test("teknisi tidak ditemukan → throw [BIZ]", async () => {
    await expect(getTechnicianWorkload(999_999)).rejects.toThrow(/tidak ditemukan/);
  });

  test("hitung aktif/selesai/total/revenue dari beberapa status", async () => {
    await mk("WL-UNIT-1", techId, "Queue", 100000);
    await mk("WL-UNIT-2", techId, "In_Progress", 150000);
    await mk("WL-UNIT-3", techId, "Completed", 75000);
    await mk("WL-UNIT-4", techId, "Cancelled", 50000); // tidak dihitung

    const wl = await getTechnicianWorkload(techId);
    expect(wl.active).toBe(2);
    expect(wl.completed).toBe(1);
    expect(wl.total).toBe(3);
    expect(wl.byStatus).toMatchObject({ Queue: 1, In_Progress: 1, Completed: 1 });
    expect(wl.byStatus.Cancelled).toBeUndefined();
    expect(wl.estimatedRevenue).toBe(325000);
    expect(wl.technicianName).toBeTruthy();
  });

  test("tiket tanpa teknisi tidak ikut dihitung", async () => {
    const before = await getTechnicianWorkload(techId);
    await mk("WL-UNIT-5", null, "In_Progress", 90000);
    const after = await getTechnicianWorkload(techId);
    expect(after.total).toBe(before.total);
  });
});
