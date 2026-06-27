const path = require('path');
const fs = require('fs').promises;

const NOTA_DIR = path.join(__dirname, '..', 'uploads', 'notas');

async function saveNota(buffer, type, ticketNumber, customerName) {
  const date = new Date().toISOString().split('T')[0];
  const safeName = customerName.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').substring(0, 30);
  const filename = `NOTA-${type}-${ticketNumber}_${safeName}_${date}.pdf`;
  const filePath = path.join(NOTA_DIR, filename);

  await fs.mkdir(NOTA_DIR, { recursive: true });
  await fs.writeFile(filePath, buffer);

  const fileUrl = `/uploads/notas/${filename}`;
  return { filename, filePath, fileUrl };
}

module.exports = { saveNota };
