/**
 * #86 — Full Migration MongoDB (produksi v1) → PostgreSQL (dev v2).
 *
 * Strategi IDEMPOTENT: setiap dokumen mongo di-skip kalau sudah ada di
 * tabel `migration_id_map` (entity + old_id). Jadi script bisa di-run ulang
 * tanpa duplikat & tanpa merusak data dev yang sudah ada di PG.
 *
 * Jalankan: `bun run scripts/migrate-mongo-to-pg.ts`
 * Koneksi:
 *   MONGO_URL  default mongodb://localhost:27018/bengkel_utc  (baca)
 *   PG URL     dari .env DATABASE_URL (tulis, via Prisma)
 */
import { MongoClient, ObjectId } from "mongodb";
import { PrismaClient, Prisma } from "@prisma/client";
import "dotenv/config";

const MONGO_URL = process.env.MONGO_URL ?? "mongodb://localhost:27018/bengkel_utc";
const pg = new PrismaClient();
const upsertMap = pg.$queryRawUnsafe;

// helper: marcamos idempoten
async function hasMigrated(entity: string, oldId: string | ObjectId): Promise<boolean> {
  const id = String(oldId);
  const r = await pg.migrationIdMap.findUnique({
    where: { entity_oldId: { entity, oldId: id } },
  });
  return !!r;
}
async function saveMap(entity: string, oldId: string | ObjectId, newId: number | bigint) {
  const id = String(oldId);
  await pg.migrationIdMap.create({
    data: { entity, oldId: id, newId: Number(newId) },
  }).catch(() => {});
}
async function getNew(entity: string, oldId: string | ObjectId): Promise<number | null> {
  const id = String(oldId);
  const r = await pg.migrationIdMap.findUnique({
    where: { entity_oldId: { entity, oldId: id } },
  });
  return r ? r.newId : null;
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const DAY: Record<string, string> = { senin: "senin", selasa: "selasa", rabu: "rabu", kamis: "kamis", jumat: "jumat" };
const PAY: Record<string, string> = { "Belum Lunas": "Belum_Lunas", Lunas: "Lunas" };
const NORM = (s: any) => (s == null ? null : s);

async function main() {
  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  const db = mongo.db();
  console.log(`[migrate] terhubung mongo: ${MONGO_URL}`);
  const counts: Record<string, number> = {};

  // ── 1. users (idempotent thd unique username: kalau sudah ada di PG, map saja)
  {
    const col = db.collection("users");
    const docs = await col.find({}).toArray();
    counts.users = docs.length;
    for (const d of docs) {
      const username = String(d.username ?? "").toLowerCase();
      if (await hasMigrated("users", d._id)) continue;
      const existing = await pg.user.findUnique({ where: { username } });
      if (existing) {
        await saveMap("users", d._id, existing.id);
        console.log(`  [users] '${username}' sudah ada (id ${existing.id}) → di-map`);
        continue;
      }
      const u = await pg.user.create({
        data: {
          name: String(d.name ?? ""),
          username,
          passwordHash: String(d.password ?? ""),
          role: String(d.role ?? "kasir") as any,
          phone: String(d.phone ?? ""),
          isActive: (d.status ?? "active") !== "inactive" && d.isActive !== false,
          jabatan: d.jabatan ?? null,
          createdAt: toDate(d.created_at) ?? new Date(),
          updatedAt: toDate(d.updated_at) ?? new Date(),
        },
      });
      await saveMap("users", d._id, u.id);
    }
    console.log(`[users] ${counts.users} dokumen`);
  }

  // ── 2. items
  {
    const col = db.collection("items");
    const docs = await col.find({}).toArray();
    counts.items = docs.length;
    for (const d of docs) {
      if (await hasMigrated("items", d._id)) continue;
      const sku = String(d.sku ?? "").trim().toUpperCase();
      const existingItem = await pg.item.findUnique({ where: { sku } });
      if (existingItem) {
        await saveMap("items", d._id, existingItem.id);
        console.log(`  [items] sku '${sku}' sudah ada (id ${existingItem.id}) → di-map`);
        continue;
      }
      const it = await pg.item.create({
        data: {
          sku,
          name: String(d.name ?? ""),
          category: String(d.category ?? "Other") as any,
          purchasePrice: new Prisma.Decimal(String(d.purchase_price ?? 0)),
          sellingPrice: new Prisma.Decimal(String(d.selling_price ?? 0)),
          stock: Number(d.stock ?? 0),
          minStockAlert: Number(d.min_stock_alert ?? 5),
          description: d.description ?? null,
          isActive: d.isActive !== false,
          createdAt: toDate(d.created_at) ?? new Date(),
          updatedAt: toDate(d.updated_at) ?? new Date(),
        },
      });
      await saveMap("items", d._id, it.id);
    }
    console.log(`[items] ${counts.items} dokumen`);
  }

  // ── 3. customers — dikumpulkan dari subdoc tiket & order, key unik name|phone
  {
    const custs = new Map<string, any>();
    for (const t of await db.collection("servicetickets").find({}).toArray()) {
      const c = t.customer;
      if (c && c.name) {
        const k = `${String(c.name).trim().toLowerCase()}||${String(c.phone ?? "")}`;
        if (!custs.has(k)) custs.set(k, c);
      }
    }
    for (const o of await db.collection("specialorders").find({}).toArray()) {
      const c = o.customer;
      if (c && c.name) {
        const k = `${String(c.name).trim().toLowerCase()}||${String(c.phone ?? "")}`;
        if (!custs.has(k)) custs.set(k, c);
      }
    }
    counts.customers = custs.size;
    let n = 0;
    for (const [k, d] of custs) {
      if (await hasMigrated("customers", k)) continue;
      const cu = await pg.customer.create({
        data: {
          name: String(d.name ?? ""),
          phone: d.phone ? String(d.phone) : null,
          isWaValid: !!d.is_wa_valid,
          email: d.email ? String(d.email) : null,
          type: d.type ? String(d.type) : null,
        },
      });
      await saveMap("customers", k, cu.id);
      n++;
    }
    console.log(`[customers] ${counts.customers} unik (${n} baru)`);
  }

  // ── 4. service_tickets + parts
  {
    const col = db.collection("servicetickets");
    const docs = await col.find({}).toArray();
    counts.service_tickets = docs.length;
    for (const d of docs) {
      if (await hasMigrated("service_tickets", d._id)) continue;
      const ticketNumber = String(d.ticket_number ?? "");
      const existingSt = await pg.serviceTicket.findUnique({ where: { ticketNumber } });
      if (existingSt) {
        await saveMap("service_tickets", d._id, existingSt.id);
        console.log(`  [tickets] '${ticketNumber}' sudah ada (id ${existingSt.id}) → di-map`);
        continue;
      }
      // customer ref
      let customerId: number | null = null;
      if (d.customer && d.customer.name) {
        const k = `${String(d.customer.name).trim().toLowerCase()}||${String(d.customer.phone ?? "")}`;
        customerId = await getNew("customers", k);
      }
      // technician ref
      let technicianId: number | null = null;
      if (d.technician && d.technician.id) technicianId = await getNew("users", d.technician.id);
      const timestamps = d.timestamps ?? {};
      const history = d.history ?? {};
      const st = await pg.serviceTicket.create({
        data: {
          ticketNumber: String(d.ticket_number ?? ""),
          customerId,
          device: (d.device ?? {}) as Prisma.InputJsonValue,
          technicianName: d.technician?.name ?? null,
          technicianId,
          status: String(d.status ?? "Queue") as any,
          serviceFee: new Prisma.Decimal(String(d.service_fee ?? 0)),
          paymentMethod: d.payment_method ? (String(d.payment_method) as any) : null,
          paymentProof: d.payment_proof ?? null,
          totalCost: new Prisma.Decimal(String(d.total_cost ?? 0)),
          notes: d.notes ?? null,
          warrantyExpiresAt: toDate(d.warranty_expires_at),
          warrantyClaimed: !!d.warranty_claimed,
          claimFromId: null,
          createdAt: toDate(history.created_at ?? timestamps.created_at) ?? new Date(),
          diagnosedAt: toDate(history.diagnosed_at),
          completedAt: toDate(history.completed_at),
          pickedUpAt: toDate(history.picked_up_at ?? timestamps.picked_up_at),
          updatedAt: toDate(history.updated_at ?? updatedAtSafe(d)) ?? new Date(),
        },
      });
      await saveMap("service_tickets", d._id, st.id);

      // parts
      for (const p of d.parts_used ?? []) {
        const itemId = p.item_id ? await getNew("items", p.item_id) : null;
        if (!itemId) continue;
        await pg.serviceTicketPart.create({
          data: {
            serviceTicketId: st.id,
            itemId,
            name: p.name ?? null,
            qty: Number(p.qty ?? 1),
            priceAtTime: new Prisma.Decimal(String(p.price ?? 0)),
            subtotal: new Prisma.Decimal(String(p.subtotal ?? Number(p.price ?? 0) * Number(p.qty ?? 1))),
          },
        });
      }
    }
    console.log(`[service_tickets] ${counts.service_tickets} dokumen`);
  }

  // ── 5. transactions + items (v1 count 0, tetap ditulis utk kesiapan)
  {
    const col = db.collection("transactions");
    const docs = await col.find({}).toArray();
    counts.transactions = docs.length;
    for (const d of docs) {
      if (await hasMigrated("transactions", d._id)) continue;
      const invoiceNo = String(d.invoice_no ?? "");
      const existingTx = await pg.transaction.findUnique({ where: { invoiceNo } });
      if (existingTx) {
        await saveMap("transactions", d._id, existingTx.id);
        continue;
      }
      let cashierId = d.cashier_id ? await getNew("users", d.cashier_id) : null;
      cashierId = cashierId ?? (await pg.user.findFirst())?.id ?? 0;
      const t = await pg.transaction.create({
        data: {
          invoiceNo,
          cashierId,
          grandTotal: new Prisma.Decimal(String(d.grand_total ?? 0)),
          paymentMethod: String(d.payment_method ?? "Cash") as any,
          amountPaid: new Prisma.Decimal(String(d.amount_paid ?? d.grand_total ?? 0)),
          change: new Prisma.Decimal(String(d.change ?? 0)),
          notes: d.notes ?? null,
          date: toDate(d.date ?? d.created_at) ?? new Date(),
        },
      });
      for (const it of d.items ?? []) {
        const itemId = it.item_id ? await getNew("items", it.item_id) : null;
        await pg.transactionItem.create({
          data: {
            transactionId: t.id,
            itemId,
            name: String(it.name ?? ""),
            qty: Number(it.qty ?? 1),
            price: new Prisma.Decimal(String(it.price ?? 0)),
            subtotal: new Prisma.Decimal(String(it.subtotal ?? Number(it.price ?? 0) * Number(it.qty ?? 1))),
          },
        });
      }
      await saveMap("transactions", d._id, t.id);
    }
    console.log(`[transactions] ${counts.transactions} dokumen`);
  }

  // ── 6. special_orders (+ payments dari paid amount)
  {
    const col = db.collection("specialorders");
    const docs = await col.find({}).toArray();
    counts.special_orders = docs.length;
    for (const d of docs) {
      if (await hasMigrated("special_orders", d._id)) continue;
      const orderNumber = String(d.order_number ?? "");
      const existingSo = await pg.specialOrder.findUnique({ where: { orderNumber } });
      if (existingSo) {
        await saveMap("special_orders", d._id, existingSo.id);
        continue;
      }
      let customerId: number | null = null;
      if (d.customer && d.customer.name) {
        const k = `${String(d.customer.name).trim().toLowerCase()}||${String(d.customer.phone ?? "")}`;
        customerId = await getNew("customers", k);
      }
      let handledById: number | null = null;
      if (d.handled_by?.id) handledById = await getNew("users", d.handled_by.id);
      const hist = d.history ?? {};
      const paid = Number(d.paid_amount ?? d.down_payment ?? 0);
      const so = await pg.specialOrder.create({
        data: {
          orderNumber: String(d.order_number ?? ""),
          customerId,
          itemName: String(d.item_name ?? ""),
          itemDescription: d.item_description ?? null,
          estimatedPrice: new Prisma.Decimal(String(d.estimated_price ?? 0)),
          downPayment: new Prisma.Decimal(String(d.down_payment ?? 0)),
          status: String(d.status ?? "Pending") as any,
          paymentStatus: PAY[String(d.payment_status ?? "Belum Lunas")] ?? "Belum_Lunas" as any,
          handledById,
          handledByName: d.handled_by?.name ?? null,
          photo: d.photo ?? null,
          serviceTicketId: d.service_ticket_id ? await getNew("service_tickets", d.service_ticket_id) : null,
          notes: d.notes ?? null,
          createdAt: toDate(hist.created_at ?? d.created_at) ?? new Date(),
          orderedAt: toDate(hist.ordered_at),
          arrivedAt: toDate(hist.arrived_at),
          pickedUpAt: toDate(hist.picked_up_at),
        },
      });
      await saveMap("special_orders", d._id, so.id);
      // order_payments — bangun dr down_payment/paid_amount (fix H1/H2)
      if (paid > 0) {
        await pg.specialOrderPayment.create({
          data: {
            orderId: so.id,
            amount: new Prisma.Decimal(String(paid)),
            method: String(d.payment_method ?? "Cash") as any,
            paidAt: toDate(hist.created_at) ?? new Date(),
            createdById: handledById,
          },
        });
      }
    }
    console.log(`[special_orders] ${counts.special_orders} dokumen`);
  }

  // ── 7. duty_schedules
  {
    const col = db.collection("dutyschedules");
    const docs = await col.find({}).toArray();
    counts.duty_schedules = docs.length;
    for (const d of docs) {
      const userId = d.user ? await getNew("users", d.user) : null;
      if (!userId) continue;
      const day = DAY[String(d.day ?? "")];
      if (!day) continue;
      const exists = await pg.dutySchedule.findUnique({
        where: { userId_day: { userId, day: day as any } },
      });
      if (!exists) {
        await pg.dutySchedule.create({
          data: { userId, day: day as any, createdAt: toDate(d.created_at) ?? new Date() },
        });
      }
    }
    console.log(`[duty_schedules] ${counts.duty_schedules} dokumen`);
  }

  // ── 8. system_logs
  {
    const col = db.collection("systemlogs");
    const docs = await col.find({}).toArray();
    counts.system_logs = docs.length;
    let n = 0;
    for (const d of docs) {
      if (await hasMigrated("system_logs", d._id)) continue;
      await pg.systemLog.create({
        data: {
          level: String(d.level ?? "INFO") as any,
          source: d.source ?? null,
          message: String(d.message ?? ""),
          details: (d.details ?? undefined) as Prisma.InputJsonValue | undefined,
          timestamp: toDate(d.timestamp) ?? new Date(),
        },
      });
      await saveMap("system_logs", d._id, 0); // newId 0 = hanya marker (tak ada FK)
      n++;
    }
    console.log(`[system_logs] ${counts.system_logs} dokumen`);
  }

  await mongo.close();
  console.log("\n═══ RINGKASAN COUNT (source mongo) ═══");
  console.table(counts);
  console.log("\nSelesai. Verifikasi row count target di PG via Prisma/psql.");
}

// fallback updatedAt aman
function updatedAtSafe(d: any): Date {
  const t = d.updated_at ?? d.timestamps?.updated_at;
  return t ? new Date(t) : new Date();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[migrate] GAGAL:", e);
    process.exit(1);
  });