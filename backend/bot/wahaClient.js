const axios = require('axios');

async function sendReply(phone, text) {
  try {
    // Pastikan phone bersih dari karakter aneh dan punya @c.us
    let cleanPhone = phone.toString().split('@')[0].replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;

    const url = `${process.env.WAHA_URL || 'http://waha:8000'}/api/sendText`;
    console.log(`[Bot] Mengirim balasan ke ${chatId}...`);
    
    const response = await axios.post(url, {
      chatId: chatId,
      text: text,
      session: process.env.WAHA_SESSION || 'default'
    }, {
      headers: { 
        'X-Api-Key': process.env.WAHA_API_KEY || 'adminutc28' 
      },
      timeout: 10000 
    });
    
    console.log(`[Bot] Balasan terkirim ke ${chatId}.`);
  } catch (error) {
    console.error('[Bot] Gagal kirim balasan ke', phone, 'Error:', error.response?.data || error.message);
  }
}

module.exports = { sendReply };