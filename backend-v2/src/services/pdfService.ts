// PDF nota service v2 — #104: generate PDF nota/struk via pdfkit.
// Dipakai endpoint GET /api/v2/notas/:source/:id/pdf (POS, servis, order).
import PDFDocument from "pdfkit";

export type PdfLine = { label: string; value: string };

function rupiah(n: number | string | bigint | null | undefined): string {
  return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface BasePdf {
  title: string;
  ref: string;
  date?: Date | string;
  meta: PdfLine[];
  items: { name: string; qty: number; price: number; subtotal: number }[];
  totals: PdfLine[];
  footer?: string;
}

/** Generate PDF nota (struk POS / nota servis / nota order) → Buffer. */
export function generateNotaPdf(doc: BasePdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    // Header
    pdf.fontSize(16).fillColor("#0d6efd").text("Bengkel UTC", { align: "center" });
    pdf.fontSize(11).fillColor("#333").text("Unida Technology Centre", { align: "center" });
    pdf.moveDown(0.3);
    pdf.fontSize(13).text(doc.title, { align: "center" });
    pdf.moveDown(0.4);

    // Garis pemisah
    pdf.moveTo(48, pdf.y).lineTo(pdf.page.width - 48, pdf.y).strokeColor("#aaa").stroke();
    pdf.moveDown(0.4);

    // Meta (ref, tanggal, pelanggan, dll)
    for (const m of doc.meta) {
      pdf.fontSize(10).fillColor("#333");
      pdf.text(`${m.label}: ${m.value}`, { continued: false });
    }
    pdf.moveDown(0.4);

    // Tabel item
    pdf.fontSize(10).fillColor("#222");
    pdf.text("Rincian:", { continued: false });
    pdf.moveDown(0.2);
    for (const it of doc.items) {
      const line = `${it.name}  x${it.qty}  @ ${rupiah(it.price)}`;
      pdf.text(line, { continued: false });
      pdf.text(rupiah(it.subtotal), { align: "right" });
    }
    pdf.moveDown(0.3);

    // Garis
    pdf.moveTo(48, pdf.y).lineTo(pdf.page.width - 48, pdf.y).strokeColor("#aaa").stroke();
    pdf.moveDown(0.3);

    // Total
    for (const t of doc.totals) {
      const bold = t.label.toLowerCase().includes("total");
      pdf.fontSize(bold ? 12 : 10).fillColor(bold ? "#0d6efd" : "#333");
      pdf.text(t.label, { continued: false });
      pdf.text(t.value, { align: "right" });
    }

    // Footer
    if (doc.footer) {
      pdf.moveDown(0.8);
      pdf.fontSize(9).fillColor("#666").text(doc.footer, { align: "center" });
    }

    pdf.end();
  });
}

export function notaPdfMeta(opts: {
  title: string;
  ref: string;
  date?: Date | string;
  customer?: string | null;
  cashier?: string | null;
  technician?: string | null;
  method?: string | null;
  status?: string | null;
}): BasePdf["meta"] {
  const meta: PdfLine[] = [];
  meta.push({ label: "No. Nota", value: opts.ref });
  meta.push({ label: "Tanggal", value: formatDate(opts.date) });
  if (opts.customer) meta.push({ label: "Pelanggan", value: opts.customer });
  if (opts.cashier) meta.push({ label: "Kasir", value: opts.cashier });
  if (opts.technician) meta.push({ label: "Teknisi", value: opts.technician });
  if (opts.method) meta.push({ label: "Metode Bayar", value: opts.method });
  if (opts.status) meta.push({ label: "Status", value: opts.status });
  return meta;
}

export { rupiah, formatDate };
