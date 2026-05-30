const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../bot/botHandler');
const { markChatUnread } = require('../bot/wahaClient');

// Deduplikasi webhook — cache message ID yang sudah diproses (15 detik)
const processedMessages = new Map();
const DEDUP_TTL = 15_000;

function getMessageId(payload) {
  return payload?.payload?.id || payload?.data?.id || payload?.id || '';
}

function isAlreadyProcessed(msgId) {
  if (!msgId) return false;
  const key = `msg_${msgId}`;
  if (processedMessages.has(key)) return true;
  processedMessages.set(key, Date.now());
  return false;
}

// Bersihin cache setiap 30 detik
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of processedMessages) {
    if (now - time > DEDUP_TTL) processedMessages.delete(key);
  }
}, 30_000);

function validateWebhookAuth(req) {
  const secret = process.env.WAHA_WEBHOOK_SECRET;
  if (!secret) return true; // Jika tidak dikonfigurasi, lewati (backward compat)
  const token = req.query.token || req.headers['x-webhook-token'];
  return token === secret;
}

function normalizeWAHA(payload) {
  // Format WAHA Plus (raw Baileys message): { key: { remoteJid, fromMe }, message: { conversation, ... } }
  if (payload.key) {
    const remoteJid = payload.key.remoteJid || '';
    return {
      from: remoteJid,
      fromMe: payload.key.fromMe || false,
      isGroup: remoteJid.includes('@g.us'),
      isStatus: remoteJid === 'status@broadcast',
      body: extractMessageText(payload.message)
    };
  }
  // Format WAHA Core: { from, body, fromMe, isGroup, isStatus }
  return {
    from: payload.from || '',
    fromMe: payload.fromMe || false,
    isGroup: payload.isGroup || false,
    isStatus: payload.isStatus || false,
    body: payload.body || ''
  };
}

function extractMessageText(msg) {
  if (!msg) return '';
  return msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    '';
}

router.get('/waha-webhook', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Endpoint Webhook UTC Aktif!',
    usage: 'Gunakan metode POST untuk mengirim data dari WAHA.'
  });
});

router.post('/waha-webhook', async (req, res) => {
  try {
    if (!validateWebhookAuth(req)) {
      console.warn('[WAHA Webhook] Auth gagal — token tidak valid');
      return res.status(403).send('Forbidden');
    }

    const payload = req.body;

    if (payload.event === 'message' || payload.event === 'message.upsert' || payload.event === 'message.any') {
      const raw = payload.payload || payload.data;

      if (raw) {
        // Deduplikasi
        const msgId = getMessageId(raw);
        if (isAlreadyProcessed(msgId)) {
          console.log(`[WAHA Webhook] Duplicate dicegah: ${msgId}`);
          return res.status(200).send('OK');
        }

        const normalized = normalizeWAHA(raw);
        console.log(`[WAHA Webhook] Pesan dari: ${normalized.from}, Isi: ${normalized.body}`);

        if (normalized.from) {
          await handleIncomingMessage(normalized);
          // Mark chat sbg belum dibaca — centang biru tidak muncul di pengirim
          if (!normalized.fromMe) {
            markChatUnread(normalized.from).catch(() => {});
          }
        } else {
          console.log('[WAHA Webhook] from kosong, dilewati');
        }
      } else {
        console.log('[WAHA Webhook] Data pesan kosong');
      }
    } else {
      console.log(`[WAHA Webhook] Event ${payload.event} diabaikan.`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error:', error.message);
    console.error('[Webhook] Stack:', error.stack);
    // Tetap return 200 agar WAHA tidak retry terus-menerus
    res.status(200).send('OK');
  }
});

module.exports = router;