const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../bot/botHandler');

// Endpoint untuk menerima Webhook dari WAHA
router.post('/waha-webhook', async (req, res) => {
  try {
    const payload = req.body;
    
    // Log untuk melihat data masuk (bisa dihapus jika sudah stabil)
    // console.log('[WAHA Webhook Event]:', payload.event);

    // Event pesan masuk di WAHA biasanya 'message'
    if (payload.event === 'message') {
      const messageData = payload.payload;
      if (messageData) {
        await handleIncomingMessage(messageData);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;