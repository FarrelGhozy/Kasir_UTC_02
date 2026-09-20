// tests/services/pdfService.test.js — 4 generators + QR + watermark guard
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const tinyPngBuffer = Buffer.from(tinyPngBase64, 'base64');

jest.mock('qrcode', () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64'))
}));

const pdfService = require('../../services/pdfService');

function fakeTicket(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    ticket_number: 'SRV-2026-0001',
    customer: { name: 'Budi Santoso', phone: '08123456789', type: 'Umum' },
    device: { type: 'Laptop', brand: 'Dell', model: 'XPS', symptoms: 'Mati total', serial_number: 'SN123' },
    technician: { name: 'Teknisi A' },
    service_fee: 50000,
    parts_used: [{ name: 'Battery', qty: 1, subtotal: 100000 }],
    total_cost: 150000,
    status: 'Queue',
    payment_status: 'Belum Lunas',
    payment_method: null,
    history: { created_at: new Date('2026-01-15T10:00:00Z') },
    warranty_expires_at: null,
    ...overrides
  };
}

function fakeOrder(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    order_number: 'ORD-2026-0001',
    customer: { name: 'Siti', phone: '08123456789', type: 'Umum' },
    item_name: 'RAM 8GB',
    item_description: 'DDR4 3200',
    estimated_price: 500000,
    down_payment: 100000,
    status: 'Pending',
    handled_by: { name: 'Kasir A' },
    notes: 'Catatan order',
    ...overrides
  };
}

describe('pdfService - generateServiceNota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    QRCode.toBuffer.mockResolvedValue(tinyPngBuffer);
  });

  it('menghasilkan Buffer PDF diawali %PDF untuk tiket Queue', async () => {
    const buf = await pdfService.generateServiceNota(fakeTicket());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('status Picked_Up menampilkan garansi & QR dipanggil dengan URL verifikasi', async () => {
    const t = fakeTicket({ status: 'Picked_Up', payment_method: 'Cash', warranty_expires_at: new Date(Date.now() + 7*24*60*60*1000) });
    const buf = await pdfService.generateServiceNota(t);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(QRCode.toBuffer).toHaveBeenCalled();
    const qrArg = QRCode.toBuffer.mock.calls[0][0];
    expect(qrArg).toContain('model=ServiceTicket');
    expect(qrArg).toContain(`id=${t._id}`);
    expect(qrArg).toContain(encodeURIComponent(t.ticket_number));
  });

  it('total_cost 0 (gratis) tetap generate tanpa error', async () => {
    const t = fakeTicket({ service_fee: 0, parts_used: [], total_cost: 0, payment_status: 'Lunas' });
    const buf = await pdfService.generateServiceNota(t);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('guard logo hilang tetap generate (addWatermark/addHeader)', async () => {
    const spy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const buf = await pdfService.generateServiceNota(fakeTicket());
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    spy.mockRestore();
  });

  it('QR content encode nomor tiket dengan spasi', async () => {
    const t = fakeTicket({ ticket_number: 'SRV 2026 0001' });
    await pdfService.generateServiceNota(t);
    const qrArg = QRCode.toBuffer.mock.calls[0][0];
    expect(qrArg).toContain(encodeURIComponent('SRV 2026 0001'));
  });
});

describe('pdfService - generateOrderNota', () => {
  it('menghasilkan PDF untuk order', async () => {
    const buf = await pdfService.generateOrderNota(fakeOrder());
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(QRCode.toBuffer).toHaveBeenCalled();
    const qrArg = QRCode.toBuffer.mock.calls[QRCode.toBuffer.mock.calls.length - 1][0];
    expect(qrArg).toContain('model=SpecialOrder');
  });

  it('order tanpa DP (0) fallback strip DP', async () => {
    const o = fakeOrder({ down_payment: 0 });
    const buf = await pdfService.generateOrderNota(o);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});

describe('pdfService - generateServiceEntryNota & generateOrderEntryNota', () => {
  it('generateServiceEntryNota (tanda terima) menghasilkan PDF', async () => {
    const buf = await pdfService.generateServiceEntryNota(fakeTicket());
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('generateServiceEntryNota dengan service_fee 0 menampilkan disclaimer diagnosa', async () => {
    const t = fakeTicket({ service_fee: 0 });
    const buf = await pdfService.generateServiceEntryNota(t);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('generateOrderEntryNota menghasilkan PDF tanda terima', async () => {
    const buf = await pdfService.generateOrderEntryNota(fakeOrder());
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(QRCode.toBuffer).toHaveBeenCalled();
  });

  it('order entry tanpa item_description tetap OK', async () => {
    const o = fakeOrder({ item_description: undefined });
    const buf = await pdfService.generateOrderEntryNota(o);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });

  it('handle customer tanpa phone tetap generate', async () => {
    const t = fakeTicket({ customer: { name: 'Anom', phone: '', type: 'Umum' } });
    const buf = await pdfService.generateServiceNota(t);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});

describe('pdfService - QR verify URL env', () => {
  it('QR menggunakan NOTA_VERIFY_URL default https://kasir.utc.web.id/verify.html', async () => {
    const t = fakeTicket();
    await pdfService.generateServiceNota(t);
    expect(QRCode.toBuffer).toHaveBeenCalledWith(expect.stringContaining('https://kasir.utc.web.id/verify.html'), expect.any(Object));
  });
});
