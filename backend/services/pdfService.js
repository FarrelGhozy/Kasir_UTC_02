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

  doc.font('Helvetica-Bold').fontSize(11).fillColor(hexCode(...COLORS.primary));
  doc.text('UNIDA TECHNOLOGY CENTRE', PAGE.margin + logoSize + 3 * MM, y + 1 * MM, {
    width: CONTENT_WIDTH - logoSize - 3 * MM,
    align: 'left',
  });

  doc.font('Helvetica').fontSize(7.5).fillColor(hexCode(...COLORS.muted));
  doc.text('Gedung Zubair Ruangan 205', PAGE.margin + logoSize + 3 * MM, y + 5 * MM);
  doc.text('+62 821-5661-4855 (admin Kantor)', PAGE.margin + logoSize + 3 * MM, y + 8 * MM);

  const lineY = y + logoSize + 3 * MM;
  doc.moveTo(PAGE.margin, lineY)
    .lineTo(PAGE.width - PAGE.margin, lineY)
    .lineWidth(0.8)
    .strokeColor(hexCode(...COLORS.primary))
    .stroke();

  doc.font('Helvetica-Bold').fontSize(14).fillColor(hexCode(...COLORS.primary));
  doc.text(title, PAGE.margin, lineY + 2 * MM, { width: CONTENT_WIDTH, align: 'center' });
}

function addCustomerSection(doc, customer) {
  const y = doc.y + 3 * MM;
  const leftX = PAGE.margin;
  const rightX = PAGE.margin + CONTENT_WIDTH / 2;
  const fontSize = 7.5;
  const color = hexCode(...COLORS.text);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('Pelanggan', leftX, y, { continued: true });
  doc.font('Helvetica').text(`  : ${customer.name || '-'}`);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('No. HP', leftX, doc.y + 2.5 * MM, { continued: true });
  doc.font('Helvetica').text(`     : ${customer.phone || '-'}`);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('Tipe', leftX, doc.y + 2.5 * MM, { continued: true });
  doc.font('Helvetica').text(`       : ${customer.type || '-'}`);

  doc.y = y;
  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('Tanggal', rightX, y, { continued: true });
  doc.font('Helvetica').text(`    : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);
}

function addServiceDetails(doc, ticket) {
  const y = doc.y + 5 * MM;
  const fontSize = 7.5;
  const color = hexCode(...COLORS.text);
  const x = PAGE.margin;

  const deviceName = [ticket.device.type, ticket.device.brand, ticket.device.model].filter(Boolean).join(' ');

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('No. Tiket', x, y, { continued: true });
  doc.font('Helvetica').text(`  : ${ticket.ticket_number}`);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('Perangkat', x, doc.y + 2.5 * MM, { continued: true });
  doc.font('Helvetica').text(`  : ${deviceName || '-'}`);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('Serial No', x, doc.y + 2.5 * MM, { continued: true });
  doc.font('Helvetica').text(`  : ${ticket.device.serial_number || '-'}`);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('Keluhan', x, doc.y + 2.5 * MM, { continued: true });
  doc.font('Helvetica').text(`    : ${ticket.device.symptoms || '-'}`);

  if (ticket.technician && ticket.technician.name) {
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
    doc.text('Teknisi', x, doc.y + 2.5 * MM, { continued: true });
    doc.font('Helvetica').text(`    : ${ticket.technician.name}`);
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

  doc.font('Helvetica-Bold').fontSize(8).fillColor(hexCode(...COLORS.accent));
  doc.text('RINCIAN BIAYA', PAGE.margin, y, { underline: false });

  let rowY = doc.y + 2 * MM;

  if (ticket.service_fee > 0) {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(hexCode(...COLORS.text));
    doc.text('Jasa Servis', PAGE.margin, rowY);
    doc.font('Helvetica').text(formatCurrency(ticket.service_fee), PAGE.margin, rowY, { width: CONTENT_WIDTH, align: 'right' });
    rowY += 4 * MM;
  }

  if (ticket.parts_used && ticket.parts_used.length > 0) {
    ticket.parts_used.forEach((p) => {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(hexCode(...COLORS.text));
      doc.text(`${p.name} (x${p.qty})`, PAGE.margin, rowY);
      doc.font('Helvetica').text(formatCurrency(p.subtotal), PAGE.margin, rowY, { width: CONTENT_WIDTH, align: 'right' });
      rowY += 3.5 * MM;
    });
  }

  const totalY = rowY + 1.5 * MM;
  doc.moveTo(PAGE.margin, totalY - 1 * MM)
    .lineTo(PAGE.width - PAGE.margin, totalY - 1 * MM)
    .lineWidth(0.5)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor(hexCode(...COLORS.primary));
  doc.text('TOTAL', PAGE.margin, totalY);
  doc.font('Helvetica').text(formatCurrency(totalCost), PAGE.margin, totalY, { width: CONTENT_WIDTH, align: 'right' });

  const statusY = totalY + 5 * MM;
  const isPaid = ticket.payment_method || totalCost === 0;
  doc.font('Helvetica-Bold').fontSize(7.5);
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

  doc.font('Helvetica-Bold').fontSize(7).fillColor(hexCode(...COLORS.muted));
  doc.text('Garansi', PAGE.margin, y, { continued: true });
  doc.font('Helvetica').text(` : 7 Hari (s/d ${expiryDate})`);
  doc.text('Garansi berlaku untuk jenis kerusakan yang sama.', PAGE.margin, doc.y + 2.5 * MM);
}

function addOrderDetails(doc, order) {
  const y = doc.y + 5 * MM;
  const fontSize = 7.5;
  const color = hexCode(...COLORS.text);
  const x = PAGE.margin;

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('No. Order', x, y, { continued: true });
  doc.font('Helvetica').text(`  : ${order.order_number}`);

  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
  doc.text('Barang', x, doc.y + 2.5 * MM, { continued: true });
  doc.font('Helvetica').text(`     : ${order.item_name || '-'}`);

  if (order.item_description) {
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
    doc.text('Deskripsi', x, doc.y + 2.5 * MM, { continued: true });
    doc.font('Helvetica').text(`  : ${order.item_description}`);
  }

  if (order.handled_by && order.handled_by.name) {
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
    doc.text('Ditangani', x, doc.y + 2.5 * MM, { continued: true });
    doc.font('Helvetica').text(`  : ${order.handled_by.name}`);
  }

  if (order.notes) {
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(color);
    doc.text('Catatan', x, doc.y + 2.5 * MM, { continued: true });
    doc.font('Helvetica').text(`    : ${order.notes}`);
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

  doc.font('Helvetica-Bold').fontSize(8).fillColor(hexCode(...COLORS.accent));
  doc.text('RINCIAN BIAYA', PAGE.margin, y);

  let rowY = doc.y + 2 * MM;

  const price = order.estimated_price || 0;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(hexCode(...COLORS.text));
  doc.text('Estimasi Harga', PAGE.margin, rowY);
  doc.font('Helvetica').text(formatCurrency(price), PAGE.margin, rowY, { width: CONTENT_WIDTH, align: 'right' });
  rowY += 4 * MM;

  const dp = order.down_payment || 0;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(hexCode(...COLORS.success));
  doc.text('DP Dibayar', PAGE.margin, rowY);
  doc.font('Helvetica').text(formatCurrency(dp), PAGE.margin, rowY, { width: CONTENT_WIDTH, align: 'right' });
  rowY += 4 * MM;

  doc.moveTo(PAGE.margin, rowY - 1.5 * MM)
    .lineTo(PAGE.width - PAGE.margin, rowY - 1.5 * MM)
    .lineWidth(0.5)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();

  doc.font('Helvetica-Bold').fontSize(9).fillColor(hexCode(...COLORS.primary));
  doc.text('Sisa Bayar', PAGE.margin, rowY);
  doc.font('Helvetica').text(formatCurrency(remaining), PAGE.margin, rowY, { width: CONTENT_WIDTH, align: 'right' });

  const statusY = rowY + 5 * MM;
  doc.font('Helvetica-Bold').fontSize(7.5);
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

  doc.font('Helvetica').fontSize(5.5).fillColor(hexCode(...COLORS.muted));
  doc.text('Scan untuk verifikasi nota', PAGE.margin, y + qrSize + 1 * MM, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
}

function addFooter(doc) {
  const y = PAGE.height - 12 * MM;
  doc.font('Helvetica').fontSize(7).fillColor(hexCode(...COLORS.muted));
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

async function generateServiceEntryNota(ticket) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE.width, PAGE.height],
        layout: 'portrait',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Nota Masuk Servis - ${ticket.ticket_number}`,
          Author: 'UNIDA Technology Centre',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const qrContent = `UTC-VERIFY:ServiceTicket:${ticket._id}:${ticket.ticket_number}`;
      const qrBuffer = await QRCode.toBuffer(qrContent, {
        type: 'png', width: 200, margin: 1,
        color: { dark: '#293e85', light: '#ffffff00' },
      });

      addWatermark(doc);
      addBorder(doc);
      addHeader(doc, 'NOTA TANDA TERIMA');
      addCustomerSection(doc, ticket.customer);
      addServiceDetails(doc, ticket);
      addEntryDisclaimer(doc, ticket);
      addTCSection(doc);
      addQRCodeEntry(doc, qrBuffer);
      addFooter(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function generateOrderEntryNota(order) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE.width, PAGE.height],
        layout: 'portrait',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Nota Masuk Pesanan - ${order.order_number}`,
          Author: 'UNIDA Technology Centre',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const qrContent = `UTC-VERIFY:SpecialOrder:${order._id}:${order.order_number}`;
      const qrBuffer = await QRCode.toBuffer(qrContent, {
        type: 'png', width: 200, margin: 1,
        color: { dark: '#293e85', light: '#ffffff00' },
      });

      addWatermark(doc);
      addBorder(doc);
      addHeader(doc, 'NOTA TANDA TERIMA');
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

function addEntryDisclaimer(doc, ticket) {
  const y = doc.y + 3 * MM;

  if (ticket.service_fee && ticket.service_fee > 0) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor(hexCode(...COLORS.muted));
    doc.text('Estimasi Biaya Jasa', PAGE.margin, y, { continued: true });
    doc.font('Helvetica').text(` : ${formatCurrency(ticket.service_fee)}`);
    doc.fontSize(5.5).fillColor(hexCode(...COLORS.danger));
    doc.text('* Estimasi dapat berubah sesuai kondisi perangkat yang ditemukan saat diagnosa.', PAGE.margin, doc.y + 1.5 * MM);
  } else {
    doc.font('Helvetica').fontSize(6.5).fillColor(hexCode(...COLORS.muted));
    doc.text('Biaya akan diinformasikan setelah proses diagnosa selesai.', PAGE.margin, y);
    doc.fontSize(5.5).fillColor(hexCode(...COLORS.danger));
    doc.text('* Biaya dapat berubah sesuai kondisi perangkat yang ditemukan.', PAGE.margin, doc.y + 1.5 * MM);
  }
}

function addTCSection(doc) {
  const y = doc.y + 2.5 * MM;
  const lineY = y - 1 * MM;
  doc.moveTo(PAGE.margin, lineY)
    .lineTo(PAGE.width - PAGE.margin, lineY)
    .lineWidth(0.5)
    .strokeColor(hexCode(...COLORS.border))
    .stroke();

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(hexCode(...COLORS.accent));
  doc.text('SYARAT DAN KETENTUAN', PAGE.margin, y + 0.5 * MM);

  const terms = [
    'Nota ini wajib dibawa saat pengambilan Unit Perangkat Elektronik yang diperbaiki/diservis. Pengambilan tanpa nota dengan alasan apapun tidak akan dilayani oleh pihak UTC.',
    'Perangkat Elektronik yang diperbaiki/diservis, bila ternyata bertambah jenis kerusakan di luar kesepakatan awal, akan dikenakan biaya tambahan dengan melakukan konfirmasi terlebih dahulu kepada Konsumen.',
    'Apabila setelah pengecekan kerusakan ditemukan dan konsumen memutuskan untuk membatalkan perbaikan, maka akan dikenakan Biaya Pengecekan/Diagnosa sebesar Rp20.000 untuk semua perangkat Elektronik.',
    'Pihak UTC tidak bertanggung jawab atas hilangnya data Konsumen untuk semua jenis kerusakan software dan mesin atau kerusakan fisik lainnya yang berdampak pada media penyimpanan.',
    'UTC tidak bertanggung jawab atas legalitas software/sistem operasi yang terinstall di perangkat konsumen.',
    'Untuk kabar perbaikan customer akan dikabarkan setelah 3 hari.',
    'Pengambilan barang servis hanya dapat dilakukan di hari kerja, Sabtu-Kamis pada pukul 08.00 - 15.00.',
    'Masa garansi berlaku mulai dari tanggal pengambilan Perangkat Elektronik dengan ketentuan: Garansi berlaku untuk jenis kerusakan yang sama, Masa garansi Servis 7 Hari, Garansi Suku Cadang/Hardware berlaku sesuai ketentuan distributor (14-30 hari) dengan syarat fisik tidak cacat.',
    'Garansi tidak berlaku apabila: Mengubah isi nota, Segel garansi hilang atau rusak, Kesalahan pengguna yang tidak semestinya.',
    'Konsumen setuju bahwa proses pembongkaran pada perangkat tertentu memiliki risiko lecet, retak rambut pada casing, atau hilangnya fitur ketahanan air (waterproof).',
    'Apabila perangkat tidak diambil dalam waktu 30 hari setelah pemberitahuan, akan dikenakan Biaya Penyimpanan Rp2.000/hari setelah 15 hari keterlambatan.',
    'Pihak UTC berhak melakukan Lelang/Penjualan Perangkat jika tidak diambil dalam waktu 90 hari sejak batas waktu pemberitahuan.',
  ];

  let rowY = doc.y + 1.5 * MM;
  doc.font('Helvetica').fontSize(5.5).fillColor(hexCode(...COLORS.text));
  terms.forEach((t, i) => {
    doc.text(`${i + 1}. ${t}`, PAGE.margin, rowY, { width: CONTENT_WIDTH });
    rowY = doc.y + 1 * MM;
    doc.y = rowY;
  });
}

function addQRCodeEntry(doc, qrBuffer) {
  const y = Math.min(doc.y + 2 * MM, PAGE.height - 40 * MM);
  const qrSize = 14 * MM;

  doc.image(qrBuffer, PAGE.margin + CONTENT_WIDTH / 2 - qrSize / 2, y, {
    width: qrSize, height: qrSize,
  });

  doc.font('Helvetica').fontSize(5).fillColor(hexCode(...COLORS.muted));
  doc.text('Scan untuk verifikasi nota', PAGE.margin, y + qrSize + 1 * MM, {
    width: CONTENT_WIDTH, align: 'center',
  });
  doc.y = y + qrSize + 3 * MM;
}

module.exports = { generateServiceNota, generateOrderNota, generateServiceEntryNota, generateOrderEntryNota };
