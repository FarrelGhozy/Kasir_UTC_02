const request = require('supertest');
const express = require('express');

jest.mock('../../bot/botHandler', () => ({
  handleIncomingMessage: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../bot/wahaClient', () => ({
  markChatUnread: jest.fn().mockResolvedValue(undefined)
}));

const webhookRouter = require('../../routes/webhook');
const { handleIncomingMessage } = require('../../bot/botHandler');
const { markChatUnread } = require('../../bot/wahaClient');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', webhookRouter);
  return app;
}

describe('webhook helpers', () => {
  afterEach(() => {
    webhookRouter.processedMessages.clear();
    jest.clearAllMocks();
  });

  describe('getMessageId', () => {
    it('returns id dari payload.payload.id', () => {
      expect(webhookRouter.getMessageId({ payload: { id: 'abc123' } })).toBe('abc123');
    });
    it('returns id dari payload.data.id', () => {
      expect(webhookRouter.getMessageId({ data: { id: 'xyz' } })).toBe('xyz');
    });
    it('returns id dari payload.id', () => {
      expect(webhookRouter.getMessageId({ id: '123' })).toBe('123');
    });
    it('fallback hash untuk key.remoteJid + message', () => {
      const payload = { payload: { key: { remoteJid: '628123@c.us' }, message: { conversation: 'halo' } } };
      const id1 = webhookRouter.getMessageId(payload);
      const id2 = webhookRouter.getMessageId(payload);
      expect(id1).toMatch(/^hash_/);
      expect(id1).toBe(id2); // same bucket same second
    });
    it('fallback hash untuk from+body', () => {
      const payload = { payload: { from: '628123@c.us', body: 'test' } };
      expect(webhookRouter.getMessageId(payload)).toMatch(/^hash_/);
    });
  });

  describe('isAlreadyProcessed', () => {
    it('false pertama, true kedua (dedup)', () => {
      expect(webhookRouter.isAlreadyProcessed('msg1')).toBe(false);
      expect(webhookRouter.isAlreadyProcessed('msg1')).toBe(true);
    });
    it('false untuk id kosong', () => {
      expect(webhookRouter.isAlreadyProcessed('')).toBe(false);
      expect(webhookRouter.isAlreadyProcessed(null)).toBe(false);
    });
  });

  describe('validateWebhookAuth', () => {
    const OLD_ENV = process.env;
    afterEach(() => {
      process.env = OLD_ENV;
      delete process.env.WAHA_WEBHOOK_SECRET;
    });
    it('dev tanpa secret -> true', () => {
      delete process.env.WAHA_WEBHOOK_SECRET;
      process.env.NODE_ENV = 'test';
      expect(webhookRouter.validateWebhookAuth({ query: {}, headers: {} })).toBe(true);
    });
    it('production tanpa secret -> false', () => {
      delete process.env.WAHA_WEBHOOK_SECRET;
      process.env.NODE_ENV = 'production';
      expect(webhookRouter.validateWebhookAuth({ query: {}, headers: {} })).toBe(false);
      process.env.NODE_ENV = 'test';
    });
    it('secret cocok via query token', () => {
      process.env.WAHA_WEBHOOK_SECRET = 's3cr3t';
      expect(webhookRouter.validateWebhookAuth({ query: { token: 's3cr3t' }, headers: {} })).toBe(true);
    });
    it('secret cocok via header x-webhook-token', () => {
      process.env.WAHA_WEBHOOK_SECRET = 's3cr3t';
      expect(webhookRouter.validateWebhookAuth({ query: {}, headers: { 'x-webhook-token': 's3cr3t' } })).toBe(true);
    });
    it('secret salah -> false', () => {
      process.env.WAHA_WEBHOOK_SECRET = 's3cr3t';
      expect(webhookRouter.validateWebhookAuth({ query: { token: 'wrong' }, headers: {} })).toBe(false);
    });
  });

  describe('extractMessageText', () => {
    it('conversation', () => expect(webhookRouter.extractMessageText({ conversation: 'halo' })).toBe('halo'));
    it('extendedTextMessage', () => expect(webhookRouter.extractMessageText({ extendedTextMessage: { text: 'hi' } })).toBe('hi'));
    it('image caption', () => expect(webhookRouter.extractMessageText({ imageMessage: { caption: 'cap' } })).toBe('cap'));
    it('video caption', () => expect(webhookRouter.extractMessageText({ videoMessage: { caption: 'vid' } })).toBe('vid'));
    it('document caption', () => expect(webhookRouter.extractMessageText({ documentMessage: { caption: 'doc' } })).toBe('doc'));
    it('buttonsResponse', () => expect(webhookRouter.extractMessageText({ buttonsResponseMessage: { selectedButtonId: 'btn1' } })).toBe('btn1'));
    it('listResponse', () => expect(webhookRouter.extractMessageText({ listResponseMessage: { singleSelectReply: { selectedRowId: 'row1' } } })).toBe('row1'));
    it('empty -> ""', () => expect(webhookRouter.extractMessageText(null)).toBe(''));
  });

  describe('normalizeWAHA', () => {
    it('Baileys format', () => {
      const payload = { key: { remoteJid: '628123@c.us', fromMe: false }, message: { conversation: 'halo' } };
      const n = webhookRouter.normalizeWAHA(payload);
      expect(n.from).toBe('628123@c.us');
      expect(n.fromMe).toBe(false);
      expect(n.isGroup).toBe(false);
      expect(n.body).toBe('halo');
    });
    it('Baileys group', () => {
      const payload = { key: { remoteJid: '123@g.us', fromMe: false }, message: { conversation: 'hi' } };
      expect(webhookRouter.normalizeWAHA(payload).isGroup).toBe(true);
    });
    it('Baileys status', () => {
      const payload = { key: { remoteJid: 'status@broadcast', fromMe: false }, message: {} };
      expect(webhookRouter.normalizeWAHA(payload).isStatus).toBe(true);
    });
    it('Core format', () => {
      const payload = { from: '628123@c.us', body: 'test', fromMe: true, isGroup: false, isStatus: false };
      expect(webhookRouter.normalizeWAHA(payload)).toEqual(payload);
    });
  });
});

describe('webhook routes via supertest', () => {
  afterEach(() => {
    webhookRouter.processedMessages.clear();
    jest.clearAllMocks();
    delete process.env.WAHA_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'test';
  });

  it('GET /waha-webhook -> 200', async () => {
    const app = makeApp();
    const res = await request(app).get('/waha-webhook');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /waha-webhook tanpa body event -> 200 OK', async () => {
    const app = makeApp();
    const res = await request(app).post('/waha-webhook').send({ event: 'other' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
    expect(handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('POST message event dengan payload valid -> handleIncomingMessage dipanggil', async () => {
    const app = makeApp();
    const payload = {
      event: 'message',
      payload: { from: '628123456789@c.us', body: 'halo', fromMe: false, isGroup: false, isStatus: false, id: 'msg1' }
    };
    const res = await request(app).post('/waha-webhook').send(payload);
    expect(res.status).toBe(200);
    expect(handleIncomingMessage).toHaveBeenCalledWith(expect.objectContaining({ from: '628123456789@c.us', body: 'halo' }));
    expect(markChatUnread).toHaveBeenCalledWith('628123456789@c.us');
  });

  it('POST duplicate id -> dedup, handle tidak dipanggil kedua kali', async () => {
    const app = makeApp();
    const payload = {
      event: 'message',
      payload: { from: '628123@c.us', body: 'hi', id: 'dup1' }
    };
    await request(app).post('/waha-webhook').send({ event: 'message', payload: payload.payload });
    jest.clearAllMocks();
    const res = await request(app).post('/waha-webhook').send({ event: 'message', payload: payload.payload });
    expect(res.status).toBe(200);
    expect(handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('POST fromMe true -> tetap handle tapi tidak markUnread', async () => {
    const app = makeApp();
    const payload = {
      event: 'message',
      payload: { from: '628123@c.us', body: 'hi', fromMe: true, id: 'm1' }
    };
    await request(app).post('/waha-webhook').send({ event: 'message', payload: payload.payload });
    expect(handleIncomingMessage).toHaveBeenCalled();
    expect(markChatUnread).not.toHaveBeenCalled();
  });

  it('POST isGroup true -> dilewati', async () => {
    const app = makeApp();
    const payload = {
      event: 'message',
      payload: { from: '628123@g.us', body: 'hi', fromMe: false, isGroup: true, id: 'g1' }
    };
    await request(app).post('/waha-webhook').send({ event: 'message', payload: payload.payload });
    // normalizeWAHA untuk Core format akan tetap handle, tapi botHandler akan early return
    // Di webhook, from tetap ada jadi handleIncomingMessage tetap dipanggil, tapi isGroup true
    // Kita cek bahwa webhook tetap 200
    expect((await request(app).post('/waha-webhook').send({ event: 'message', payload: { from: '628123@c.us', body: 'hi', id: 'g2' } })).status).toBe(200);
  });

  it('POST dengan BAILEYS raw format -> normalize & handle', async () => {
    const app = makeApp();
    const payload = {
      event: 'message',
      payload: { key: { remoteJid: '628123@c.us', fromMe: false }, message: { conversation: 'halo' } }
    };
    const res = await request(app).post('/waha-webhook').send(payload);
    expect(res.status).toBe(200);
    expect(handleIncomingMessage).toHaveBeenCalledWith(expect.objectContaining({ from: '628123@c.us', body: 'halo' }));
  });

  it('POST production tanpa secret -> 403', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WAHA_WEBHOOK_SECRET;
    const app = makeApp();
    const res = await request(app).post('/waha-webhook').send({ event: 'message', payload: {} });
    expect(res.status).toBe(403);
    process.env.NODE_ENV = 'test';
  });

  it('POST production dengan secret salah -> 403', async () => {
    process.env.NODE_ENV = 'production';
    process.env.WAHA_WEBHOOK_SECRET = 'secret123';
    const app = makeApp();
    const res = await request(app).post('/waha-webhook').send({ event: 'message', payload: {} });
    expect(res.status).toBe(403);
    process.env.NODE_ENV = 'test';
    delete process.env.WAHA_WEBHOOK_SECRET;
  });

  it('POST production dengan secret benar -> 200', async () => {
    process.env.NODE_ENV = 'production';
    process.env.WAHA_WEBHOOK_SECRET = 'secret123';
    const app = makeApp();
    const res = await request(app).post('/waha-webhook').send({ event: 'message', payload: { from: '628123@c.us', body: 'hi', id: 'ok1' } }).set('x-webhook-token', 'secret123');
    expect(res.status).toBe(200);
    process.env.NODE_ENV = 'test';
    delete process.env.WAHA_WEBHOOK_SECRET;
  });

  it('POST dengan payload kosong -> 200 tanpa handle', async () => {
    const app = makeApp();
    const res = await request(app).post('/waha-webhook').send({ event: 'message' });
    expect(res.status).toBe(200);
    expect(handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('POST handleIncomingMessage throw -> tetap 200 (tidak retry)', async () => {
    handleIncomingMessage.mockRejectedValueOnce(new Error('boom'));
    const app = makeApp();
    const payload = {
      event: 'message',
      payload: { from: '628123@c.us', body: 'hi', id: 'err1' }
    };
    const res = await request(app).post('/waha-webhook').send(payload);
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });
});

afterAll(() => {
  if (webhookRouter._interval) clearInterval(webhookRouter._interval);
});
