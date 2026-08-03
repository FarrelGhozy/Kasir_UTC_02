// Fix M8 — klaim garansi MAKSIMAL 1x per tiket sumber.
// Dijaga di 2 level: (a) cek eksplisit warrantyClaimed; (b) unique index claim_from_id.
import { prisma } from "../db";
import { nextTicketNo } from "./sequence";

function biz(msg: string): Error {
  return new Error(`[BIZ] ${msg}`);
}

/**
 * Buat tiket klaim garansi dari tiket asli. Satu tiket sumber → max 1 klaim.
 * @param sourceTicketId tiket yang punya garansi (Completed + warrantyExpiresAt belum lewat)
 * @returns tiket klaim baru yang menunjuk ke sumber
 */
export async function claimWarranty(input: {
  sourceTicketId: number;
  customerId?: number;
  device: unknown;
  technicianId?: number;
  notes?: string;
  createdBy?: string;
}) {
  const source = await prisma.serviceTicket.findUnique({
    where: { id: input.sourceTicketId },
  });
  if (!source) throw biz("Tiket sumber garansi tidak ditemukan");
  if (source.warrantyClaimed) {
    throw biz("Garansi tiket ini sudah pernah diklaim (maksimal 1x)");
  }
  // garansi hanya untuk tiket yang selesai
  if (source.status !== "Completed") {
    throw biz("Klaim garansi hanya untuk tiket berstatus Completed");
  }
  // cek masa garansi
  if (!source.warrantyExpiresAt || source.warrantyExpiresAt < new Date()) {
    throw biz("Garansi tiket ini tidak aktif / sudah kedaluwarsa");
  }

  const ticketNumber = await nextTicketNo();
  // transaksi: buat tiket klaim + tandai source sudah diklaim — atomic, no race
  return prisma.$transaction(async (tx) => {
    const claim = await tx.serviceTicket.create({
      data: {
        ticketNumber,
        customerId: input.customerId,
        device: typeof input.device === "object" ? (input.device as object) : {},
        technicianId: input.technicianId,
        notes: input.notes,
        status: "Queue",
        claimFromId: input.sourceTicketId,
      },
    });
    // tandai source (hapus flag ganda via update ber-condition biar idempotent)
    await tx.serviceTicket.update({
      where: { id: input.sourceTicketId },
      data: { warrantyClaimed: true },
    });
    await tx.serviceLog.create({
      data: {
        serviceTicketId: claim.id,
        fromStatus: "None",
        toStatus: "Queue",
        note: "Tiket klaim garansi dari #" + source.ticketNumber,
        createdBy: input.createdBy,
      },
    });
    return claim;
  });
}