const axios = require('axios');

/**
 * WhatsApp Service using WAHA (WhatsApp HTTP API)
 */
class WhatsAppService {
  constructor() {
    // URL WAHA di dalam network docker adalah http://waha:3000
    // Jika diakses dari luar docker (saat development) gunakan http://localhost:3000
    this.baseURL = process.env.WAHA_URL || 'http://waha:8000';
    this.session = process.env.WAHA_SESSION || 'default';
    this.apiKey = process.env.WAHA_API_KEY || 'adminutc28';
  }

  /**
   * Mengirim pesan teks ke nomor tertentu
   * @param {string} phone Nomor HP (format: 08xx atau 628xx)
   * @param {string} message Isi pesan
   */
  async sendMessage(phone, message) {
    try {
      // Bersihkan nomor HP agar sesuai format WAHA (628xxxxxxxx@c.us)
      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '62' + formattedPhone.slice(1);
      }
      if (!formattedPhone.endsWith('@c.us')) {
        formattedPhone = formattedPhone + '@c.us';
      }

      const url = `${this.baseURL}/api/sendText`;
      const data = {
        chatId: formattedPhone,
        text: message,
        session: this.session
      };

      const config = {
        headers: {
          'X-Api-Key': this.apiKey
        }
      };

      console.log(`[WhatsApp] Mengirim pesan ke ${formattedPhone}...`);
      
      const response = await axios.post(url, data, config);
      return response.data;
    } catch (error) {
      console.error('[WhatsApp] Gagal mengirim pesan:', error.response?.data || error.message);
      // Jangan throw error agar tidak mengganggu flow utama aplikasi jika WA mati
      return null;
    }
  }

  /**
   * Template Notifikasi Servis
   */
  async notifyServiceStatus(ticket) {
    const statusMap = {
      'Queue': 'Antrian',
      'Diagnosing': 'Proses Diagnosa',
      'Waiting_Part': 'Menunggu Suku Cadang',
      'In_Progress': 'Sedang Dikerjakan',
      'Completed': 'Selesai & Siap Diambil',
      'Cancelled': 'Dibatalkan',
      'Picked_Up': 'Sudah Diambil'
    };

    const statusLabel = statusMap[ticket.status] || ticket.status;
    const message = `*BENGKEL UTC - NOTIFIKASI SERVIS*\n\nHalo Kak *${ticket.customer.name}*,\n\nKami mengabarkan bahwa perangkat Anda:\n📦 *${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}*\n🎫 No. Tiket: #${ticket.ticket_number}\n\nSaat ini statusnya adalah: ✅ *${statusLabel}*\n\nTerima kasih telah mempercayakan servis Anda kepada kami.\n_Pesan otomatis dari Sistem UTC_`;

    return this.sendMessage(ticket.customer.phone, message);
  }

  /**
   * Template Notifikasi Pesanan Barang
   */
  async notifyOrderStatus(order) {
    const statusMap = {
      'Pending': 'Antrian',
      'Searching': 'Sedang Kami Cari',
      'Ordered': 'Sudah Dipesan ke Supplier',
      'Arrived': 'SUDAH SAMPAI di Toko',
      'Picked_Up': 'Sudah Diambil',
      'Cancelled': 'Dibatalkan'
    };

    const statusLabel = statusMap[order.status] || order.status;
    let message = `*BENGKEL UTC - NOTIFIKASI PESANAN*\n\nHalo Kak *${order.customer.name}*,\n\nUpdate untuk pesanan barang Anda:\n🛒 *${order.item_name}*\n🎫 No. Order: #${order.order_number}\n\nStatus saat ini: ✅ *${statusLabel}*`;

    if (order.status === 'Arrived') {
      message += `\n\nBarang sudah siap di toko. Silakan datang untuk pengambilan dan pelunasan sisa bayar sebesar *${new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR', maximumFractionDigits:0}).format(order.remaining_payment)}*.`;
    }

    message += `\n\nTerima kasih.\n_Pesan otomatis dari Sistem UTC_`;

    return this.sendMessage(order.customer.phone, message);
  }
}

module.exports = new WhatsAppService();