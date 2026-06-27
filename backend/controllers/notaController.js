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
    let pdfBuffer;
    if (type === 'entry') {
      pdfBuffer = await pdfService.generateServiceEntryNota(ticket);
    } else {
      pdfBuffer = await pdfService.generateServiceNota(ticket);
    }

    const filename = `NOTA-SVC-${ticket.ticket_number}_${(ticket.customer.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
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
    let pdfBuffer;
    if (type === 'entry') {
      pdfBuffer = await pdfService.generateOrderEntryNota(order);
    } else {
      pdfBuffer = await pdfService.generateOrderNota(order);
    }

    const filename = `NOTA-ORD-${order.order_number}_${(order.customer.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
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
 * Format: NOTA-{SVC|ORD}-{nomor}_{nama}_{YYYY-MM-DD}.pdf
 */
function parseFilename(filename) {
  const base = filename.replace('.pdf', '');
  const parts = base.split('_');

  const typePrefix = parts[0] || '';        // NOTA-SVC-001234 or NOTA-ORD-2026-0001
  const customerName = parts.slice(1, -1).join(' ') || '-';
  const dateStr = parts[parts.length - 1] || '';

  const type = typePrefix.startsWith('NOTA-SVC') ? 'Servis' : 'Pesanan';
  const ticketNumber = typePrefix.replace('NOTA-SVC-', '').replace('NOTA-ORD-', '');

  return { type, ticketNumber, customerName, date: dateStr };
}
