// tests/utils/phone.test.js - Unit test normalisasi & validasi format nomor ID
const { normalizeIDPhone, isPlausibleIDPhone, isStrictIDMobilePhone } = require('../../utils/phone');

describe('normalizeIDPhone', () => {
  test('08xx -> 628xx', () => {
    expect(normalizeIDPhone('08123456789')).toBe('628123456789');
  });

  test('+628xx -> 628xx (plus & strip/spasi dibuang)', () => {
    expect(normalizeIDPhone('+62 812-3456-789')).toBe('628123456789');
  });

  test('628xx tetap', () => {
    expect(normalizeIDPhone('628123456789')).toBe('628123456789');
  });

  test('kosong/null -> string kosong', () => {
    expect(normalizeIDPhone('')).toBe('');
    expect(normalizeIDPhone(null)).toBe('');
    expect(normalizeIDPhone(undefined)).toBe('');
  });
});

describe('isPlausibleIDPhone (ambang realtime)', () => {
  test('di bawah 9 digit -> tidak layak dicek (nol request)', () => {
    expect(isPlausibleIDPhone('08123')).toBe(false);
    expect(isPlausibleIDPhone('')).toBe(false);
  });

  test('nomor ID lengkap -> layak dicek', () => {
    expect(isPlausibleIDPhone('08123456789')).toBe(true);
    expect(isPlausibleIDPhone('628123456789')).toBe(true);
  });

  test('bukan pola ID -> tidak layak', () => {
    expect(isPlausibleIDPhone('+1 555 123 4567')).toBe(false);
  });
});

describe('isStrictIDMobilePhone (gerbang 400 backend)', () => {
  test('menerima 08xx / 628xx / +628xx seluler', () => {
    expect(isStrictIDMobilePhone('08123456789')).toBe(true);
    expect(isStrictIDMobilePhone('628123456789')).toBe(true);
    expect(isStrictIDMobilePhone('+628123456789')).toBe(true);
  });

  test('menolak terlalu pendek & non-seluler', () => {
    expect(isStrictIDMobilePhone('12345')).toBe(false);
    expect(isStrictIDMobilePhone('0217654321')).toBe(false);
    expect(isStrictIDMobilePhone('')).toBe(false);
  });
});
