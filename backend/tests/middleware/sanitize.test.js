// tests/middleware/sanitize.test.js - Proteksi NoSQL Injection
const sanitize = require('../../middleware/sanitize');

describe('sanitize middleware', () => {
  const jalan = (req) => {
    const res = {};
    const next = jest.fn();
    sanitize(req, res, next);
    expect(next).toHaveBeenCalled();
    return req;
  };

  it('should strip MongoDB operators from body', () => {
    const req = jalan({
      body: { username: 'admin', password: { $ne: null } },
      query: {},
      params: {}
    });
    expect(req.body).toEqual({ username: 'admin' });
  });

  it('should strip keys containing dots', () => {
    const req = jalan({
      body: { 'a.b': 'x', normal: 1 },
      query: {},
      params: {}
    });
    expect(req.body).toEqual({ normal: 1 });
  });

  it('should sanitize nested objects and arrays', () => {
    const req = jalan({
      body: { filter: { role: { $in: ['admin'] } }, items: [{ $gt: 1, qty: 2 }] },
      query: {},
      params: {}
    });
    // Objek yang kosong setelah dibersihkan ikut dibuang seluruhnya
    expect(req.body).toEqual({ items: [{ qty: 2 }] });
  });

  it('should sanitize query and params in place', () => {
    const req = jalan({
      body: {},
      query: { $where: 'evil', nama: 'budi' },
      params: { id: '123' }
    });
    expect(req.query).toEqual({ nama: 'budi' });
  });

  it('should keep legitimate values with dots (e.g. emails)', () => {
    const req = jalan({
      body: { email: 'user@example.com', harga: 10.5 },
      query: {},
      params: {}
    });
    expect(req.body).toEqual({ email: 'user@example.com', harga: 10.5 });
  });
});
