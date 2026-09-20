const axios = require('axios');
const { normalizeIDPhone } = require('../utils/phone');

async function sendReply(phone, text) {
  try {
    const WAHA_BASE_URL = process.env.WAHA_URL;
    const WAHA_API_KEY = process.env.WAHA_API_KEY;
    const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
    if (!WAHA_BASE_URL || !WAHA_API_KEY) {
      console.error('[Bot] WAHA_BASE_URL atau WAHA_API_KEY tidak dikonfigurasi');
      return;
    }

    // Normalisasi 08xx -> 628xx agar chatId selalu valid (reminder piket/weekend
    // menyimpan nomor format 08xx, tanpa ini chatId 08xx@c.us tidak terkirim).
    let chatId = normalizeIDPhone(phone);
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

async function markChatUnread(phone) {
  try {
    const WAHA_BASE_URL = process.env.WAHA_URL;
    const WAHA_API_KEY = process.env.WAHA_API_KEY;
    const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
    if (!WAHA_BASE_URL || !WAHA_API_KEY) return;
    let chatId = normalizeIDPhone(phone);
    if (!chatId.includes('@')) {
      chatId = `${chatId}@c.us`;
    }
    const url = `${WAHA_BASE_URL}/api/${WAHA_SESSION}/chats/${encodeURIComponent(chatId)}/unread`;
    await axios.post(url, {}, {
      headers: { 'X-Api-Key': WAHA_API_KEY },
      timeout: 5000
    });
    console.log(`[Bot] Chat ${chatId} ditandai belum dibaca.`);
  } catch (error) {
    // Gagal mark unread bukan masalah krusial
    if (error.response?.status !== 404) {
      console.error('[Bot] Gagal mark unread:', error.message);
    }
  }
}

module.exports = { sendReply, markChatUnread };
