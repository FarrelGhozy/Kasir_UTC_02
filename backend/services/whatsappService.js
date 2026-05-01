const axios = require('axios');
const SystemLog = require('../models/SystemLog');

/**
 * WhatsApp Service using WAHA (WhatsApp HTTP API)
 */
class WhatsAppService {
  constructor() {
    // URL WAHA di dalam network docker adalah http://waha:8000
    // Jika diakses dari luar docker (saat development) gunakan http://localhost:8000
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
        timeout: 10000 // Beri waktu 10 detik
      };

      console.log(`[WhatsApp] Mencoba mengirim ke ${chatId}...`);
      
      const response = await axios.post(url, data, config);
      console.log(`[WhatsApp] Sukses kirim ke ${chatId}.`);
      return response.data;
    } catch (error) {
      console.error(`[WhatsApp] Gagal mengirim ke ${phone}:`, error.response?.data || error.message);
      
      // Catat kegagalan ke Log Sistem
      SystemLog.create({
        level: 'ERROR',
        source: 'WhatsAppService',
        message: `Gagal kirim pesan ke ${phone}`,
        details: { 
          error: error.message, 
          response: error.response?.data,
          target: phone
        }
      }).catch(err => console.error('Gagal simpan log WA:', err));

      return null;
    }
  }

  /**
   * Helper untuk memberikan jeda waktu (delay)
   * @param {number} ms Milidetik
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

      const deviceName = `${ticket.device.type} ${ticket.device.brand || ''} ${ticket.device.model || ''}`.trim();

      // 1. Pesan Greeting
      const msg1 = `Halo Kak ${ticket.customer.name}, selamat datang di Bengkel UTC! 👋 Terima kasih telah mempercayakan perbaikan/pemesanan perangkat Anda kepada kami.`;
      await this.sendMessage(phone, msg1);
      
      await this.delay(2500); // Jeda 2.5 detik

      // 2. Pesan Status
      const msg2 = `Berikut adalah informasi perangkat Anda:
*No. Tiket/Pesanan: ${ticket.ticket_number}
*Perangkat: ${deviceName}
Status Saat Ini: Menunggu Antrian ⏳`;
      await this.sendMessage(phone, msg2);

      await this.delay(2500); // Jeda 2.5 detik

      // 3. Pesan Syarat & Ketentuan
      const msg3 = `PERHATIAN

  

SYARAT DAN KETENTUAN

  

Nota ini wajib dibawa saat pengambilan Unit Perangkat Elektronik yang diperbaiki/diservis. Pengambilan tanpa nota dengan alasan apapun tidak akan dilayani oeh pihak UTC.  

Perangkat Elektronik yang diperbaiki/diservis, bila ternyata bertambah jenis kerusakan di luar kesepakatan awal, akan dikenakan biaya tambahan dengan melakukan konfirmasi terlebih dahulu kepada Konsumen.  

Apabila setelah pengecekan kerusakan ditemukan dan konsumen memutuskan untuk membatalkan perbaikan, maka akan dikenakan Biaya Pengecekan/Diagnosa sebesar Rp. 20.000 untuk semua perangkat Elektronik  

Pihak UTC tidak bertanggung jawab atas hilangnya data Konsumen untuk semua jenis kerusakan software dan mesin atau kerusakan fisik lainnya yang berdampak pada media penyimpanan.  

UTC tidak bertanggung jawab atas legalitas software/sistem operasi yang terinstall di perangkat konsumen. Kami tidak melayani instalasi software bajakan/crack yang melanggar hukum Hak Cipta.  

UTC hanya bertanggung jawab atas unit dan kelengkapan yang tertulis dalam nota tanda terima  

Untuk kabar perbaikan customer akan dikabarkan setelah 3 hari  

pengambilan barang service hanya bisa di lakukan di hari kerja, Sabtu-Kamis pada pukul 08.00 – 15.00  

Masa garansi berlaku mulai dari tanggal pengambilan Perangkat Elektronik, dengan ketentuan sebagai berikut: Garansi berlaku untuk jenis kerusakan yang sama, Masa garansi Servis 7 Hari, Garansi Suku Cadang/Hardware berlaku sesuai ketentuan distributor (misal: 14-30 hari) dengan syarat fisik tidak cacat.  

Garansi tidak berlaku apabila: Mengubah isi nota, Segel garansi hilang atau rusak, Kesalahan pengguna yang tidak semestinya (Jatuh, terbentur benda keras, terkena cairan, terbakar dan sebagainya).  

PERSETUJUAN SERVICE PERANGKAT ELEKTRONIK

  

Saya menyatakan bahwa Perangkat Elektronik yang diperbaiki/diservis adalah Alat Elektronik milik/dalam penguasaan sendiri dan bukan merupakan Alat Elektronik dari hasil tindak kejahatan  

Saya telah menerima penjelasan dan menyetujui tindakan servis berupa pembongkaran serta analisa kerusakan komponen lebih lanjut  

Saya memahami bahwa untuk Handphone dan Laptop yang mati total atau mengalami kerusakan yang menyebabkan tidak dapat mengakses menu, seluruh fitur dianggap tidak berfungsi dengan normal. Hasil pengecekan lebih lanjut akan diinformasikan kemudian.  

Saya Menyatakan paham bahwa proses pembongkaran pada perangkat tertentu (khususnya HP layar lengkung atau unibody) memiliki risiko lecet, retak rambut pada casing, atau hilangnya fitur ketahanan air (waterproof).pihak UTC tidak bertanggung jawab atas hilangnya fitur waterproof setelah perbaikan.  

Saya menyatakan kesediaan untuk memberikan akses keamanan Perangkat Elektronik Saya hanya dalam batas proses perbaikan dan tidak untuk disalahgunakan dikemudian hari.  

Saya telah menerima penjelasan mengenai konsekuensi jika Perangkat Elektronik tidak diambil dalam waktu 30 (tiga puluh) hari setelah pemberitahuan/konfirmasi, yaitu: Saya tidak akan mempermasalahkan kerusakan tambahan yang mungkin terjadi  

Saya setuju terdapat Biaya Penyimpanan Perangkat Elektronik sebesar Rp. 2.000,- (dua ribu rupiah) per hari kalender yang akan mulai dihitung setelah melewati 15 (lima belas) hari kalender sejak batas waktu pemberitahuan/konfirmasi kepada Konsumen bahwa Perangkat Elektronik sudah dapat diambil. Biaya Penyimpanan Perangkat Elektronik hanya berlaku sampai dengan maksimal 90 (sembilan puluh) hari sejak batas waktu pemberitahuan/konfirmasi kepada Konsumen bahwa Alat Elektronik sudah dapat diambil.  

Saya setuju dan mengizinkan pihak UTC untuk melakukan Lelang/Penjualan Perangkat Elektronik Service jika dalam batas waktu 90 (sembilan puluh) hari sejak batas waktu pemberitahuan/konfirmasi kepada Konsumen bahwa Perangkat Elektronik sudah dapat diambil atau 30 (tiga puluh) hari sejak pemberitahuan secara tertulis oleh pihak UTC tidak segera diambil oleh Konsumen.  

Saya membebaskan pihak UTC dari segala tuntutan pidana maupun gugatan perdata atas kesalahan dan/atau pelanggaran Saya dari syarat dan ketentuan ini.  

Saya membebaskan pihak UTC dari tanggung jawab atas kerusakan atau kehilangan akibat keadaan memaksa (force majeure) termasuk namun tidak terbatas pada : bencana alam, kebakaran, epidemi/pandemi, serta kejadian lain diluar kemampuan dan kendali pihak UTC.  

Bahwa benar Saya sebelumnya telah membaca dan menerima semua penjelasan dari UTC, untuk itu Sayatelah memahami isi serta menyatakan telah sepakat dan menyetujui syarat serta ketentuan dimaksud.`;
      
      await this.sendMessage(phone, msg3);

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

      // 3. Pesan Syarat & Ketentuan
      const msg3 = `PERHATIAN

  

SYARAT DAN KETENTUAN

  

Nota ini wajib dibawa saat pengambilan Unit Perangkat Elektronik yang diperbaiki/diservis. Pengambilan tanpa nota dengan alasan apapun tidak akan dilayani oeh pihak UTC.  

Perangkat Elektronik yang diperbaiki/diservis, bila ternyata bertambah jenis kerusakan di luar kesepakatan awal, akan dikenakan biaya tambahan dengan melakukan konfirmasi terlebih dahulu kepada Konsumen.  

Apabila setelah pengecekan kerusakan ditemukan dan konsumen memutuskan untuk membatalkan perbaikan, maka akan dikenakan Biaya Pengecekan/Diagnosa sebesar Rp. 20.000 untuk semua perangkat Elektronik  

Pihak UTC tidak bertanggung jawab atas hilangnya data Konsumen untuk semua jenis kerusakan software dan mesin atau kerusakan fisik lainnya yang berdampak pada media penyimpanan.  

UTC tidak bertanggung jawab atas legalitas software/sistem operasi yang terinstall di perangkat konsumen. Kami tidak melayani instalasi software bajakan/crack yang melanggar hukum Hak Cipta.  

UTC hanya bertanggung jawab atas unit dan kelengkapan yang tertulis dalam nota tanda terima  

Untuk kabar perbaikan customer akan dikabarkan setelah 3 hari  

pengambilan barang service hanya bisa di lakukan di hari kerja, Sabtu-Kamis pada pukul 08.00 – 15.00  

Masa garansi berlaku mulai dari tanggal pengambilan Perangkat Elektronik, dengan ketentuan sebagai berikut: Garansi berlaku untuk jenis kerusakan yang sama, Masa garansi Servis 7 Hari, Garansi Suku Cadang/Hardware berlaku sesuai ketentuan distributor (misal: 14-30 hari) dengan syarat fisik tidak cacat.  

Garansi tidak berlaku apabila: Mengubah isi nota, Segel garansi hilang atau rusak, Kesalahan pengguna yang tidak semestinya (Jatuh, terbentur benda keras, terkena cairan, terbakar dan sebagainya).  

PERSETUJUAN SERVICE PERANGKAT ELEKTRONIK

  

Saya menyatakan bahwa Perangkat Elektronik yang diperbaiki/diservis adalah Alat Elektronik milik/dalam penguasaan sendiri dan bukan merupakan Alat Elektronik dari hasil tindak kejahatan  

Saya telah menerima penjelasan dan menyetujui tindakan servis berupa pembongkaran serta analisa kerusakan komponen lebih lanjut  

Saya memahami bahwa untuk Handphone dan Laptop yang mati total atau mengalami kerusakan yang menyebabkan tidak dapat mengakses menu, seluruh fitur dianggap tidak berfungsi dengan normal. Hasil pengecekan lebih lanjut akan diinformasikan kemudian.  

Saya Menyatakan paham bahwa proses pembongkaran pada perangkat tertentu (khususnya HP layar lengkung atau unibody) memiliki risiko lecet, retak rambut pada casing, atau hilangnya fitur ketahanan air (waterproof).pihak UTC tidak bertanggung jawab atas hilangnya fitur waterproof setelah perbaikan.  

Saya menyatakan kesediaan untuk memberikan akses keamanan Perangkat Elektronik Saya hanya dalam batas proses perbaikan and tidak untuk disalahgunakan dikemudian hari.  

Saya telah menerima penjelasan mengenai konsekuensi jika Perangkat Elektronik tidak diambil dalam waktu 30 (tiga puluh) hari setelah pemberitahuan/konfirmasi, yaitu: Saya tidak akan mempermasalahkan kerusakan tambahan yang mungkin terjadi  

Saya setuju terdapat Biaya Penyimpanan Perangkat Elektronik sebesar Rp. 2.000,- (dua ribu rupiah) per hari kalender yang akan mulai dihitung setelah melewati 15 (lima belas) hari kalender sejak batas waktu pemberitahuan/konfirmasi kepada Konsumen bahwa Perangkat Elektronik sudah dapat diambil. Biaya Penyimpanan Perangkat Elektronik hanya berlaku sampai dengan maksimal 90 (sembilan puluh) hari sejak batas waktu pemberitahuan/konfirmasi kepada Konsumen bahwa Alat Elektronik sudah dapat diambil.  

Saya setuju dan mengizinkan pihak UTC untuk melakukan Lelang/Penjualan Perangkat Elektronik Service jika dalam batas waktu 90 (sembilan puluh) hari sejak batas waktu pemberitahuan/konfirmasi kepada Konsumen bahwa Perangkat Elektronik sudah dapat diambil atau 30 (tiga puluh) hari sejak pemberitahuan secara tertulis oleh pihak UTC tidak segera diambil oleh Konsumen.  

Saya membebaskan pihak UTC dari segala tuntutan pidana maupun gugatan perdata atas kesalahan dan/atau pelanggaran Saya dari syarat dan ketentuan ini.  

Saya membebaskan pihak UTC dari tanggung jawab atas kerusakan atau kehilangan akibat keadaan memaksa (force majeure) termasuk namun tidak terbatas pada : bencana alam, kebakaran, epidemi/pandemi, serta kejadian lain diluar kemampuan dan kendali pihak UTC.  

Bahwa benar Saya sebelumnya telah membaca dan menerima semua penjelasan dari UTC, untuk itu Sayatelah memahami isi serta menyatakan telah sepakat dan menyetujui syarat serta ketentuan dimaksud.`;
      
      await this.sendMessage(phone, msg3);

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

    let message = `*UNIDA TECHNOLOGY CENTRE - UPDATE SERVIS*\n\n`;
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
      
      if (partCost > 0) {
        message += `• Sparepart:\n`;
        ticket.parts_used.forEach(p => {
          message += `  - ${p.name} (x${p.qty}): ${currencyFormat.format(p.subtotal)}\n`;
        });
        message += `• Total Sparepart: ${currencyFormat.format(partCost)}\n`;
      }
      
      message += `--------------------------\n`;
      message += `*TOTAL AKHIR: ${currencyFormat.format(totalCost)}*\n\n`;
      message += `Silakan Kakak berkunjung kembali ke toko kami untuk pengambilan perangkat. Jangan lupa membawa nota ini ya!\n`;
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
    const remaining = Math.max(0, (order.estimated_price || 0) - (order.down_payment || 0));

    let message = `*UNIDA TECHNOLOGY CENTRE - NOTIFIKASI PESANAN*\n\n`;
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
   * Cek apakah nomor WA terdaftar
   * @param {string} phone 
   */
  async checkExists(phone) {
    try {
      let cleanPhone = phone.toString().replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }
      
      const chatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

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
      return response.data;
    } catch (error) {
      console.error(`[WhatsApp] Gagal cek nomor ${phone}:`, error.message);
      return { exists: false, error: error.message };
    }
  }

  /**
   * Cek status session WAHA
   */
  async checkSessionStatus() {
    try {
      const url = `${this.baseURL}/api/sessions/${this.session}`;
      const config = {
        headers: { 'X-Api-Key': this.apiKey },
        timeout: 5000
      };

      const response = await axios.get(url, config);
      // Status WAHA: STARTING, SCAN_QR, WORKING, FAILED, STOPPED
      return response.data;
    } catch (error) {
      console.error(`[WhatsApp] Gagal cek status session:`, error.message);
      return { status: 'DISCONNECTED', error: error.message };
    }
  }
}

module.exports = new WhatsAppService();