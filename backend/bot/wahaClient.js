const axios = require('axios');

const WAHA_BASE_URL = process.env.WAHA_URL;
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_API_KEY = process.env.WAHA_API_KEY;

async function sendReply(phone, text) {
  try {
    if (!WAHA_BASE_URL || !WAHA_API_KEY) {
      console.error('[Bot] WAHA_BASE_URL atau WAHA_API_KEY tidak dikonfigurasi');
      return;
    }

    let chatId = phone.toString();
    if (!chatId.includes('@')) {
      chatId = `${chatId}@c.us`;
    }

    const url = `${WAHA_BASE_URL}/api/sendText`;
    console.log(`[Bot] Mengirim balasan ke ${chatId}...`);
    
    await axios.post(url, {
      chatId: chatId,
      text: text,
      session: WAHA_SESSION
    }, {
      headers: { 'X-Api-Key': WAHA_API_KEY },
      timeout: 30000 
    });
    
    console.log(`[Bot] Balasan terkirim ke ${chatId}.`);
  } catch (error) {
    console.error('[Bot] Gagal kirim balasan ke', phone, 'Error:', error.response?.data || error.message);
  }
}

module.exports = { sendReply };
