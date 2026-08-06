// Service ticket service v2 — #97: CRUD tiket servis + FSM status ketat +
// parts (potong stok otomatis) + service fee + totalCost dari aggregate.
// Konvensi #87: uang dalam SEN di kalkulasi, simpan rupiah (Decimal 14,2).
import { prisma } from "../db";
import { nextTicketNo } from "./sequence";
import { sendServiceNotaEmail } from "./emailService"; // #103: email nota digital
import type { ServiceStatus, PaymentMethod } from "@prisma/client";

function biz(msg: string): Error {
  return new Error(`[BIZ] ${msg}`);
}

// ── FSM status servis (H13-style) ───────────────────────────────────────────
export const SERVICE_TRANSITIONS: Record<ServiceStatus, ServiceStatus[]> = {
  Queue: ["Diagnosing", "Waiting_Part", "Cancelled"],
  Diagnosing: ["In_Progress", "Waiting_Part", "Completed", "Cancelled"],
  In_Progress: ["Waiting_Part", "Completed", "Cancelled"],
  Waiting_Part: ["In_Progress", "Completed", "Cancelled"],
  Completed: ["Ready_For_Pickup"],
  Ready_For_Pickup: ["Picked_Up"],
  Picked_Up: [],
  Cancelled: [],
};

export function assertServiceTransition(from: ServiceStatus, to: ServiceStatus) {
  if (from === to) return;
  if (!SERVICE_TRANSITIONS[from]?.includes(to)) {
    throw biz(`Transisi status servis tidak valid: ${from} → ${to}`);
  }
}

/** Hitung totalCost tiket = serviceFee + SUM(subtotal parts). */
export async function recomputeTotal(
  ticketId: number,
  // pass client/tx supaya melihat perubahan uncommitted di dalam $transaction
  client: Pick<typeof prisma, "serviceTicketPart" | "serviceTicket"> = prisma,
) {
  const agg = await client.serviceTicketPart.aggregate({
    where: { serviceTicketId: ticketId },
    _sum: { subtotal: true },
  });
  const ticket = await client.serviceTicket.findUniqueOrThrow({
    where: { id: ticketId },
  });
  const partsTotal = Number(agg._sum.subtotal ?? 0);
  const total = Number(ticket.serviceFee) + partsTotal;
  return client.serviceTicket.update({
    where: { id: ticketId },
    data: { totalCost: total.toFixed(2) },
  });
}

// ── Workload teknisi (paritas main: getTechnicianWorkload) ───────────────────
// #111: jumlah tiket per status (aktif), total, & ringkasan biaya per teknisi.
const ACTIVE_STATUSES: ServiceStatus[] = ["Queue", "Diagnosing", "Waiting_Part", "In_Progress"];

export async function getTechnicianWorkload(technicianId: number) {
  const tech = await prisma.user.findUnique({
    where: { id: technicianId },
    select: { id: true, name: true, role: true },
  });
  if (!tech) throw new Error("[BIZ] Teknisi tidak ditemukan");

  const tickets = await prisma.serviceTicket.findMany({
    where: { technicianId, status: { in: [...ACTIVE_STATUSES, "Completed", "Ready_For_Pickup", "Picked_Up"] } },
    select: { status: true, serviceFee: true },
  });

  const byStatus: Record<string, number> = {};
  let active = 0;
  let completed = 0;
  let estimatedRevenue = 0;
  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    if (ACTIVE_STATUSES.includes(t.status as ServiceStatus)) active++;
    else if (t.status === "Completed" || t.status === "Ready_For_Pickup" || t.status === "Picked_Up") completed++;
    estimatedRevenue += Number(t.serviceFee ?? 0);
  }

  return {
    technicianId: tech.id,
    technicianName: tech.name,
    byStatus,
    active,
    completed,
    total: tickets.length,
    estimatedRevenue,
  };
}

// ── CRUD tiket ──────────────────────────────────────────────────────────────
// #109: validasi foto di device.photos (dataURL hasil kompresi browser).
const MAX_DEVICE_PHOTO_CHARS = 2_800_000; // ~2MB binary base64

function sanitizeDevice(device: unknown): object {
  if (!device || typeof device !== "object") return {};
  const d = device as Record<string, unknown>;
  if (Array.isArray(d.photos)) {
    d.photos = d.photos.filter((p) => typeof p === "string" && p.startsWith("data:image/") && p.length <= MAX_DEVICE_PHOTO_CHARS);
  }
  return d;
}

export async function createServiceTicket(input: {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string; // #103: email untuk nota digital
  device?: unknown;
  technicianId?: number;
  technicianName?: string;
  notes?: string;
  serviceFee?: number;
  createdBy?: string;
}) {
  let customerId: number | undefined;
  if (input.customerName) {
    // cari customer by phone dulu, kalau ada pakai; kalau baru, buat
    if (input.customerPhone) {
      const existing = await prisma.customer.findFirst({
        where: { phone: input.customerPhone },
      });
      if (existing) customerId = existing.id;
    }
    if (!customerId) {
      const c = await prisma.customer.create({
        data: {
          name: input.customerName,
          phone: input.customerPhone,
          email: input.customerEmail || null, // #103: email untuk nota digital
          type: "walkin",
        },
      });
      customerId = c.id;
    } else if (input.customerEmail) {
      // #103: update email bila pelanggan lama belum punya / ganti email
      await prisma.customer.update({
        where: { id: customerId },
        data: { email: input.customerEmail },
      });
    }
  }

  const ticketNumber = await nextTicketNo();
  const ticket = await prisma.serviceTicket.create({
    data: {
      ticketNumber,
      customerId,
      device: sanitizeDevice(input.device),
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      notes: input.notes,
      serviceFee: input.serviceFee ?? 0,
      status: "Queue",
    },
  });
  await prisma.serviceLog.create({
    data: {
      serviceTicketId: ticket.id,
      fromStatus: "None",
      toStatus: "Queue",
      note: "Tiket servis dibuat",
      createdBy: input.createdBy,
    },
  });
  await recomputeTotal(ticket.id);
  return prisma.serviceTicket.findUniqueOrThrow({
    where: { id: ticket.id },
    include: { customer: true, parts: { include: { item: true } }, technician: { select: { id: true, name: true } } },
  });
}

export async function listServiceTickets(params: {
  page?: number;
  limit?: number;
  status?: string;
  technicianId?: number;
  search?: string;
}) {
  const { page = 1, limit = 20, status, technicianId, search } = params;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (technicianId) where.technicianId = technicianId;
  if (search) {
    where.OR = [
      { ticketNumber: { contains: search, mode: "insensitive" } },
      { device: { path: ["brand"], string_contains: search } },
      { customer: { is: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.serviceTicket.findMany({
      where,
      include: { customer: true, parts: true, technician: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.serviceTicket.count({ where }),
  ]);
  return { rows, total, page, limit };
}

export async function getServiceTicket(id: number) {
  const ticket = await prisma.serviceTicket.findUnique({
    where: { id },
    include: {
      customer: true,
      parts: { include: { item: true } },
      technician: { select: { id: true, name: true } },
      logs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!ticket) throw biz("Tiket servis tidak ditemukan");
  return ticket;
}

export async function updateServiceTicket(
  id: number,
  input: {
    device?: unknown;
    technicianId?: number;
    technicianName?: string;
    notes?: string;
    paymentMethod?: PaymentMethod;
    customerEmail?: string; // #103: update email pelanggan
  }
) {
  const existing = await prisma.serviceTicket.findUnique({ where: { id } });
  if (!existing) throw biz("Tiket servis tidak ditemukan");
  if (existing.status === "Picked_Up" || existing.status === "Cancelled") {
    throw biz(`Tiket ${existing.status} tidak bisa diubah`);
  }
  const data: Record<string, unknown> = {};
  if (input.device !== undefined) data.device = sanitizeDevice(input.device);
  if (input.technicianId !== undefined) data.technicianId = input.technicianId;
  if (input.technicianName !== undefined) data.technicianName = input.technicianName;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
  if (input.customerEmail !== undefined && existing.customerId) {
    // #103: simpan/perbarui email di record customer terkait
    await prisma.customer.update({
      where: { id: existing.customerId },
      data: { email: input.customerEmail || null },
    });
  }
  return prisma.serviceTicket.update({ where: { id }, data });
}

/** Transisi status FSM + catat log + timestamp milestone. */
export async function transitionServiceStatus(input: {
  ticketId: number;
  to: ServiceStatus;
  note?: string;
  createdBy?: string;
  paymentMethod?: string;
}) {
  const ticket = await prisma.serviceTicket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) throw biz("Tiket servis tidak ditemukan");
  assertServiceTransition(ticket.status, input.to);

  // H4: saat tiket dinyatakan selesai diambil, total>0 wajib paymentMethod tercatat
  // (kelak: ke transaksi POS). Route status menerima paymentMethod opsional utk di-set.
  if (input.to === "Picked_Up" && Number(ticket.totalCost) > 0 && !ticket.paymentMethod) {
    throw biz("Tiket belum tercatat metode pembayaran — isi paymentMethod sebelum Picked_Up");
  }

  const data: Record<string, unknown> = { status: input.to };
  if (input.to === "Diagnosing") data.diagnosedAt = new Date();
  if (input.to === "Completed") data.completedAt = new Date();
  if (input.to === "Picked_Up") data.pickedUpAt = new Date();
  if (input.paymentMethod) data.paymentMethod = input.paymentMethod;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.serviceTicket.update({ where: { id: input.ticketId }, data });
    await tx.serviceLog.create({
      data: {
        serviceTicketId: input.ticketId,
        fromStatus: ticket.status,
        toStatus: input.to,
        note: input.note,
        createdBy: input.createdBy,
      },
    });
    return tx.serviceTicket.findUnique({
      where: { id: input.ticketId },
      include: { customer: true, parts: { include: { item: true } } },
    });
  });

  // #103: kirim email nota digital saat servis selesai (Completed).
  // Fire-and-forget — kegagalan email TIDAK menggagalkan transisi status.
  if (input.to === "Completed" && updated) {
    sendServiceNotaEmail({
      ticketNumber: updated.ticketNumber,
      device: (updated.device as { brand?: string; model?: string }) ?? {},
      serviceFee: Number(updated.serviceFee),
      totalCost: Number(updated.totalCost),
      customer: updated.customer,
      parts: updated.parts.map((p) => ({
        name: p.name,
        qty: p.qty,
        subtotal: Number(p.item?.sellingPrice ?? 0) * p.qty,
      })),
    }).catch(() => {}); // double-guard: emailService sendiri tidak throw
  }

  return updated;
}

// ── Parts (pakai stok item) ─────────────────────────────────────────────────
export async function addServicePart(input: {
  ticketId: number;
  itemId: number;
  qty: number;
  createdById?: number;
}) {
  const ticket = await prisma.serviceTicket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) throw biz("Tiket servis tidak ditemukan");
  if (ticket.status === "Completed" || ticket.status === "Ready_For_Pickup" || ticket.status === "Picked_Up" || ticket.status === "Cancelled") {
    throw biz(`Tiket ${ticket.status} tidak bisa ditambah part`);
  }
  const item = await prisma.item.findUnique({ where: { id: input.itemId } });
  if (!item) throw biz("Item tidak ditemukan");
  if (!item.isActive) throw biz(`Item ${item.name} nonaktif`);
  if (input.qty <= 0) throw biz("Qty part harus > 0");
  if (item.stock < input.qty) {
    throw biz(`Stok ${item.name} kurang (sisa ${item.stock}, butuh ${input.qty})`);
  }

  return prisma.$transaction(async (tx) => {
    const part = await tx.serviceTicketPart.create({
      data: {
        serviceTicketId: input.ticketId,
        itemId: input.itemId,
        name: item.name,
        qty: input.qty,
        priceAtTime: item.sellingPrice,
        subtotal: (Number(item.sellingPrice) * input.qty).toFixed(2),
      },
    });
    await tx.item.update({
      where: { id: input.itemId },
      data: { stock: { decrement: input.qty } },
    });
    await tx.stockAudit.create({
      data: {
        itemId: input.itemId,
        delta: -input.qty,
        reason: "SERVICE_PART",
        refType: "ServiceTicket",
        refId: input.ticketId,
        createdById: input.createdById,
      },
    });
    await recomputeTotal(input.ticketId, tx);
    return part;
  });
}

/** Hapus part → kembalikan stok item + recompute total. */
export async function removeServicePart(input: { ticketId: number; partId: number; createdById?: number }) {
  const part = await prisma.serviceTicketPart.findUnique({ where: { id: input.partId } });
  if (!part) throw biz("Part tidak ditemukan");
  if (part.serviceTicketId !== input.ticketId) throw biz("Part bukan milik tiket ini");
  const ticket = await prisma.serviceTicket.findUnique({ where: { id: input.ticketId } });
  // H5: part tidak bisa ditarik setelah tiket selesai
  if (ticket && ["Completed", "Ready_For_Pickup", "Picked_Up", "Cancelled"].includes(ticket.status)) {
    throw biz(`Tiket ${ticket.status} tidak bisa diubah partnya`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.serviceTicketPart.delete({ where: { id: input.partId } });
    await tx.item.update({
      where: { id: part.itemId },
      data: { stock: { increment: part.qty } },
    });
    await tx.stockAudit.create({
      data: {
        itemId: part.itemId,
        delta: part.qty,
        reason: "SERVICE_PART_RETURN",
        refType: "ServiceTicket",
        refId: input.ticketId,
        createdById: input.createdById,
      },
    });
    await recomputeTotal(input.ticketId, tx);
    return { deleted: true, returnedQty: part.qty };
  });
}

export async function setServiceFee(input: { ticketId: number; fee: number }) {
  if (input.fee < 0) throw biz("Service fee tidak boleh negatif");
  const ticket = await prisma.serviceTicket.findUnique({ where: { id: input.ticketId } });
  if (!ticket) throw biz("Tiket servis tidak ditemukan");
  // H5: harga terkonfirmasi tidak berubah setelah completed/pickup
  if (["Completed", "Ready_For_Pickup", "Picked_Up", "Cancelled"].includes(ticket.status)) {
    throw biz(`Tiket ${ticket.status} tidak bisa diubah biayanya`);
  }
  await prisma.serviceTicket.update({
    where: { id: input.ticketId },
    data: { serviceFee: input.fee.toFixed(2) },
  });
  return recomputeTotal(input.ticketId);
}

export async function deleteServiceTicket(id: number) {
  const ticket = await prisma.serviceTicket.findUnique({ where: { id } });
  if (!ticket) throw biz("Tiket servis tidak ditemukan");
  // hapus berantai: parts (kembalikan stok), logs, lalu tiket
  return prisma.$transaction(async (tx) => {
    const parts = await tx.serviceTicketPart.findMany({ where: { serviceTicketId: id } });
    for (const p of parts) {
      await tx.item.update({
        where: { id: p.itemId },
        data: { stock: { increment: p.qty } },
      });
    }
    await tx.serviceTicketPart.deleteMany({ where: { serviceTicketId: id } });
    await tx.serviceLog.deleteMany({ where: { serviceTicketId: id } });
    // kalau tiket ini jadi sumber klaim garansi, jangan hapus
    const claims = await tx.serviceTicket.count({ where: { claimFromId: id } });
    if (claims > 0) throw biz("Tiket ini sudah punya klaim garansi — tidak bisa dihapus");
    await tx.serviceTicket.delete({ where: { id } });
    return { deleted: true };
  });
}

export async function serviceLogs(ticketId?: number, limit = 100) {
  return prisma.serviceLog.findMany({
    where: ticketId ? { serviceTicketId: ticketId } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}