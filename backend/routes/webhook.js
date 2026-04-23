const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../bot/botHandler');

// Endpoint untuk mengecek status webhook (Debugging via Browser)
router.get('/waha-webhook', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Endpoint Webhook UTC Aktif!',
    usage: 'Gunakan metode POST untuk mengirim data dari WAHA.'
  });
});

// Endpoint untuk menerima Webhook dari WAHA
router.post('/waha-webhook', async (req, res) => {
  try {
    const payload = req.body;
    
    // LOG UNTUK DEBUGGING (PENTING)
    console.log(`[WAHA Webhook] Data Diterima:`, JSON.stringify(payload, null, 2));

    // Mendukung 'message' (Core) atau 'message.upsert' (Plus/Newer)
    if (payload.event === 'message' || payload.event === 'message.upsert' || payload.event === 'message.any') {
      const messageData = payload.payload || payload.data;
      
      if (messageData) {
        console.log(`[WAHA Webhook] Pesan dari: ${messageData.from}, Isi: ${messageData.body}`);
        await handleIncomingMessage(messageData);
      } else {
        console.log('[WAHA Webhook] Data pesan kosong');
      }
    } else {
      console.log(`[WAHA Webhook] Event ${payload.event} diabaikan.`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;