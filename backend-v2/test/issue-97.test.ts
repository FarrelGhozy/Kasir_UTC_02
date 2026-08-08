// Unit test #97 — Inventory & Service Ticket (gap endpoint v1->v2)
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import {
  createItem, adjustStock, inventorySummary,
} from "../src/services/inventoryService";
import {
  createServiceTicket, getServiceTicket, addServicePart, removeServicePart, setServiceFee,
  assertServiceTransition, transitionServiceStatus,
} from "../src/services/serviceService";

const prisma = new PrismaClient();

let itemId = 0;
let ticketId = 0;

beforeAll(async () => {
  const it = await createItem({ sku: "QA-97-0201", name: "Part Test 97", sellingPrice: 100000, purchasePrice: 50000, stock: 10 });
  itemId = it.id;
});

afterAll(async () => {
  if (ticketId) {
    await prisma.serviceTicketPart.deleteMany({ where: { serviceTicketId: ticketId } });
    await prisma.serviceLog.deleteMany({ where: { serviceTicketId: ticketId } });
    await prisma.serviceTicket.deleteMany({ where: { id: ticketId } });
  }
  await prisma.stockAudit.deleteMany({ where: { itemId } });
  await prisma.item.delete({ where: { id: itemId } });
  await prisma.$disconnect();
});

describe("97 inventory", () => {
  test("adjust stock +5 -> stock 15", async () => {
    const upd = await adjustStock({ itemId, delta: 5, reason: "OPNAME" });
    expect(upd.stock).toBe(15);
  });

  test("adjust negative beyond stock ditolak", async () => {
    await expect(
      adjustStock({ itemId, delta: -999, reason: "X9" })
    ).rejects.toThrow();
  });

  test("summary menghitung stock & low", async () => {
    const s = await inventorySummary();
    expect(s.totalItems).toBeGreaterThan(0);
    expect(typeof s.totalValue).toBe("number");
  });
});

describe("97 service ticket FSM", () => {
  test("assertServiceTransition valid & invalid", () => {
    expect(() => assertServiceTransition("Queue", "Diagnosing")).not.toThrow();
    expect(() => assertServiceTransition("Queue", "Picked_Up")).toThrow();
  });

  test("create ticket + status rute valid", async () => {
    const t = await createServiceTicket({ customerName: "QA 97", serviceFee: 25000 });
    ticketId = t.id;
    const up = await transitionServiceStatus({ ticketId, to: "Diagnosing" });
    expect(up?.status).toBe("Diagnosing");
  });

  test("add part potong stok + totalCost otomatis", async () => {
    await addServicePart({ ticketId, itemId, qty: 2 });
    const fin = await getServiceTicket(ticketId);
    // serviceFee 25000 + 2 x sellingPrice 100000 = 225000
    expect(Number(fin.totalCost)).toBe(225000);
  });

  test("remove part kembalikan stok + totalCost turun", async () => {
    const parts = await prisma.serviceTicketPart.findMany({ where: { serviceTicketId: ticketId } });
    const partId = parts[0]!.id;
    await removeServicePart({ ticketId, partId });
    const fin = await getServiceTicket(ticketId);
    // hapus 1 baris part (subtotal 200000) -> sisa fee 25000
    expect(Number(fin.totalCost)).toBe(25000);
  });

  test("setServiceFee recompute total", async () => {
    await setServiceFee({ ticketId, fee: 50000 });
    const fin = await getServiceTicket(ticketId);
    expect(Number(fin.totalCost)).toBe(50000);
  });
});