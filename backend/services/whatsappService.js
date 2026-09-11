const axios = require('axios');
const path = require('path');
const SystemLog = require('../models/SystemLog');
const pdfService = require('./pdfService');
const { saveNota } = require('../utils/notaStorage');
const { normalizeIDPhone } = require('../utils/phone');
const {
  getServiceTotal,
  getServicePaymentStatus,
  getOrderRemaining,
  getOrderPaymentStatus
} = require('../utils/paymentStatus');

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:5000';

// TTL cache hasil cek WA (5 menit, sesuai kesepakatan) dan status session (30 detik).
// Cache in-memory per proses — cukup untuk satu instance backend; tidak perlu dep baru.
const WA_CHECK_TTL_MS = 5 * 60 * 1000;
const WA_SESSION_TTL_MS = 30 * 1000;
const waCheckCache = new Map(); // key: nomor ternormalisasi -> { result, expiresAt }
let waSessionCache = { result: null, expiresAt: 0 };

function getCachedCheck(cleanPhone) {
  const entry = waCheckCache.get(cleanPhone);
  if (entry && entry.expiresAt > Date.now()) return entry.result;
  waCheckCache.delete(cleanPhone);
  return null;
}

function setCachedCheck(cleanPhone, result) {
  waCheckCache.set(cleanPhone, { result, expiresAt: Date.now() + WA_CHECK_TTL_MS });
  // Batasi ukuran cache agar tidak tumbuh tanpa batas
  if (waCheckCache.size > 500) {
    const oldest = waCheckCache.keys().next().value;
    waCheckCache.delete(oldest);
  }
}

/**
 * Reset cache WA (dipakai unit test agar deterministik).
 */
function clearWACache() {
  waCheckCache.clear();
  waSessionCache = { result: null, expiresAt: 0 };
}

/**
 * Format tanggal masuk tiket ke Bahasa Indonesia (aman untuk nilai kosong/invalid)
 * @param {Date|string} date
 * @returns {string}
 */
function formatTanggalMasukID(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * WhatsApp Service using WAHA (WhatsApp HTTP API)
 */
class WhatsAppService {
  constructor() {
    // URL WAHA di dalam network docker adalah http://waha:8000
    // Jika diakses dari luar docker (saat development) gunakan http://localhost:8000
    this.baseURL = process.env.WAHA_URL;
    this.session = process.env.WAHA_SESSION || 'default';
    this.apiKey = process.env.WAHA_API_KEY;
  }

  /**
   * Mengirim pesan teks ke nomor tertentu
   * @param {string} phone Nomor HP (format: 08xx atau 628xx)
   * @param {string} message Isi pesan
   */
  async sendMessage(phone, message) {
    try {
      // Bersihkan nomor HP agar sesuai format WAHA (628xxxxxxxx@c.us)
      let cleanPhone = phone.toString().replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }
      
      // Pastikan format chatId benar (628... tanpa @c.us jika engine tertentu, tapi WEBJS butuh @c.us)
      const chatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

      const url = `${this.baseURL}/api/sendText`;
      const data = {
        chatId: chatId,
        text: message,
        session: this.session
      };

      const config = {
        headers: {
          'X-Api-Key': this.apiKey
        },
        timeout: 15000 // Beri waktu 15 detik
      };

      console.log(`[WhatsApp] Mencoba mengirim ke ${chatId}...`);
      
      const response = await axios.post(url, data, config);
      console.log(`[WhatsApp] Sukses kirim ke ${chatId}.`);
      return { success: true, data: response.data };
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.message || errorData?.error || error.message;
      
      console.error(`[WhatsApp] Gagal mengirim ke ${phone}:`, errorMessage);
      
      // Catat kegagalan ke Log Sistem
      SystemLog.create({
        level: 'ERROR',
        source: 'WhatsAppService',
        message: `Gagal kirim pesan ke ${phone}`,
        details: { 
          error: errorMessage, 
          status: error.response?.status,
          response: errorData,
          target: phone
        }
      }).catch(err => console.error('Gagal simpan log WA:', err));

      return { success: false, error: errorMessage, status: error.response?.status };
    }
  }

  /**
   * Mengirim dokumen (PDF) ke nomor tertentu via WAHA
   * @param {string} phone Nomor HP
   * @param {string} fileUrl URL publik file PDF
   * @param {string} caption Pesan teks pendamping
   */
  async sendDocument(phone, fileUrl, caption) {
    try {
      let cleanPhone = phone.toString().replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }
      const chatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

      const url = `${this.baseURL}/api/sendFile`;
      const data = {
        chatId: chatId,
        file: { url: fileUrl },
        caption: caption || '',
        session: this.session
      };

      const config = {
        headers: { 'X-Api-Key': this.apiKey },
        timeout: 30000
      };

      console.log(`[WhatsApp] Mencoba kirim dokumen ke ${chatId}...`);
      const response = await axios.post(url, data, config);
      console.log(`[WhatsApp] Sukses kirim dokumen ke ${chatId}.`);
      return { success: true, data: response.data };
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.message || errorData?.error || error.message;
      console.error(`[WhatsApp] Gagal kirim dokumen ke ${phone}:`, errorMessage);

      SystemLog.create({
        level: 'ERROR',
        source: 'WhatsAppService',
        message: `Gagal kirim dokumen ke ${phone}`,
        details: { error: errorMessage, status: error.response?.status, target: phone }
      }).catch(err => console.error('Gagal simpan log WA:', err));

      return { success: false, error: errorMessage, status: error.response?.status };
    }
  }

  /**
   * Helper untuk memberikan jeda waktu (delay)
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mengirim 3 pesan berurutan untuk Tiket Servis Baru
   */
  async sendServiceWelcomeMessages(ticket) {
    try {
      const phone = ticket.customer.phone;
      if (!phone) return;

      // Cek status session dulu sebelum kirim sekuense panjang
      const status = await this.checkSessionStatus();
      if (status.status !== 'WORKING') {
        console.warn(`[WhatsApp] Session ${this.session} tidak WORKING (Status: ${status.status}). Sekuense pesan dibatalkan.`);
        return;
      }

      const deviceName = `${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}`.trim();
      const tanggalMasuk = formatTanggalMasukID(ticket.history && ticket.history.created_at);

      // 1. Pesan Greeting
      const msg1 = `Halo Kak ${ticket.customer.name}, selamat datang di Bengkel UTC! 👋 Terima kasih telah mempercayakan perbaikan/pemesanan perangkat Anda kepada kami.`;
      await this.sendMessage(phone, msg1);
      
      await this.delay(2500); // Jeda 2.5 detik

      // 2. Pesan Status
      const msg2 = `Berikut adalah informasi perangkat Anda:
*No. Tiket/Pesanan: ${ticket.ticket_number}
*Perangkat: ${deviceName}
*Tanggal Masuk: ${tanggalMasuk}
Status Saat Ini: Menunggu Antrian ⏳`;
      await this.sendMessage(phone, msg2);

      await this.delay(2500); // Jeda 2.5 detik

      // 3. Pesan Nota Digital & Syarat Ketentuan
      const msg3 = `📋 *SYARAT & KETENTUAN* 📋

Seluruh Syarat & Ketentuan layanan servis telah tercantum lengkap di *Nota Digital* yang kami kirimkan bersama pesan ini.

Silakan simpan nota tersebut sebagai bukti registrasi yang sah.

Terima kasih telah mempercayakan perangkat Anda kepada kami. 🙏`;
      
      await this.sendMessage(phone, msg3);

      await this.delay(2000);

      // 4. Kirim PDF Nota Masuk
      try {
        const pdfResult = await pdfService.generateServiceEntryNota(ticket);
        const { fileUrl } = await saveNota(
          pdfResult,
          'SVC',
          ticket.ticket_number,
          ticket.customer.name,
          { kind: 'ENTRY', isPaid: false, paymentStatus: getServicePaymentStatus(ticket) }
        );
        const fullUrl = `${BACKEND_URL}${fileUrl}`;
        const caption = `Nota Registrasi Servis - ${ticket.ticket_number}`;
        await this.sendDocument(phone, fullUrl, caption);
      } catch (pdfErr) {
        console.error('[WhatsApp] Gagal generate/kirim PDF nota masuk:', pdfErr.message);
        SystemLog.create({
          level: 'ERROR', source: 'PDFService',
          message: 'Gagal generate/kirim PDF nota masuk servis',
          details: { ticket_id: ticket._id, error: pdfErr.message }
        }).catch(() => {});
      }

    } catch (error) {
      console.error('[WhatsApp] Error in sendServiceWelcomeMessages:', error);
    }
  }

  /**
   * Mengirim 3 pesan berurutan untuk Pesanan Barang Baru
   */
  async sendOrderWelcomeMessages(order) {
    try {
      const phone = order.customer.phone;
      if (!phone) return;

      // Cek status session
      const status = await this.checkSessionStatus();
      if (status.status !== 'WORKING') {
        console.warn(`[WhatsApp] Session ${this.session} tidak WORKING. Sekuense pesan dibatalkan.`);
        return;
      }

      // 1. Pesan Greeting
      const msg1 = `Halo Kak ${order.customer.name}, selamat datang di Bengkel UTC! 👋 Terima kasih telah mempercayakan perbaikan/pemesanan perangkat Anda kepada kami.`;
      await this.sendMessage(phone, msg1);
      
      await this.delay(2500); // Jeda 2.5 detik

      // 2. Pesan Status
      const msg2 = `Berikut adalah informasi perangkat Anda:
*No. Tiket/Pesanan: ${order.order_number}
*Perangkat: ${order.item_name}
Status Saat Ini: Menunggu Antrian ⏳`;
      await this.sendMessage(phone, msg2);

      await this.delay(2500); // Jeda 2.5 detik

      // 3. Kirim PDF Nota Masuk
      await this.delay(2000);
      try {
        const pdfResult = await pdfService.generateOrderEntryNota(order);
        const { fileUrl } = await saveNota(
          pdfResult,
          'ORD',
          order.order_number,
          order.customer.name,
          { kind: 'ENTRY', isPaid: false, paymentStatus: getOrderPaymentStatus(order) }
        );
        const fullUrl = `${BACKEND_URL}${fileUrl}`;
        const caption = `Nota Registrasi Pesanan - ${order.order_number}`;
        await this.sendDocument(phone, fullUrl, caption);
      } catch (pdfErr) {
        console.error('[WhatsApp] Gagal generate/kirim PDF nota masuk order:', pdfErr.message);
        SystemLog.create({
          level: 'ERROR', source: 'PDFService',
          message: 'Gagal generate/kirim PDF nota masuk order',
          details: { order_id: order._id, error: pdfErr.message }
        }).catch(() => {});
      }

    } catch (error) {
      console.error('[WhatsApp] Error in sendOrderWelcomeMessages:', error);
    }
  }

  /**
   * Template Notifikasi Servis
   */
  async notifyServiceStatus(ticket) {
    const statusMap = {
      'Queue': 'Dalam Antrian',
      'Diagnosing': 'Sedang Tahap Diagnosa',
      'Waiting_Part': 'Menunggu Suku Cadang',
      'In_Progress': 'Sedang Dikerjakan oleh Teknisi',
      'Completed': 'Selesai & Siap Diambil',
      'Cancelled': 'Dibatalkan',
      'Picked_Up': 'Sudah Diambil'
    };

    const statusLabel = statusMap[ticket.status] || ticket.status;
    const currencyFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
    const tanggalMasuk = formatTanggalMasukID(ticket.history && ticket.history.created_at);

    let message = `*UNIDA TECHNOLOGY CENTRE - UPDATE SERVIS*\n\n`;
    message += `Halo Kak *${ticket.customer.name}*, apa kabarnya? Semoga sehat selalu 😊\n\n`;
    message += `Kami ingin menginformasikan update terbaru untuk perbaikan perangkat Anda:\n`;
    message += `📦 *${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}*\n`;
    message += `🎫 No. Tiket: #${ticket.ticket_number}\n`;
    message += `📅 Tanggal Masuk: ${tanggalMasuk}\n\n`;
    message += `Status saat ini: ✅ *${statusLabel}*\n\n`;

    // Jika sudah selesai, berikan rincian biaya
    if (ticket.status === 'Completed') {
      const partCost = ticket.parts_used
        ? ticket.parts_used.reduce((sum, p) => sum + (Number(p.subtotal) || 0), 0)
        : 0;
      const totalCost = getServiceTotal(ticket) || ((Number(ticket.service_fee) || 0) + partCost);
      const paymentStatus = getServicePaymentStatus(ticket);

      message += `*RINCIAN BIAYA:*\n`;
      message += `• Jasa Servis: ${currencyFormat.format(ticket.service_fee)}\n`;
      
      if (partCost > 0) {
        message += `• Sparepart:\n`;
        ticket.parts_used.forEach(p => {
          message += `  - ${p.name} (x${p.qty}): ${currencyFormat.format(p.subtotal)}\n`;
        });
        message += `• Total Sparepart: ${currencyFormat.format(partCost)}\n`;
      }
      
      message += `--------------------------\n`;
      message += `*TOTAL AKHIR: ${currencyFormat.format(totalCost)}*\n\n`;
      message += `*Status Bayar: ${paymentStatus.toUpperCase()}*\n`;
      if (paymentStatus === 'Lunas' && ticket.payment_method) {
        message += `Metode Bayar: ${ticket.payment_method}\n\n`;
      } else {
        message += `Nota ini sebagai bukti servis. Lunasi saat pengambilan barang.\n\n`;
      }
      message += `Silakan Kakak berkunjung kembali ke toko kami untuk pengambilan perangkat. Jangan lupa membawa nota ini ya!\n`;
    } else if (ticket.status === 'Picked_Up') {
      const expiryDate = ticket.warranty_expires_at 
        ? new Date(ticket.warranty_expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '7 hari dari sekarang';

      message = `Halo Kak *${ticket.customer.name}*, terima kasih sudah mengambil perangkatnya 😊🙏

Berikut kami lampirkan *Nota Digital Resmi* untuk tiket #${ticket.ticket_number}.
Silakan simpan nota ini sebagai bukti pengambilan yang sah.

*PENGINGAT GARANSI:*
• Masa Garansi: *7 Hari* (Berlaku s/d ${expiryDate})
• Garansi berlaku hanya untuk *jenis kerusakan yang sama*.

Semoga perangkatnya awet dan bermanfaat! ✨

_Tim Unida Technology Centre_`;

      const result = await this.sendMessage(ticket.customer.phone, message);

      try {
        const pdfResult = await pdfService.generateServiceNota(ticket);
        const servicePaidStatus = getServicePaymentStatus(ticket);
        const { fileUrl } = await saveNota(
          pdfResult,
          'SVC',
          ticket.ticket_number,
          ticket.customer.name,
          { kind: 'PAYMENT', isPaid: servicePaidStatus === 'Lunas', paymentStatus: servicePaidStatus }
        );
        const fullUrl = `${BACKEND_URL}${fileUrl}`;
        const caption = `Nota Digital Servis - ${ticket.ticket_number}`;
        await this.sendDocument(ticket.customer.phone, fullUrl, caption);
      } catch (pdfErr) {
        console.error('[WhatsApp] Gagal generate/kirim PDF nota servis:', pdfErr.message);
        SystemLog.create({
          level: 'ERROR',
          source: 'PDFService',
          message: 'Gagal generate/kirim PDF nota servis',
          details: { ticket_id: ticket._id, error: pdfErr.message }
        }).catch(() => {});
      }

      return result;
    } else {
      message += `Estimasi Jasa Awal: *${currencyFormat.format(ticket.service_fee)}*\n`;
      message += `_(Biaya akhir akan dikonfirmasi setelah selesai)_\n\n`;
      message += `Kami akan segera mengabari Kakak kembali jika ada perkembangan lebih lanjut. Mohon ditunggu ya Kak. 🙏\n`;
    }

    message += `\nTerima kasih atas kepercayaannya.\n_Salam hangat, Tim Unida Technology Centre_`;

    return this.sendMessage(ticket.customer.phone, message);
  }

  /**
   * Template Notifikasi Pesanan Barang
   */
  async notifyOrderStatus(order) {
    const statusMap = {
      'Pending': 'Dalam Antrian Pesanan',
      'Searching': 'Sedang Kami Carikan di Supplier',
      'Ordered': 'Sudah Kami Pesan ke Supplier',
      'Arrived': 'SUDAH SAMPAI di Toko',
      'Picked_Up': 'Sudah Diambil',
      'Cancelled': 'Dibatalkan'
    };

    const statusLabel = statusMap[order.status] || order.status;
    const currencyFormat = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
    const remaining = getOrderRemaining(order);
    const downPayment = Number(order.down_payment) || 0;
    const hasDp = downPayment > 0;
    const paymentStatus = getOrderPaymentStatus(order);

    let message = `*UNIDA TECHNOLOGY CENTRE - NOTIFIKASI PESANAN*\n\n`;
    message += `Halo Kak *${order.customer.name}*, selamat hari yang luar biasa! 😊\n\n`;
    message += `Kami ingin mengabarkan status pesanan barang Anda:\n`;
    message += `🛒 *${order.item_name}*\n`;
    message += `🎫 No. Order: #${order.order_number}\n\n`;
    message += `Status Pesanan: ✅ *${statusLabel}*\n\n`;

    message += `*DETAIL KEUANGAN:*\n`;
    message += `• Estimasi Harga: ${currencyFormat.format(order.estimated_price)}\n`;
    // Aturan pesanan: DP dikosongkan (-) bila belum bayar, tampil nominal bila sudah bayar.
    message += `• DP Masuk: ${hasDp ? currencyFormat.format(downPayment) : '-'}\n`;
    message += `• *SISA BAYAR: ${currencyFormat.format(remaining)}*\n`;
    message += `• *Status Bayar: ${paymentStatus.toUpperCase()}*\n\n`;
    if (!hasDp) {
      message += `Belum ada DP masuk. Nota ini sebagai bukti pesanan.\n\n`;
    }

    if (order.status === 'Arrived') {
      message += `🎉 Kabar gembira! Barang pesanan Kakak sudah sampai di toko kami.\n`;
      message += `Kakak bisa segera mengambilnya di jam operasional toko dengan melunasi sisa pembayaran di atas ya. Sampai jumpa di toko! 👋\n`;
    } else if (order.status === 'Pending') {
      message += `Pesanan Kakak sudah kami terima dan akan segera kami proses pencariannya. Mohon ditunggu ya Kak. 🙏\n`;
    } else if (order.status === 'Picked_Up') {
      message = `Halo Kak *${order.customer.name}*, terima kasih sudah mengambil pesanannya 😊🙏

Berikut kami lampirkan *Nota Digital Resmi* untuk order #${order.order_number}.
Silakan simpan nota ini sebagai bukti pengambilan yang sah.

Semoga barangnya bermanfaat! ✨

_Tim Unida Technology Centre_`;

      const result = await this.sendMessage(order.customer.phone, message);

      try {
        const pdfResult = await pdfService.generateOrderNota(order);
        const { fileUrl } = await saveNota(
          pdfResult,
          'ORD',
          order.order_number,
          order.customer.name,
          { kind: 'PAYMENT', isPaid: getOrderPaymentStatus(order) === 'Lunas', paymentStatus: getOrderPaymentStatus(order) }
        );
        const fullUrl = `${BACKEND_URL}${fileUrl}`;
        const caption = `Nota Digital Pesanan - ${order.order_number}`;
        await this.sendDocument(order.customer.phone, fullUrl, caption);
      } catch (pdfErr) {
        console.error('[WhatsApp] Gagal generate/kirim PDF nota order:', pdfErr.message);
        SystemLog.create({
          level: 'ERROR',
          source: 'PDFService',
          message: 'Gagal generate/kirim PDF nota order',
          details: { order_id: order._id, error: pdfErr.message }
        }).catch(() => {});
      }

      return result;
    } else {
      message += `Kami akan segera mengabari Kakak kembali saat barang sudah mendarat di toko kami. 😊\n`;
    }

    message += `\nSalam sukses,\n_Tim Unida Technology Centre_`;

    return this.sendMessage(order.customer.phone, message);
  }

  /**
   * Notifikasi Penugasan Teknisi (Internal)
   */
  async notifyTechnicianAssignment(technician, ticket) {
    if (!technician.phone) return null;

    const message = `🛠️ *TUGAS BARU MASUK!* 🛠️\n\nHalo *${technician.name}*,\nAda tugas baru yang ditugaskan kepada Anda:\n\n💻 Barang: *${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}*\n🩹 Kerusakan: *${ticket.device.symptoms}*\n👤 Pelanggan: *${ticket.customer.name}*\n🎫 No. Tiket: #${ticket.ticket_number}\n\nSilakan cek dashboard *Unida Technology Centre* untuk detail lebih lanjut. Semangat kerja! 💪🔧`;

    return this.sendMessage(technician.phone, message);
  }

  /**
   * Notifikasi Penugasan Pesanan Barang (Internal)
   */
  async notifyOrderAssignment(staff, order) {
    if (!staff.phone) return null;

    const message = `🛒 *TUGAS PESANAN BARU!* 🛒\n\nHalo *${staff.name}*,\nAnda ditugaskan untuk mencari/mengelola pesanan barang berikut:\n\n📦 Barang: *${order.item_name}*\n👤 Pelanggan: *${order.customer.name}*\n🎫 No. Order: #${order.order_number}\n\nSilakan segera diproses dan update statusnya di dashboard *Unida Technology Centre*. Semangat! 🚀`;

    return this.sendMessage(staff.phone, message);
  }

  /**
   * Pengingat Pengambilan Barang untuk Customer (Sopan & Jam Operasional)
   */
  async sendCustomerPickupReminder(ticket) {
    let message = `*PENGINGAT - UNIDA TECHNOLOGY CENTRE*\n\n`;
    message += `Halo Kak *${ticket.customer.name}*, selamat siang. 😊\n\n`;
    message += `Mohon maaf mengganggu waktunya. Kami ingin mengingatkan kembali bahwa perangkat Kakak:\n`;
    message += `📦 *${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}*\n`;
    message += `🎫 No. Tiket: #${ticket.ticket_number}\n\n`;
    message += `Sudah selesai diperbaiki dan siap untuk diambil. ✅\n\n`;
    message += `Kakak bisa mengambilnya di kantor kami pada jam operasional:\n`;
    message += `🕒 *Senin - Kamis & Sabtu: 08.00 - 15.00 WIB*\n`;
    message += `_(Hari Jumat kantor kami libur)_\n\n`;
    message += `Terima kasih atas perhatiannya Kak. Kami tunggu kehadirannya! 🙏✨`;

    return this.sendMessage(ticket.customer.phone, message);
  }

  /**
   * Pengingat Pengambilan Pesanan untuk Customer
   */
  async sendOrderPickupReminder(order) {
    let message = `*PENGINGAT PESANAN - UNIDA TECHNOLOGY CENTRE*\n\n`;
    message += `Halo Kak *${order.customer.name}*, apa kabarnya? 😊\n\n`;
    message += `Sekedar menginformasikan kembali bahwa pesanan Kakak:\n`;
    message += `🛒 *${order.item_name}*\n`;
    message += `🎫 No. Order: #${order.order_number}\n\n`;
    message += `Sudah tersedia di toko kami dan menunggu untuk dijemput. 🛍️\n\n`;
    message += `Silakan Kakak datang ke kantor kami pada jam kerja:\n`;
    message += `🕒 *08.00 - 15.00 WIB* (Kecuali hari Jumat)\n\n`;
    message += `Sampai jumpa di toko Kak! Terima kasih. 🙏`;

    return this.sendMessage(order.customer.phone, message);
  }

  /**
   * Pengingat Tugas untuk Teknisi (Setiap 12 Jam)
   */
  async sendTechnicianTaskReminder(techUser, ticket) {
    const statusMap = {
      'Queue': 'Dalam Antrian',
      'Diagnosing': 'Tahap Diagnosa',
      'In_Progress': 'Sedang Dikerjakan'
    };
    
    const message = `⏰ *PENGINGAT TUGAS TEKNISI* ⏰\n\nHalo *${techUser.name}*,\nSekedar mengingatkan ada tugas yang masih dalam status *${statusMap[ticket.status]}*:\n\n💻 Barang: *${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}*\n🩹 Kerusakan: *${ticket.device.symptoms}*\n👤 Pelanggan: *${ticket.customer.name}*\n🎫 No. Tiket: #${ticket.ticket_number}\n\nMohon segera ditindaklanjuti agar pelayanan kita tetap prima. Semangat! 🛠️💪`;

    return this.sendMessage(techUser.phone, message);
  }

  /**
   * Notifikasi Manual ke Teknisi (via tombol di card)
   */
  async notifyTechnicianReminder(ticket) {
    if (!ticket.technician?.phone) return { success: false, error: 'Teknisi tidak memiliki nomor HP' };

    const message = `🔔 *PENGINGAT DARI KASIR* 🔔\n\nHalo *${ticket.technician.name}*,\n\nAda pengingat untuk mengecek barang servis berikut:\n\n💻 Barang: *${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}*\n🩹 Kerusakan: *${ticket.device.symptoms}*\n👤 Pelanggan: *${ticket.customer.name}*\n🎫 No. Tiket: #${ticket.ticket_number}\n\nMohon segera dicek dan ditindaklanjuti. Terima kasih! 🙏🛠️`;

    return this.sendMessage(ticket.technician.phone, message);
  }

  /**
   * Cek apakah nomor WA terdaftar.
   * Hasil di-cache 5 menit per nomor. Kembalikan bentuk konsisten:
   * { exists: boolean, error: string|null, cached: boolean }
   * - exists:true  -> nomor terdaftar di WA
   * - exists:false + error:null -> WAHA menjawab tegas: tidak terdaftar
   * - exists:false + error:<pesan> -> WAHA tidak bisa dihubungi / gagal (unknown)
   * @param {string} phone
   */
  async checkExists(phone) {
    const cleanPhone = normalizeIDPhone(phone);
    if (!cleanPhone) {
      return { exists: false, error: 'Nomor HP kosong' };
    }

    const cached = getCachedCheck(cleanPhone);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      const url = `${this.baseURL}/api/contacts/check-exists`;
      const data = {
        phone: cleanPhone,
        session: this.session
      };

      const config = {
        headers: {
          'X-Api-Key': this.apiKey
        },
        timeout: 10000
      };

      const response = await axios.post(url, data, config);
      const body = response.data || {};
      // WAHA GOWS mengembalikan { status: 'exists' | 'not_exists' } atau { exists: boolean }
      const exists = body.exists === true || body.status === 'exists';
      // Anggap unknown (bukan not-found tegas) bila payload tidak dikenali
      const recognized = body.exists !== undefined || body.status !== undefined;
      const result = recognized
        ? { exists, error: null }
        : { exists: false, error: 'Respons WAHA tidak dikenali' };
      setCachedCheck(cleanPhone, result);
      return { ...result, cached: false };
    } catch (error) {
      console.error(`[WhatsApp] Gagal cek nomor ${phone}:`, error.message);
      return { exists: false, error: error.message };
    }
  }

  /**
   * Cek status session WAHA (dengan cache 30 detik agar polling status murah).
   */
  async checkSessionStatus() {
    if (waSessionCache.result && waSessionCache.expiresAt > Date.now()) {
      return { ...waSessionCache.result, cached: true };
    }
    try {
      const url = `${this.baseURL}/api/sessions/${this.session}`;
      const config = {
        headers: { 'X-Api-Key': this.apiKey },
        timeout: 5000
      };

      const response = await axios.get(url, config);
      // Status WAHA: STARTING, SCAN_QR, WORKING, FAILED, STOPPED
      const result = { ...(response.data || {}), cached: false };
      waSessionCache = { result, expiresAt: Date.now() + WA_SESSION_TTL_MS };
      return result;
    } catch (error) {
      const statusCode = error.response?.status;
      const respData = error.response?.data;
      console.error(`[WhatsApp] Gagal cek status session:`, {
        message: error.message,
        status: statusCode,
        response: respData,
        url: `${this.baseURL}/api/sessions/${this.session}`,
        code: error.code
      });
      // Bedakan antara session belum dibuat vs WAHA tidak terjangkau
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return { status: 'UNREACHABLE', error: `WAHA tidak terjangkau (${error.code})` };
      }
      return { status: 'DISCONNECTED', error: error.message };
    }
  }
}

module.exports = new WhatsAppService();
module.exports.clearWACache = clearWACache;