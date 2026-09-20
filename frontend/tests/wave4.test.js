/**
 * @jest-environment jsdom
 */
import { isWARejection, escapeHTML, formatCurrency, toLocalDateString } from '../public/js/api.js';

describe('isWARejection(error)', () => {
  it('true untuk statusCode 422', () => {
    const e = new Error('Nomor tidak terdeteksi');
    e.statusCode = 422;
    expect(isWARejection(e)).toBe(true);
  });

  it('false untuk 400/500', () => {
    const e400 = new Error('bad');
    e400.statusCode = 400;
    expect(isWARejection(e400)).toBe(false);
    const e500 = new Error('srv');
    e500.statusCode = 500;
    expect(isWARejection(e500)).toBe(false);
  });

  it('false untuk null/undefined/pesan biasa', () => {
    expect(isWARejection(null)).toBe(false);
    expect(isWARejection(undefined)).toBe(false);
    expect(isWARejection(new Error('WhatsApp error'))).toBe(false);
  });
});

describe('XSS guard di laporan (escapeHTML dipakai render)', () => {
  it('escapeHTML menetralkan script di nama barang', () => {
    const evil = '<script>alert(1)</script>';
    const out = escapeHTML(evil);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapeHTML aman untuk atribut (quotes)', () => {
    expect(escapeHTML('a"b\'c')).toBe('a&quot;b&#039;c');
  });
});

describe('formatCurrency/toLocalDateString NaN-proof (Wave 1 guard)', () => {
  it('formatCurrency(undefined/NaN) -> Rp 0', () => {
    expect(formatCurrency(undefined)).toBe('Rp\u00a00');
    expect(formatCurrency(NaN)).toBe('Rp\u00a00');
  });

  it('toLocalDateString invalid -> string kosong', () => {
    expect(toLocalDateString('bukan-tanggal')).toBe('');
  });
});
