const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createAdmin, createKasir } = require('../helpers/factory');

const apiRoutes = require('../../routes/api');
const webhookRoutes = require('../../routes/webhook');
const sanitize = require('../../middleware/sanitize');
const errorHandler = require('../../middleware/errorHandler');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(sanitize);
  app.use('/api', apiRoutes);
  app.use('/api', webhookRoutes);
  app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));
  app.use((req, res) => res.status(404).json({ success: false, message: 'Rute tidak ditemukan' }));
  app.use(errorHandler);
  return app;
}

function makeToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role, tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('API routes integration', () => {
  let admin, kasir, adminToken, kasirToken;
  let app;

  beforeAll(async () => {
    app = makeApp();
  });

  beforeEach(async () => {
    admin = await createAdmin();
    kasir = await createKasir();
    adminToken = makeToken(admin);
    kasirToken = makeToken(kasir);
  });

  it('GET /health -> 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('GET /api/inventory tanpa token -> 401', async () => {
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);
  });

  it('GET /api/inventory dengan token kasir -> 200', async () => {
    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${kasirToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/inventory/summary/value kasir -> 403 (admin only)', async () => {
    const res = await request(app).get('/api/inventory/summary/value').set('Authorization', `Bearer ${kasirToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/inventory/summary/value admin -> 200', async () => {
    const res = await request(app).get('/api/inventory/summary/value').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('POST /api/auth/login valid -> 200 + token', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: kasir.username, password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('POST /api/auth/login invalid -> 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'tidakada', password: 'salah' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me dengan token -> 200', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${kasirToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(kasir.username);
  });

  it('GET /api/auth/me dengan token via query ?token= -> 200', async () => {
    const res = await request(app).get(`/api/auth/me?token=${kasirToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/waha-webhook -> 200', async () => {
    const res = await request(app).get('/api/waha-webhook');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/waha-webhook dengan secret salah di production -> 403', async () => {
    const oldEnv = process.env.NODE_ENV;
    const oldSecret = process.env.WAHA_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';
    process.env.WAHA_WEBHOOK_SECRET = 's3cr3t';
    const res = await request(app).post('/api/waha-webhook').send({ event: 'message', payload: {} });
    expect(res.status).toBe(403);
    process.env.NODE_ENV = oldEnv;
    if (oldSecret) process.env.WAHA_WEBHOOK_SECRET = oldSecret;
    else delete process.env.WAHA_WEBHOOK_SECRET;
  });

  it('404 handler', async () => {
    const res = await request(app).get('/api/unknown-route-xyz').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('sanitize: NoSQL injection dibersihkan', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: { $ne: null } });
    // Should be 401 not 500, karena $ne dibuang jadi password string
    expect([400, 401]).toContain(res.status);
  });

  it('GET /api/verify-nota/:model/:id dengan id invalid -> 400', async () => {
    const app2 = express();
    // Need to mount verify-nota route manually (from server.js)
    const ServiceTicket = require('../../models/ServiceTicket');
    const SpecialOrder = require('../../models/SpecialOrder');
    app2.get('/api/verify-nota/:model/:id', async (req, res) => {
      try {
        res.set('Cache-Control', 'no-store');
        const { model, id } = req.params;
        let doc;
        if (model === 'ServiceTicket') doc = await ServiceTicket.findById(id).lean();
        else if (model === 'SpecialOrder') doc = await SpecialOrder.findById(id).lean();
        if (!doc) return res.status(404).json({ success: false });
        res.status(200).json({ success: true, data: doc });
      } catch (e) {
        res.status(400).json({ success: false });
      }
    });
    const res = await request(app2).get('/api/verify-nota/ServiceTicket/invalid-id');
    expect(res.status).toBe(400);
  });
});
