// Test #104 — Nota PDF & cetak struk (pdfkit).
// 1) generateNotaPdf menghasilkan buffer PDF valid (%PDF) — untuk struk POS & nota servis.
// 2) getNotaPdf("pos"/"servis"/"order") memuat data dari DB & menghasilkan PDF.
// 3) Sumber tidak dikenal → error biz 400.
import { describe, expect, test } from "bun:test";
import { generateNotaPdf, notaPdfMeta } from "../src/services/pdfService";
import { getNotaPdf } from "../src/services/notaService";
import { prisma } from "../src/db";

describe("Nota PDF & cetak struk #104", () => {
  test("generateNotaPdf → buffer PDF valid (%PDF magic)", async () => {
    const buf = await generateNotaPdf({
      title: "Struk Transaksi",
      ref: "TRX-TEST-104",
      date: new Date(),
      meta: notaPdfMeta({ title: "Struk", ref: "TRX-TEST-104", date: new Date(), cashier: "QA Kasir" }),
      items: [{ name: "Oli Mesin", qty: 2, price: 50000, subtotal: 100000 }],
      totals: [
        { label: "Grand Total", value: "Rp 100.000" },
        { label: "Dibayar", value: "Rp 100.000" },
        { label: "Kembalian", value: "Rp 0" },
      ],
    });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("getNotaPdf('pos', id) → PDF dari transaksi nyata", async () => {
    const tx = await prisma.transaction.findFirst({ orderBy: { id: "desc" } });
    if (!tx) {
      console.warn("Tidak ada transaksi untuk diuji — skip");
      return;
    }
    const buf = await getNotaPdf("pos", tx.id);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(500);
  });

  test("getNotaPdf('servis', id) → PDF dari tiket servis nyata", async () => {
    const s = await prisma.serviceTicket.findFirst({ orderBy: { id: "desc" } });
    if (!s) {
      console.warn("Tidak ada tiket servis untuk diuji — skip");
      return;
    }
    const buf = await getNotaPdf("servis", s.id);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("getNotaPdf('order', id) → PDF dari pesanan nyata", async () => {
    const o = await prisma.specialOrder.findFirst({ orderBy: { id: "desc" } });
    if (!o) {
      console.warn("Tidak ada pesanan untuk diuji — skip");
      return;
    }
    const buf = await getNotaPdf("order", o.id);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("sumber tidak dikenal → error biz 400", async () => {
    await expect(getNotaPdf("unknown", 1)).rejects.toThrow(/harus 'pos', 'servis', atau 'order'/);
  });
});
