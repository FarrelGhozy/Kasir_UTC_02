const fs = require('fs');
const path = require('path');

const NOTA_DIR = path.join(__dirname, '..', 'uploads', 'notas');

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
