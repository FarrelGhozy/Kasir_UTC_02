const fs = require('fs');
const path = require('path');
const pdfService = require('../services/pdfService');
const ServiceTicket = require('../models/ServiceTicket');
const SpecialOrder = require('../models/SpecialOrder');

const NOTA_DIR = path.join(__dirname, '..', 'uploads', 'notas');

/**
 * @desc    Download PDF Nota Servis (entry atau payment)
 * @route   GET /api/services/:id/nota?type=entry|payment
 * @access  Private (semua role)
 */
exports.downloadServiceNota = async (req, res, next) => {
  try {
    const ticket = await ServiceTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });
    }

    const type = req.query.type || 'payment';
    if (type !== 'entry' && type !== 'payment') {
      return res.status(400).json({ success: false, message: "Parameter type tidak valid. Gunakan 'entry' atau 'payment'" });
    }
    let pdfBuffer;
    if (type === 'entry') {
      pdfBuffer = await pdfService.generateServiceEntryNota(ticket);
    } else {
      pdfBuffer = await pdfService.generateServiceNota(ticket);
    }

    const filename = `NOTA-SVC-${ticket.ticket_number}_${((ticket.customer && ticket.customer.name) || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download PDF Nota Pesanan (entry atau payment)
 * @route   GET /api/orders/:id/nota?type=entry|payment
 * @access  Private (semua role)
 */
exports.downloadOrderNota = async (req, res, next) => {
  try {
    const order = await SpecialOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
    }

    const type = req.query.type || 'payment';
    if (type !== 'entry' && type !== 'payment') {
      return res.status(400).json({ success: false, message: "Parameter type tidak valid. Gunakan 'entry' atau 'payment'" });
    }
    let pdfBuffer;
    if (type === 'entry') {
      pdfBuffer = await pdfService.generateOrderEntryNota(order);
    } else {
      pdfBuffer = await pdfService.generateOrderNota(order);
    }

    const filename = `NOTA-ORD-${order.order_number}_${((order.customer && order.customer.name) || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mendaftar semua file nota digital
 * @route   GET /api/notas
 * @access  Private (semua role)
 */
exports.listNotas = async (req, res, next) => {
  try {
    if (!fs.existsSync(NOTA_DIR)) {
      return res.status(200).json({ success: true, data: [] });
    }

    const files = fs.readdirSync(NOTA_DIR)
      .filter(f => f.endsWith('.pdf'))
      .sort()
      .reverse();

    const notas = files.map(filename => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const parsed = parseFilename(filename);
      return {
        filename,
        url: `${baseUrl}/uploads/notas/${filename}`,
        ...parsed
      };
    });

    res.status(200).json({ success: true, data: notas });
  } catch (error) {
    next(error);
  }
};

/**
 * Parse nama file nota menjadi metadata terstruktur
 * Format baru: NOTA-{SVC|ORD}-{nomor}-{ENTRY|PAYMENT}-{ENTRY|LUNAS|BELUM}_{nama}_{YYYY-MM-DD}-{stamp}.pdf
 * Format lama: NOTA-{SVC|ORD}-{nomor}_{nama}_{YYYY-MM-DD}.pdf (tetap didukung)
 */
function parseFilename(filename) {
  const base = filename.replace('.pdf', '');
  const parts = base.split('_');

  const typePrefix = parts[0] || '';        // NOTA-SVC-... atau NOTA-ORD-...
  const customerName = parts.slice(1, -1).join(' ') || '-';
  const datePart = parts[parts.length - 1] || '';
  const dateStr = datePart.split('-').slice(0, 3).join('-');

  const type = typePrefix.startsWith('NOTA-SVC') ? 'Servis' : 'Pesanan';
  const withoutPrefix = typePrefix.replace('NOTA-SVC-', '').replace('NOTA-ORD-', '');
  const segments = withoutPrefix.split('-');

  // Deteksi suffix KIND dan STATUS dari belakang nomor
  let kind = 'Payment';
  let paymentStatus = '-';
  const statusTags = ['LUNAS', 'BELUM', 'ENTRY'];
  const kindTags = ['ENTRY', 'PAYMENT'];
  const rest = [...segments];
  if (rest.length > 0 && statusTags.includes(rest[rest.length - 1])) {
    const tag = rest.pop();
    if (tag === 'LUNAS') paymentStatus = 'Lunas';
    else if (tag === 'BELUM') paymentStatus = 'Belum Lunas';
    else if (tag === 'ENTRY') paymentStatus = '-';
  }
  if (rest.length > 0 && kindTags.includes(rest[rest.length - 1])) {
    kind = rest.pop() === 'ENTRY' ? 'Entry' : 'Payment';
  }
  const ticketNumber = rest.join('-');

  return { type, ticketNumber, customerName, date: dateStr, kind, paymentStatus };
}
