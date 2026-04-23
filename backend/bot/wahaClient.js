const axios = require('axios');

async function sendReply(phone, text) {
  try {
    const url = `${process.env.WAHA_URL || 'http://waha:8000'}/api/sendText`;
    console.log(`[Bot] Mengirim balasan ke ${phone}...`);
    
    const response = await axios.post(url, {
      chatId: phone,
      text: text,
      session: process.env.WAHA_SESSION || 'default'
    }, {
      headers: { 
        'X-Api-Key': process.env.WAHA_API_KEY || 'adminutc28' 
      },
      timeout: 5000 // 5 detik timeout
    });
    
    console.log(`[Bot] Balasan terkirim ke ${phone}. Response:`, response.data);
  } catch (error) {
    console.error('[Bot] Gagal kirim balasan ke', phone, 'Error:', error.response?.data || error.message);
  }
}

module.exports = { sendReply };