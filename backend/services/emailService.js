const nodemailer = require('nodemailer');
const SystemLog = require('../models/SystemLog');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendMailWithRetry(mailOptions, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      return;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.warn(`[Email] Gagal mengirim (percobaan ${attempt}/${maxRetries}), mencoba lagi dalam ${delayMs/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Kirim nota servis via email
 * @param {Object} ticket 
 */
const sendInvoiceEmail = async (ticket) => {
  if (!ticket.customer.email) {
    await SystemLog.create({
      level: 'WARN',
      source: 'EmailService',
      message: 'Email tidak dikirim: pelanggan tidak memiliki alamat email',
      details: { ticket_id: ticket._id, customer: ticket.customer?.name }
    });
    return;
  }

  try {
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="text-align: center; color: #0d6efd;">Nota Servis Bengkel UTC</h2>
        <hr>
        <p>Halo <strong>${escapeHtml(ticket.customer.name)}</strong>,</p>
        <p>Perbaikan perangkat Anda telah selesai. Berikut adalah ringkasan servis Anda:</p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 0;"><strong>No. Tiket:</strong></td>
            <td>#${escapeHtml(ticket.ticket_number)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Perangkat:</strong></td>
            <td>${escapeHtml(ticket.device.brand)} ${escapeHtml(ticket.device.model)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Status:</strong></td>
            <td>Selesai (Completed)</td>
          </tr>
        </table>
        
        <h3 style="margin-top: 20px;">Rincian Biaya:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Deskripsi</th>
              <th style="text-align: right; padding: 8px; border-bottom: 1px solid #ddd;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${ticket.parts_used.map(part => `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(part.name)} (x${part.qty})</td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">Rp ${escapeHtml(part.subtotal.toLocaleString('id-ID'))}</td>
              </tr>
            `).join('')}
            <tr>
              <td style="padding: 8px; font-weight: bold;">Biaya Jasa</td>
              <td style="text-align: right; padding: 8px; font-weight: bold;">Rp ${escapeHtml(ticket.service_fee.toLocaleString('id-ID'))}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: #e9ecef;">
              <td style="padding: 10px; font-weight: bold; font-size: 1.1em;">Grand Total</td>
              <td style="text-align: right; padding: 10px; font-weight: bold; font-size: 1.1em;">Rp ${escapeHtml(ticket.total_cost.toLocaleString('id-ID'))}</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="margin-top: 30px; text-align: center; font-size: 0.9em; color: #666;">
          <p>Terima kasih telah mempercayakan perbaikan perangkat Anda kepada kami.</p>
          <p><strong>Bengkel UTC - Unida Technology Centre</strong></p>
        </div>
      </div>
    `;

    await sendMailWithRetry({
      from: '"Bengkel UTC" <noreply@utc.com>',
      to: ticket.customer.email,
      subject: `Nota Servis #${escapeHtml(ticket.ticket_number)} - Bengkel UTC`,
      html: htmlContent
    });

    console.log(`✅ Email nota terkirim ke: ${ticket.customer.email}`);
  } catch (error) {
    console.error('❌ Gagal mengirim email:', error);
    await SystemLog.create({
      level: 'ERROR',
      source: 'EmailService',
      message: 'Gagal mengirim email nota',
      details: { ticket_id: ticket._id, error: error.message }
    });
  }
};

module.exports = { sendInvoiceEmail };
