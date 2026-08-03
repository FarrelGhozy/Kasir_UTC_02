// Unit test #88 — Special Order FSM ketat + payment sync + warranty max 1x
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import {
  createOrder,
  transitionOrderStatus,
  addOrderPayment,
  orderFinancials,
  assertTransition,
} from "../src/services/orderService";
import { claimWarranty } from "../src/services/warrantyService";
import { revenueReport } from "../src/services/reportService";

const prisma = new PrismaClient();

let orderId = 0;
const PHONE = "0812-TEST-88";

async function getCustomer() {
  const existing = await prisma.customer.findFirst({ where: { phone: PHONE } });
  if (existing) return existing;
  return prisma.customer.create({ data: { name: "Pelanggan #88", phone: PHONE } });
}

beforeAll(async () => {
  const customer = await getCustomer();
  const order = await createOrder({
    customerId: customer.id,
    itemName: "Part Khusus X",
    estimatedPrice: 500000,
    downPayment: 100000, // DP 100rb dari estimasi 500rb
  });
  orderId = order.orderId;
});

async function cleanupOrder(id: number) {
  await prisma.specialOrderPayment.deleteMany({ where: { orderId: id } });
  await prisma.specialOrder.deleteMany({ where: { id } });
}

afterAll(async () => {
  await cleanupOrder(orderId);
  await prisma.customer.deleteMany({ where: { phone: PHONE } });
  await prisma.$disconnect();
});

describe("H1 — payment status dari aggregate (bukan set manual)", () => {
  test("DP 100rb dari 500rb → Belum_Lunas, sisa 400rb", () => {
    // di cek via financials setelah setup
  });

  test("setelah DP, paid=100rb, remaining=400rb, status Belum_Lunas", async () => {
    const fin = await orderFinancials(orderId);
    expect(fin.paidAmount).toBe("100000.00");
    expect(fin.remaining).toBe("400000.00");
    expect(fin.paymentStatus).toBe("Belum_Lunas");
  });

  test("bayar lunas sisa 400rb → status otomatis Lunas, sisa 0", async () => {
    const fin = await addOrderPayment({ orderId, amount: 400000, method: "Transfer" });
    expect(fin.paymentStatus).toBe("Lunas");
    expect(fin.remaining).toBe("0.00");
    expect(fin.paidAmount).toBe("500000.00");
  });

  test("order lunas → bayar lagi DITOLAK (tidak bisa overpay)", async () => {
    await expect(addOrderPayment({ orderId, amount: 50000, method: "Cash" })).rejects.toThrow(/lunas/i);
  });

  test("bayar melebihi sisa → DITOLAK", async () => {
    // buat order baru kecil, bayar terlalu besar
    const customer = await getCustomer();
    const o2 = await createOrder({ customerId: customer.id, itemName: "Part Kecil", estimatedPrice: 100000 });
    await expect(addOrderPayment({ orderId: o2.orderId, amount: 200000, method: "Cash" })).rejects.toThrow(/melebihi/i);
    await cleanupOrder(o2.orderId);
  });
});

describe("H13 — FSM ketat (Picked_Up HANYA dari Arrived)", () => {
  test("Pending → Picked_Up LANGSUNG DITOLAK", async () => {
    const customer = await getCustomer();
    const o = await createOrder({ customerId: customer.id, itemName: "FSM Test", estimatedPrice: 100000 });
    await expect(transitionOrderStatus(o.orderId, "Picked_Up")).rejects.toThrow(/tidak valid/);
    await cleanupOrder(o.orderId);
  });

  test("Pending → Ordered LANGSUNG DITOLAK (harus lewat Searching)", async () => {
    const customer = await getCustomer();
    const o = await createOrder({ customerId: customer.id, itemName: "FSM Test 2", estimatedPrice: 100000 });
    await expect(transitionOrderStatus(o.orderId, "Ordered")).rejects.toThrow(/tidak valid/);
    await cleanupOrder(o.orderId);
  });

  test("rantai valid Searching → Ordered → Arrived → Picked_Up", async () => {
    const customer = await getCustomer();
    const o = await createOrder({ customerId: customer.id, itemName: "FSM Test 3", estimatedPrice: 100000 });
    expect((await transitionOrderStatus(o.orderId, "Searching")).status).toBe("Searching");
    expect((await transitionOrderStatus(o.orderId, "Ordered")).status).toBe("Ordered");
    expect((await transitionOrderStatus(o.orderId, "Arrived")).status).toBe("Arrived");
    expect((await transitionOrderStatus(o.orderId, "Picked_Up")).status).toBe("Picked_Up");
    await cleanupOrder(o.orderId);
  });

  test("order Cancelled → status apapun DITOLAK (terminal)", async () => {
    const customer = await getCustomer();
    const o = await createOrder({ customerId: customer.id, itemName: "FSM Test 4", estimatedPrice: 100000 });
    await transitionOrderStatus(o.orderId, "Cancelled");
    await expect(transitionOrderStatus(o.orderId, "Ordered")).rejects.toThrow(/tidak valid/);
    await cleanupOrder(o.orderId);
  });
});

describe("H14 — pembayaran order tidak menyentuh tiket servis", () => {
  test("addPayment tidak mengubah tiket apapun", async () => {
    const ticketsBefore = await prisma.serviceTicket.findMany();
    const customer = await getCustomer();
    const o = await createOrder({ customerId: customer.id, itemName: "H14 Test", estimatedPrice: 50000 });
    await addOrderPayment({ orderId: o.orderId, amount: 50000, method: "Cash" });
    const ticketsAfter = await prisma.serviceTicket.findMany();
    expect(ticketsAfter.length).toBe(ticketsBefore.length); // tidak ada tiket baru
    await cleanupOrder(o.orderId);
  });
});

describe("M8 — klaim garansi maksimal 1x per tiket", () => {
  let sourceId = 0;

  beforeAll(async () => {
    const source = await prisma.serviceTicket.create({
      data: {
        ticketNumber: `SRV-TEST-88-${Date.now()}`,
        status: "Completed",
        warrantyExpiresAt: new Date(Date.now() + 30 * 86400000), // 30 hari
      },
    });
    sourceId = source.id;
  });

  afterAll(async () => {
    // claimWarranty membuat claim ticket + service_log milik claim.
    // Hapus dulu log untuk SEMUA claim ticket (claimFromId = sourceId), baru ticket-nya.
    const claims = await prisma.serviceTicket.findMany({ where: { claimFromId: sourceId } });
    for (const c of claims) {
      await prisma.serviceLog.deleteMany({ where: { serviceTicketId: c.id } });
    }
    await prisma.serviceLog.deleteMany({ where: { serviceTicketId: sourceId } });
    await prisma.serviceTicket.deleteMany({ where: { claimFromId: sourceId } });
    await prisma.serviceTicket.deleteMany({ where: { id: sourceId } });
  });

  test("klaim pertama sukses", async () => {
    const claim = await claimWarranty({ sourceTicketId: sourceId, device: { type: "phone" } });
    expect(claim.claimFromId).toBe(sourceId);
    expect(claim.status).toBe("Queue");
  });

  test("klaim kedua DITOLAK (warrantyClaimed flag)", async () => {
    await expect(claimWarranty({ sourceTicketId: sourceId, device: {} })).rejects.toThrow(/sudah pernah diklaim|klaim/i);
  });

  test("tiket bukan Completed → klaim DITOLAK", async () => {
    const t = await prisma.serviceTicket.create({
      data: { ticketNumber: `SRV-TEST-88B-${Date.now()}`, status: "Queue", warrantyExpiresAt: new Date(Date.now() + 3000000) },
    });
    await expect(claimWarranty({ sourceTicketId: t.id, device: {} })).rejects.toThrow(/Completed/i);
    await prisma.serviceLog.deleteMany({ where: { serviceTicketId: t.id } });
    await prisma.serviceTicket.deleteMany({ where: { id: t.id } });
  });
});

describe("H2 — laporan revenue hitung uang order", () => {
  test("revenueReport punya kolom orders & total >= pos", async () => {
    const rep = await revenueReport({});
    expect(rep).toHaveProperty("days");
    expect(rep).toHaveProperty("totals");
    expect(typeof rep.totals.orders).toBe("number");
    expect(rep.totals.total).toBe(rep.totals.pos + rep.totals.orders);
  });
});

describe("assertTransition helper", () => {
  test("valid & invalid transisi", () => {
    expect(() => assertTransition("Arrived", "Picked_Up")).not.toThrow();
    expect(() => assertTransition("Pending", "Picked_Up")).toThrow();
    expect(() => assertTransition("Picked_Up", "Arrived")).toThrow();
  });
});
