// Fix H1/H2/H13/H14 — Special Order FSM ketat + pembayaran tersinkron uang.
// H13: Picked_Up HANYA dari Arrived. Payment status DIPISAH dari status barang.
// H1:  payment_status dihitung dari aggregate order_payments (bukan set manual).
// H2:  tiap pembayaran tercatat → laporan revenue menghitungnya.
// H14: pembayaran order TIDAK menyentuh tiket servis (apalagi yang final).
import { prisma } from "../db";
import { nextOrderNo } from "./sequence";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

// ── H13: FSM ketat — daftar transisi VALID (sisanya ditolak) ────────────────
const ORDER_FSM: Record<OrderStatus, OrderStatus[]> = {
  Pending: ["Searching", "Cancelled"],
  Searching: ["Ordered", "Cancelled"],
  Ordered: ["Arrived", "Cancelled"],
  Arrived: ["Picked_Up", "Cancelled"], // Picked_Up HANYA dari Arrived ✓
  Picked_Up: [],
  Cancelled: [],
};

export const ORDER_FSM_TRANSITIONS = ORDER_FSM; // expose utk test

function biz(msg: string): Error {
  return new Error(`[BIZ] ${msg}`);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ORDER_FSM[from].includes(to)) {
    throw biz(`Transisi order tidak valid: ${from} → ${to}`);
  }
}

// ── H1: hitung ulang payment status dari aggregate payment ─────────────────
export function computePaymentStatus(estimatedPrice: bigint, paidAmount: bigint): PaymentStatus {
  return paidAmount >= estimatedPrice ? "Lunas" : "Belum_Lunas";
}

export function formatDecimal(n: bigint): string {
  return (Number(n) / 100).toFixed(2);
}

/** Ringkasan keuangan order: total dibayar + sisa + status (dari aggregate).
 *  client = detail: PrismaClient | Omit<PrismaClient, tx> biar bisa dipanggil
 *  di dalam interactive transaction (melihat perubahan uncommitted). */
export async function orderFinancials(orderId: number, client: Pick<typeof prisma, "specialOrder"> = prisma) {
  const order = await client.specialOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: true },
  });
  const estimatedCents = BigInt(Math.round(Number(order.estimatedPrice) * 100));
  const paidCents = order.payments.reduce(
    (acc, p) => acc + BigInt(Math.round(Number(p.amount) * 100)),
    0n
  );
  const remainingCents = estimatedCents - paidCents;
  const paymentStatus = computePaymentStatus(estimatedCents, paidCents);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    estimatedPrice: order.estimatedPrice.toString(),
    paidAmount: formatDecimal(paidCents),
    remaining: formatDecimal(remainingCents < 0n ? 0n : remainingCents),
    paymentStatus,
    status: order.status,
    paymentCount: order.payments.length,
    payments: order.payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      method: p.method,
      paidAt: p.paidAt,
    })),
  };
}

// ── Core: buat order baru ───────────────────────────────────────────────────
export async function createOrder(input: {
  customerId?: number;
  itemName: string;
  itemDescription?: string;
  estimatedPrice: number;
  downPayment?: number;
  handledById?: number;
  notes?: string;
}) {
  const orderNumber = await nextOrderNo();
  const order = await prisma.specialOrder.create({
    data: {
      orderNumber,
      customerId: input.customerId,
      itemName: input.itemName,
      itemDescription: input.itemDescription,
      estimatedPrice: input.estimatedPrice,
      downPayment: input.downPayment ?? 0,
      handledById: input.handledById,
      notes: input.notes,
      status: "Pending",
    },
  });

  // DP awal langsung tercatat sebagai payment (H2: uang masuk tercatat)
  if (input.downPayment && input.downPayment > 0) {
    await prisma.specialOrderPayment.create({
      data: {
        orderId: order.id,
        amount: input.downPayment,
        method: "Cash",
        createdById: input.handledById,
      },
    });
    // sync status payment dari aggregate (H1)
    const fin = await orderFinancials(order.id);
    await prisma.specialOrder.update({
      where: { id: order.id },
      data: { paymentStatus: fin.paymentStatus },
    });
  }

  return orderFinancials(order.id);
}

// ── H13: transisi status dengan FSM ketat ───────────────────────────────────
export async function transitionOrderStatus(orderId: number, to: OrderStatus) {
  const order = await prisma.specialOrder.findUniqueOrThrow({ where: { id: orderId } });
  assertTransition(order.status, to);

  const data: Record<string, unknown> = { status: to };
  if (to === "Ordered") data.orderedAt = new Date();
  if (to === "Arrived") data.arrivedAt = new Date();
  if (to === "Picked_Up") data.pickedUpAt = new Date();

  await prisma.specialOrder.update({ where: { id: orderId }, data });
  return orderFinancials(orderId);
}

// ── H1/H2: catat pembayaran → aggregate ulang → status otomatis ─────────────
export async function addOrderPayment(input: {
  orderId: number;
  amount: number;
  method: PaymentMethod;
  createdById?: number;
}) {
  const fin = await orderFinancials(input.orderId);
  const remainingCents = BigInt(Math.round(Number(fin.remaining) * 100));

  if (fin.paymentStatus === "Lunas") {
    throw biz(`Order ${fin.orderNumber} sudah lunas — tidak bisa bayar lagi`);
  }
  const amountCents = BigInt(Math.round(input.amount * 100));
  if (amountCents > remainingCents) {
    throw biz(
      `Pembayaran melebihi sisa: sisa ${fin.remaining}, dibayar ${formatDecimal(amountCents)}`
    );
  }
  if (amountCents <= 0n) throw biz("Nominal pembayaran harus > 0");

  // catat payment (H2) — dalam transaksi biar konsisten dengan update status (H1)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.specialOrderPayment.create({
      data: {
        orderId: input.orderId,
        amount: input.amount,
        method: input.method,
        createdById: input.createdById,
      },
    });
    const fin2 = await orderFinancials(input.orderId);
    await tx.specialOrder.update({
      where: { id: input.orderId },
      data: { paymentStatus: fin2.paymentStatus },
    });
    return fin2;
  });

  return updated;
}
