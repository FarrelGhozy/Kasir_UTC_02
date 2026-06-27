const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');

const COLORS = {
  primary: [41, 65, 133],
  accent: [52, 73, 94],
  text: [44, 62, 80],
  muted: [127, 140, 141],
  border: [189, 195, 199],
  success: [39, 174, 96],
  warning: [243, 156, 18],
  danger: [231, 76, 60],
};

function rgb(r, g, b) {
  return { r, g, b };
}

function hexCode(r, g, b) {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const MM = 72 / 25.4;

const PAGE = {
  width: 148 * MM,
  height: 210 * MM,
  margin: 15 * MM,
};

const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

async function generateServiceNota(ticket) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE.width, PAGE.height],
        layout: 'portrait',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Nota Servis - ${ticket.ticket_number}`,
          Author: 'UNIDA Technology Centre',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const qrContent = `UTC-VERIFY:ServiceTicket:${ticket._id}:${ticket.ticket_number}`;
      const qrBuffer = await QRCode.toBuffer(qrContent, {
        type: 'png',
        width: 200,
        margin: 1,
        color: { dark: '#293e85', light: '#ffffff00' },
      });

      addWatermark(doc);
      addBorder(doc);
      addHeader(doc, 'NOTA SERVIS');
      addCustomerSection(doc, ticket.customer);
      addServiceDetails(doc, ticket);
      addPricingSection(doc, ticket);
      if (ticket.warranty_expires_at || ticket.status === 'Picked_Up') {
        addWarrantySection(doc, ticket);
      }
      addQRCode(doc, qrBuffer);
      addFooter(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function generateOrderNota(order) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE.width, PAGE.height],
        layout: 'portrait',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Nota Pesanan - ${order.order_number}`,
          Author: 'UNIDA Technology Centre',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const qrContent = `UTC-VERIFY:SpecialOrder:${order._id}:${order.order_number}`;
      const qrBuffer = await QRCode.toBuffer(qrContent, {
        type: 'png',
        width: 200,
        margin: 1,
        color: { dark: '#293e85', light: '#ffffff00' },
      });

      addWatermark(doc);
      addBorder(doc);
      addHeader(doc, 'NOTA PESANAN');
      addCustomerSection(doc, order.customer);
      addOrderDetails(doc, order);
      addOrderPricing(doc, order);
      addQRCode(doc, qrBuffer);
      addFooter(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function addWatermark(doc) {
  if (!fs.existsSync(LOGO_PATH)) return;
  doc.save();
  doc.opacity(0.1);
  const imgSize = 350 * MM;
  const x = (PAGE.width - imgSize) / 2;
  const y = (PAGE.height - imgSize) / 2;
  doc.image(LOGO_PATH, x, y, { width: imgSize, height: imgSize });
  doc.restore();
}

function addBorder(doc) {
  doc.roundedRect(4 * MM, 4 * MM, PAGE.width - 8 * MM, PAGE.height - 8 * MM, 3 * MM)
    .lineWidth(1.5)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();
  doc.roundedRect(5 * MM, 5 * MM, PAGE.width - 10 * MM, PAGE.height - 10 * MM, 2.5 * MM)
    .lineWidth(0.3)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();
}

function addHeader(doc, title) {
  const logoSize = 18 * MM;
  const y = 10 * MM;

  doc.image(LOGO_PATH, PAGE.margin, y, { width: logoSize, height: logoSize });

  doc.fontSize(11).fillColor(hexCode(...COLORS.primary));
  doc.text('UNIDA TECHNOLOGY CENTRE', PAGE.margin + logoSize + 3 * MM, y + 1 * MM, {
    width: CONTENT_WIDTH - logoSize - 3 * MM,
    align: 'left',
  });

  doc.fontSize(7.5).fillColor(hexCode(...COLORS.muted));
  doc.text('Gedung Zubair Ruangan 205', PAGE.margin + logoSize + 3 * MM, y + 5 * MM);
  doc.text('+62 821-5661-4855 (admin Kantor)', PAGE.margin + logoSize + 3 * MM, y + 8 * MM);

  const lineY = y + logoSize + 3 * MM;
  doc.moveTo(PAGE.margin, lineY)
    .lineTo(PAGE.width - PAGE.margin, lineY)
    .lineWidth(0.8)
    .strokeColor(hexCode(...COLORS.primary))
    .stroke();

  doc.fontSize(14).fillColor(hexCode(...COLORS.primary));
  doc.text(title, PAGE.margin, lineY + 2 * MM, { width: CONTENT_WIDTH, align: 'center' });
}

function addCustomerSection(doc, customer) {
  const y = doc.y + 3 * MM;
  doc.fontSize(7.5).fillColor(hexCode(...COLORS.text));

  const leftX = PAGE.margin;
  const rightX = PAGE.margin + CONTENT_WIDTH / 2;

  doc.text(`Pelanggan  : ${customer.name || '-'}`, leftX, y);
  doc.text(`No. HP     : ${customer.phone || '-'}`, leftX, doc.y + 2.5 * MM);
  doc.text(`Tipe       : ${customer.type || '-'}`, leftX, doc.y + 2.5 * MM);

  doc.y = y;
  doc.text(`Tanggal    : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, rightX, y);
}

function addServiceDetails(doc, ticket) {
  const y = doc.y + 5 * MM;
  doc.fontSize(7.5).fillColor(hexCode(...COLORS.text));

  const deviceName = [ticket.device.type, ticket.device.brand, ticket.device.model].filter(Boolean).join(' ');

  doc.text(`No. Tiket  : ${ticket.ticket_number}`, PAGE.margin, y);
  doc.text(`Perangkat  : ${deviceName || '-'}`, PAGE.margin, doc.y + 2.5 * MM);
  doc.text(`Serial No  : ${ticket.device.serial_number || '-'}`, PAGE.margin, doc.y + 2.5 * MM);
  doc.text(`Keluhan    : ${ticket.device.symptoms || '-'}`, PAGE.margin, doc.y + 2.5 * MM);

  if (ticket.technician && ticket.technician.name) {
    doc.text(`Teknisi    : ${ticket.technician.name}`, PAGE.margin, doc.y + 2.5 * MM);
  }
}

function addPricingSection(doc, ticket) {
  const y = doc.y + 5 * MM;
  const partCost = ticket.parts_used ? ticket.parts_used.reduce((sum, p) => sum + p.subtotal, 0) : 0;
  const totalCost = (ticket.service_fee || 0) + partCost;

  const lineY = y - 1 * MM;
  doc.moveTo(PAGE.margin, lineY)
    .lineTo(PAGE.width - PAGE.margin, lineY)
    .lineWidth(0.5)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();

  doc.fontSize(8).fillColor(hexCode(...COLORS.accent));
  doc.text('RINCIAN BIAYA', PAGE.margin, y, { underline: false });

  let rowY = doc.y + 2 * MM;

  if (ticket.service_fee > 0) {
    const label = 'Jasa Servis';
    doc.fontSize(7.5).fillColor(hexCode(...COLORS.text));
    doc.text(label, PAGE.margin, rowY);
    doc.text(formatCurrency(ticket.service_fee), PAGE.width - PAGE.margin, rowY, { align: 'right' });
    rowY += 4 * MM;
  }

  if (ticket.parts_used && ticket.parts_used.length > 0) {
    ticket.parts_used.forEach((p) => {
      doc.fontSize(7).fillColor(hexCode(...COLORS.text));
      const label = `${p.name} (x${p.qty})`;
      doc.text(label, PAGE.margin, rowY);
      doc.text(formatCurrency(p.subtotal), PAGE.width - PAGE.margin, rowY, { align: 'right' });
      rowY += 3.5 * MM;
    });
  }

  const totalY = rowY + 1.5 * MM;
  doc.moveTo(PAGE.margin, totalY - 1 * MM)
    .lineTo(PAGE.width - PAGE.margin, totalY - 1 * MM)
    .lineWidth(0.5)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();

  doc.fontSize(9).fillColor(hexCode(...COLORS.primary));
  doc.text('TOTAL', PAGE.margin, totalY);
  doc.text(formatCurrency(totalCost), PAGE.width - PAGE.margin, totalY, { align: 'right' });

  const statusY = totalY + 5 * MM;
  const isPaid = ticket.payment_method || totalCost === 0;
  doc.fontSize(7.5);
  if (isPaid) {
    doc.fillColor(hexCode(...COLORS.success));
    doc.text('Status Bayar : LUNAS', PAGE.margin, statusY);
  } else {
    doc.fillColor(hexCode(...COLORS.danger));
    doc.text('Status Bayar : BELUM LUNAS', PAGE.margin, statusY);
  }
}

function addWarrantySection(doc, ticket) {
  const y = doc.y + 2 * MM;
  const expiryDate = ticket.warranty_expires_at
    ? new Date(ticket.warranty_expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '7 hari dari pengambilan';

  doc.fontSize(7).fillColor(hexCode(...COLORS.muted));
  doc.text(`Garansi : 7 Hari (s/d ${expiryDate})`, PAGE.margin, y);
  doc.text('Garansi berlaku untuk jenis kerusakan yang sama.', PAGE.margin, doc.y + 2.5 * MM);
}

function addOrderDetails(doc, order) {
  const y = doc.y + 5 * MM;
  doc.fontSize(7.5).fillColor(hexCode(...COLORS.text));

  doc.text(`No. Order  : ${order.order_number}`, PAGE.margin, y);
  doc.text(`Barang     : ${order.item_name || '-'}`, PAGE.margin, doc.y + 2.5 * MM);

  if (order.item_description) {
    doc.text(`Deskripsi  : ${order.item_description}`, PAGE.margin, doc.y + 2.5 * MM);
  }

  if (order.handled_by && order.handled_by.name) {
    doc.text(`Ditangani  : ${order.handled_by.name}`, PAGE.margin, doc.y + 2.5 * MM);
  }

  if (order.notes) {
    doc.text(`Catatan    : ${order.notes}`, PAGE.margin, doc.y + 2.5 * MM);
  }
}

function addOrderPricing(doc, order) {
  const y = doc.y + 5 * MM;
  const remaining = Math.max(0, (order.estimated_price || 0) - (order.down_payment || 0));

  const lineY = y - 1 * MM;
  doc.moveTo(PAGE.margin, lineY)
    .lineTo(PAGE.width - PAGE.margin, lineY)
    .lineWidth(0.5)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();

  doc.fontSize(8).fillColor(hexCode(...COLORS.accent));
  doc.text('RINCIAN BIAYA', PAGE.margin, y);

  let rowY = doc.y + 2 * MM;

  const price = order.estimated_price || 0;
  doc.fontSize(7.5).fillColor(hexCode(...COLORS.text));
  doc.text('Estimasi Harga', PAGE.margin, rowY);
  doc.text(formatCurrency(price), PAGE.width - PAGE.margin, rowY, { align: 'right' });
  rowY += 4 * MM;

  const dp = order.down_payment || 0;
  doc.fontSize(7.5).fillColor(hexCode(...COLORS.success));
  doc.text('DP Dibayar', PAGE.margin, rowY);
  doc.text(formatCurrency(dp), PAGE.width - PAGE.margin, rowY, { align: 'right' });
  rowY += 4 * MM;

  doc.moveTo(PAGE.margin, rowY - 1.5 * MM)
    .lineTo(PAGE.width - PAGE.margin, rowY - 1.5 * MM)
    .lineWidth(0.5)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();

  doc.fontSize(9).fillColor(hexCode(...COLORS.primary));
  doc.text('Sisa Bayar', PAGE.margin, rowY);
  doc.text(formatCurrency(remaining), PAGE.width - PAGE.margin, rowY, { align: 'right' });

  const statusY = rowY + 5 * MM;
  doc.fontSize(7.5);
  if (order.payment_status === 'Lunas') {
    doc.fillColor(hexCode(...COLORS.success));
    doc.text('Status Bayar : LUNAS', PAGE.margin, statusY);
  } else {
    doc.fillColor(hexCode(...COLORS.warning));
    doc.text('Status Bayar : BELUM LUNAS', PAGE.margin, statusY);
    doc.fillColor(hexCode(...COLORS.danger));
    doc.text(`Sisa Bayar   : ${formatCurrency(remaining)}`, PAGE.margin, doc.y + 2.5 * MM);
  }
}

function addQRCode(doc, qrBuffer) {
  const y = Math.min(doc.y + 4 * MM, PAGE.height - 45 * MM);
  const qrSize = 16 * MM;

  doc.image(qrBuffer, PAGE.margin + CONTENT_WIDTH / 2 - qrSize / 2, y, {
    width: qrSize,
    height: qrSize,
  });

  doc.fontSize(5.5).fillColor(hexCode(...COLORS.muted));
  doc.text('Scan untuk verifikasi nota', PAGE.margin, y + qrSize + 1 * MM, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
}

function addFooter(doc) {
  const y = PAGE.height - 12 * MM;
  doc.fontSize(7).fillColor(hexCode(...COLORS.muted));
  doc.text('Terima kasih telah menggunakan jasa kami.', PAGE.margin, y, {
    width: CONTENT_WIDTH,
    align: 'center',
  });

  doc.fontSize(6.5).fillColor(hexCode(...COLORS.muted));
  doc.text('Salam hangat, Tim Unida Technology Centre', PAGE.margin, doc.y + 2 * MM, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

module.exports = { generateServiceNota, generateOrderNota };
