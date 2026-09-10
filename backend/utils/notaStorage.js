const path = require('path');
const fs = require('fs').promises;

const NOTA_DIR = path.join(__dirname, '..', 'uploads', 'notas');

async function saveNota(buffer, type, ticketNumber, customerName, options = {}) {
  const date = new Date().toISOString().split('T')[0];
  const safeName = String(customerName || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').substring(0, 30) || 'Unknown';
  // Bedakan file entry vs payment dan status bayar agar tidak saling menimpa.
  // Format: NOTA-{SVC|ORD}-{nomor}-{ENTRY|PAYMENT}-{LUNAS|BELUM}_{nama}_{YYYY-MM-DD}.pdf
  const kind = String(options.kind || 'PAYMENT').toUpperCase() === 'ENTRY' ? 'ENTRY' : 'PAYMENT';
  const paid = options.isPaid === true || String(options.paymentStatus || '').toLowerCase() === 'lunas';
  const statusTag = kind === 'ENTRY' ? 'ENTRY' : (paid ? 'LUNAS' : 'BELUM');
  const safeTicket = String(ticketNumber || 'UNKNOWN').replace(/[^a-zA-Z0-9-]/g, '');
  const stamp = Date.now().toString().slice(-6);
  const filename = `NOTA-${type}-${safeTicket}-${kind}-${statusTag}_${safeName}_${date}-${stamp}.pdf`;
  const filePath = path.join(NOTA_DIR, filename);

  await fs.mkdir(NOTA_DIR, { recursive: true });
  await fs.writeFile(filePath, buffer);

  const fileUrl = `/uploads/notas/${filename}`;
  return { filename, filePath, fileUrl };
}

module.exports = { saveNota };
