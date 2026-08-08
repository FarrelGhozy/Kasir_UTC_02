// Test #103 — Email nota digital (Nodemailer).
// 1) customerEmail tersimpan saat create tiket (customer baru).
// 2) Email di-skip aman saat EMAIL_USER/PASS belum di-set (default dev) → tidak throw.
// 3) Transisi status → Completed tidak gagal walau email tidak terkirim.
import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { createServiceTicket, transitionServiceStatus } from "../src/services/serviceService";
import { sendServiceNotaEmail, isEmailConfigured } from "../src/services/emailService";

const prisma = new PrismaClient();

let ticketId = 0;
let customerId: number | null = null;

beforeAll(async () => {
  const t = await createServiceTicket({
    customerName: "QA Email #103",
    customerPhone: "081234567103",
    customerEmail: "qa103@example.com",
    device: { brand: "Samsung", model: "A52", issue: "ganti LCD" },
    notes: "test email nota",
  });
  ticketId = t.id;
  customerId = t.customerId;
});

afterAll(async () => {
  if (ticketId) await prisma.serviceTicket.delete({ where: { id: ticketId } }).catch(() => {});
  if (customerId) await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("Email nota digital #103", () => {
  test("customerEmail tersimpan di customer saat create tiket", async () => {
    const c = await prisma.customer.findUnique({ where: { id: customerId! } });
    expect(c?.email).toBe("qa103@example.com");
  });

  test("isEmailConfigured() false tanpa env SMTP (dev default)", () => {
    // Di env dev test ini EMAIL_USER/EMAIL_PASS kosong → email di-skip, bukan error.
    expect(isEmailConfigured()).toBe(false);
  });

  test("sendServiceNotaEmail tanpa konfigurasi → tidak throw, return false", async () => {
    const ok = await sendServiceNotaEmail({
      ticketNumber: "QA-103",
      device: { brand: "Samsung", model: "A52" },
      serviceFee: 100000,
      totalCost: 250000,
      customer: { name: "QA Email #103", email: "qa103@example.com" },
      parts: [{ name: "LCD A52", qty: 1, subtotal: 150000 }],
    });
    expect(ok).toBe(false); // skip karena SMTP belum di-set
  });

  test("transisi status → Completed tetap sukses (email tidak menggagalkan)", async () => {
    // FSM ketat: Queue → Diagnosing → In_Progress → Completed
    await transitionServiceStatus({ ticketId, to: "Diagnosing", createdBy: "qa" });
    await transitionServiceStatus({ ticketId, to: "In_Progress", createdBy: "qa" });
    const t = await transitionServiceStatus({ ticketId, to: "Completed", createdBy: "qa" });
    expect(t).not.toBeNull();
    expect(t!.status).toBe("Completed");
    expect(t!.customer?.email).toBe("qa103@example.com");
  });
});
