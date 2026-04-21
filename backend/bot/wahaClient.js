const axios = require('axios');

async function sendReply(phone, text) {
  try {
    const url = `${process.env.WAHA_URL || 'http://waha:8000'}/api/sendText`;
    await axios.post(url, {
      chatId: phone,
      text: text,
      session: process.env.WAHA_SESSION || 'default'
    }, {
      headers: { 
        'X-Api-Key': process.env.WAHA_API_KEY || 'adminutc28' 
      }
    });
  } catch (error) {
    console.error('[Bot] Gagal kirim balasan:', error.response?.data || error.message);
  }
}

module.exports = { sendReply };