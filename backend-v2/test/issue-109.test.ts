// Test #109 — Kompresi foto & upload foto order.
// 1) validatePhoto: dataURL valid → dikembalikan; bukan dataURL → throw; >2MB → throw; null → undefined.
// 2) createOrder dengan photo → tersimpan & terbaca kembali (tidak hilang).
// 3) createServiceTicket dengan device.photos campuran → hanya foto valid (data:image, ≤2MB) yang tersimpan.
import { describe, expect, test, afterAll } from "bun:test";
import { validatePhoto, createOrder } from "../src/services/orderService";
import { createServiceTicket } from "../src/services/serviceService";
import { prisma } from "../src/db";

const VALID = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const HUGE = "data:image/png;base64," + "A".repeat(2_900_000);

let createdOrderId: number | undefined;
let createdTicketId: number | undefined;

afterAll(async () => {
  if (createdOrderId) await prisma.specialOrder.delete({ where: { id: createdOrderId } });
  if (createdTicketId) {
    await prisma.serviceLog.deleteMany({ where: { serviceTicketId: createdTicketId } });
    await prisma.serviceTicket.delete({ where: { id: createdTicketId } });
  }
});

describe("Foto order & kompresi #109", () => {
  test("validatePhoto: valid → dikembalikan", () => {
    expect(validatePhoto(VALID)).toBe(VALID);
  });

  test("validatePhoto: null/undefined → undefined", () => {
    expect(validatePhoto(null)).toBeUndefined();
    expect(validatePhoto(undefined)).toBeUndefined();
  });

  test("validatePhoto: bukan data URL gambar → throw", () => {
    expect(() => validatePhoto("https://evil.example/x.png")).toThrow();
    expect(() => validatePhoto("plain-text")).toThrow();
  });

  test("validatePhoto: > 2MB → throw", () => {
    expect(() => validatePhoto(HUGE)).toThrow();
  });

  test("createOrder dgn photo → tersimpan & terbaca kembali", async () => {
    const order = await createOrder({ itemName: "Test Foto #109", estimatedPrice: 100000, photo: VALID });
    createdOrderId = order.orderId;
    expect(order.photo).toBe(VALID);
    const back = await prisma.specialOrder.findUnique({ where: { id: order.orderId } });
    expect(back!.photo).toBe(VALID);
  });

  test("createServiceTicket: device.photos → foto invalid dibuang, valid dipertahankan", async () => {    const ticket = await createServiceTicket({
      customerName: "Tes Foto Servis",
      device: {
        brand: "Xiaomi",
        photos: [VALID, "https://evil.example/x.png", HUGE],
      },
    });
    createdTicketId = ticket.id;
    const back = await prisma.serviceTicket.findUnique({ where: { id: ticket.id } });
    const photos = (back!.device as { photos?: string[] }).photos ?? [];
    expect(photos).toHaveLength(1);
    expect(photos[0]).toBe(VALID);
  });
});
