const nodemailer = require('nodemailer');
const SystemLog = require('../models/SystemLog');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Kirim nota servis via email
 * @param {Object} ticket 
 */
const sendInvoiceEmail = async (ticket) => {
  if (!ticket.customer.email) return;

  try {
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="text-align: center; color: #0d6efd;">Nota Servis Bengkel UTC</h2>
        <hr>
        <p>Halo <strong>${ticket.customer.name}</strong>,</p>
        <p>Perbaikan perangkat Anda telah selesai. Berikut adalah ringkasan servis Anda:</p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 0;"><strong>No. Tiket:</strong></td>
            <td>#${ticket.ticket_number}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Perangkat:</strong></td>
            <td>${ticket.device.brand} ${ticket.device.model}</td>
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
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${part.name} (x${part.qty})</td>
                <td style="text-align: right; padding: 8px; border-bottom: 1px solid #eee;">Rp ${part.subtotal.toLocaleString('id-ID')}</td>
              </tr>
            `).join('')}
            <tr>
              <td style="padding: 8px; font-weight: bold;">Biaya Jasa</td>
              <td style="text-align: right; padding: 8px; font-weight: bold;">Rp ${ticket.service_fee.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: #e9ecef;">
              <td style="padding: 10px; font-weight: bold; font-size: 1.1em;">Grand Total</td>
              <td style="text-align: right; padding: 10px; font-weight: bold; font-size: 1.1em;">Rp ${ticket.total_cost.toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="margin-top: 30px; text-align: center; font-size: 0.9em; color: #666;">
          <p>Terima kasih telah mempercayakan perbaikan perangkat Anda kepada kami.</p>
          <p><strong>Bengkel UTC - Unida Technology Centre</strong></p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: '"Bengkel UTC" <noreply@utc.com>',
      to: ticket.customer.email,
      subject: `Nota Servis #${ticket.ticket_number} - Bengkel UTC`,
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
