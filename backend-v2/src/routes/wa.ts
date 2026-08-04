// Route WhatsApp (WAHA) v2 — #102: status session, check nomor, notify/resend teknisi,
// validate WA. Prefix /api/v2/wa + RBAC. Secret WAHA hanya dari env (config).
import { Elysia, t } from "elysia";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { mapError } from "../middleware/error";
import {
  checkSessionStatus,
  checkExists,
  notifyServiceStatus,
  normalizePhone,
} from "../services/waService";

const prisma = new PrismaClient();

export const waRouter = new Elysia({ prefix: "/api/v2/wa" })
  // GET /api/v2/wa/status — status session WAHA (semua role ter-login)
  .get("/status", async ({ headers, set }) => {
    try {
      await requireAuth(headers);
      const result: any = await checkSessionStatus();
      let status = "ERROR";
      if (result.status === "WORKING") status = "CONNECTED";
      else if (result.status === "UNREACHABLE") status = "UNREACHABLE";
      else if (["DISCONNECTED", "STOPPED"].includes(result.status)) status = "DISCONNECTED";
      else if (["SCAN_QR", "STARTING"].includes(result.status)) status = "STARTING";
      return { success: true, status, raw: result.status, error: result.error ?? null };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })

  // GET /api/v2/wa/check?phone=... — cek nomor terdaftar WA (semua role)
  .get("/check", async ({ query, headers, set }) => {
    try {
      await requireAuth(headers);
      const phone = query.phone as string | undefined;
      if (!phone) {
        set.status = 400;
        return { success: false, isValid: false, isError: false, message: "Nomor HP wajib diisi" };
      }
      const result: any = await checkExists(phone);
      const isError = !!result.error;
      const isValid = result.exists === true || result.status === "exists";
      return {
        success: true,
        isValid,
        isError,
        exists: isValid,
        details: { phone: normalizePhone(phone), ...result },
      };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, isValid: false, isError: true, error: r.body.error };
    }
  })

  // POST /api/v2/wa/services/:id/notify — kirim update status ke customer (kasir/teknisi/admin)
  .post("/services/:id/notify", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers, ["admin", "kasir", "teknisi"]);
      const ticket = await prisma.serviceTicket.findUnique({
        where: { id: Number(params.id) },
        include: { customer: true, parts: true },
      });
      if (!ticket) {
        set.status = 404;
        return { success: false, error: "Tiket servis tidak ditemukan" };
      }
      if (!ticket.customer?.phone) {
        set.status = 400;
        return { success: false, error: "Nomor HP pelanggan tidak tersedia" };
      }
      const result = await notifyServiceStatus({
        id: ticket.id,
        customerName: ticket.customer.name,
        customerPhone: ticket.customer.phone,
        device: ticket.device,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        serviceFee: Number(ticket.serviceFee),
        parts: ticket.parts.map((p) => ({
          name: p.name ?? `Item #${p.itemId}`,
          qty: p.qty,
          subtotal: Number(p.subtotal),
        })),
      });
      if (!result.success) {
        set.status = 502;
        return { success: false, error: result.error ?? "Gagal kirim WhatsApp" };
      }
      return { success: true, message: "Notifikasi WhatsApp terkirim" };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })

  // POST /api/v2/wa/services/:id/resend — kirim ulang nota/update (admin/kasir)
  .post("/services/:id/resend", async ({ params, headers, set }) => {
    try {
      await requireAuth(headers, ["admin", "kasir"]);
      const ticket = await prisma.serviceTicket.findUnique({
        where: { id: Number(params.id) },
        include: { customer: true, parts: true },
      });
      if (!ticket) {
        set.status = 404;
        return { success: false, error: "Tiket servis tidak ditemukan" };
      }
      if (!ticket.customer?.phone) {
        set.status = 400;
        return { success: false, error: "Nomor HP pelanggan tidak tersedia" };
      }
      const result = await notifyServiceStatus({
        id: ticket.id,
        customerName: ticket.customer.name,
        customerPhone: ticket.customer.phone,
        device: ticket.device,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        serviceFee: Number(ticket.serviceFee),
        parts: ticket.parts.map((p) => ({
          name: p.name ?? `Item #${p.itemId}`,
          qty: p.qty,
          subtotal: Number(p.subtotal),
        })),
      });
      if (!result.success) {
        set.status = 502;
        return { success: false, error: result.error ?? "Gagal kirim ulang WhatsApp" };
      }
      return { success: true, message: "Pesan WhatsApp dikirim ulang" };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, error: r.body.error };
    }
  })

  // POST /api/v2/wa/validate — validasi nomor WA pelanggan & update isWaValid (kasir/teknisi/admin)
  .post("/validate", async ({ body, headers, set }) => {
    try {
      await requireAuth(headers, ["admin", "kasir", "teknisi"]);
      const { phone } = body as { phone?: string };
      if (!phone) {
        set.status = 400;
        return { success: false, isValid: false, message: "Nomor HP wajib diisi" };
      }
      const result: any = await checkExists(phone);
      const isValid = result.exists === true || result.status === "exists";
      if (isValid) {
        await prisma.customer.updateMany({
          where: { phone },
          data: { isWaValid: true },
        });
      }
      return {
        success: true,
        isValid,
        isError: !!result.error,
        message: isValid ? "Nomor WhatsApp valid" : "Nomor tidak terdaftar di WhatsApp",
      };
    } catch (e) {
      const r = mapError(e);
      set.status = r.status;
      return { success: false, isValid: false, isError: true, error: r.body.error };
    }
  });