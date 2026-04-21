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

    let message = `*UNIDA TECHNOLOGY CENTERE - UPDATE SERVIS*\n\n`;
    message += `Halo Kak *${ticket.customer.name}*, apa kabarnya? Semoga sehat selalu 😊\n\n`;
    message += `Kami ingin menginformasikan update terbaru untuk perbaikan perangkat Anda:\n`;
    message += `📦 *${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}*\n`;
    message += `🎫 No. Tiket: #${ticket.ticket_number}\n\n`;
    message += `Status saat ini: ✅ *${statusLabel}*\n\n`;

    // Jika sudah selesai, berikan rincian biaya
    if (ticket.status === 'Completed') {
      const partCost = ticket.parts_used ? ticket.parts_used.reduce((sum, p) => sum + p.subtotal, 0) : 0;
      const totalCost = (ticket.service_fee || 0) + partCost;

      message += `*RINCIAN BIAYA:*\n`;
      message += `• Jasa Servis: ${currencyFormat.format(ticket.service_fee)}\n`;
      if (partCost > 0) message += `• Sparepart: ${currencyFormat.format(partCost)}\n`;
      message += `--------------------------\n`;
      message += `*TOTAL AKHIR: ${currencyFormat.format(totalCost)}*\n\n`;
      message += `Silakan Kakak berkunjung kembali ke toko kami untuk pengambilan perangkat. Jangan lupa membawa nota ini ya!\n`;
    } else {
      message += `Estimasi Jasa Awal: *${currencyFormat.format(ticket.service_fee)}*\n`;
      message += `_(Biaya akhir akan dikonfirmasi setelah selesai)_\n\n`;
      message += `Kami akan segera mengabari Kakak kembali jika ada perkembangan lebih lanjut. Mohon ditunggu ya Kak. 🙏\n`;
    }

    message += `\nTerima kasih atas kepercayaannya.\n_Salam hangat, Tim Unida Technology Centere_`;

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
    const remaining = Math.max(0, (order.estimated_price || 0) - (order.down_payment || 0));

    let message = `*UNIDA TECHNOLOGY CENTERE - NOTIFIKASI PESANAN*\n\n`;
    message += `Halo Kak *${order.customer.name}*, selamat hari yang luar biasa! 😊\n\n`;
    message += `Kami ingin mengabarkan status pesanan barang Anda:\n`;
    message += `🛒 *${order.item_name}*\n`;
    message += `🎫 No. Order: #${order.order_number}\n\n`;
    message += `Status Pesanan: ✅ *${statusLabel}*\n\n`;

    message += `*DETAIL KEUANGAN:*\n`;
    message += `• Estimasi Harga: ${currencyFormat.format(order.estimated_price)}\n`;
    message += `• DP Masuk: ${currencyFormat.format(order.down_payment)}\n`;
    message += `• *SISA BAYAR: ${currencyFormat.format(remaining)}*\n\n`;

    if (order.status === 'Arrived') {
      message += `🎉 Kabar gembira! Barang pesanan Kakak sudah sampai di toko kami.\n`;
      message += `Kakak bisa segera mengambilnya di jam operasional toko dengan melunasi sisa pembayaran di atas ya. Sampai jumpa di toko! 👋\n`;
    } else if (order.status === 'Pending') {
      message += `Pesanan Kakak sudah kami terima dan akan segera kami proses pencariannya. Mohon ditunggu ya Kak. 🙏\n`;
    } else {
      message += `Kami akan segera mengabari Kakak kembali saat barang sudah mendarat di toko kami. 😊\n`;
    }

    message += `\nSalam sukses,\n_Tim Unida Technology Centere_`;

    return this.sendMessage(order.customer.phone, message);
  }
}

module.exports = new WhatsAppService();