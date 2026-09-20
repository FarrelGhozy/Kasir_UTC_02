/**
 * @jest-environment jsdom
 */
import api, { getAuthImageUrl } from '../public/js/api.js';

describe('getAuthImageUrl(url) & api.getAuthUrl(url)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('return empty string untuk url falsy', () => {
    expect(getAuthImageUrl('')).toBe('');
    expect(getAuthImageUrl(null)).toBe('');
    expect(getAuthImageUrl(undefined)).toBe('');
    expect(api.getAuthUrl('')).toBe('');
  });

  it('return url asli bila tidak ada token di localStorage', () => {
    const url = 'https://kasir.utc.web.id/api/uploads/file.jpg';
    expect(getAuthImageUrl(url)).toBe(url);
    expect(api.getAuthUrl(url)).toBe(url);
  });

  it('menambahkan ?token=xxx pada URL absolut tanpa query', () => {
    window.localStorage.setItem('token', 'jwt123');
    const url = 'https://kasir.utc.web.id/api/uploads/Risya_Laptop_front_168ddefe.jpg';
    const result = getAuthImageUrl(url);
    expect(result).toBe('https://kasir.utc.web.id/api/uploads/Risya_Laptop_front_168ddefe.jpg?token=jwt123');
    expect(api.getAuthUrl(url)).toBe(result);
  });

  it('menambahkan &token=xxx bila URL sudah punya query', () => {
    window.localStorage.setItem('token', 'jwt123');
    const url = 'https://kasir.utc.web.id/api/uploads/file.jpg?foo=bar';
    const result = getAuthImageUrl(url);
    expect(result).toContain('foo=bar');
    expect(result).toContain('token=jwt123');
    expect(result).toMatch(/\?foo=bar&token=jwt123|\?token=jwt123&foo=bar/);
  });

  it('tidak menambah token dua kali bila url sudah punya token', () => {
    window.localStorage.setItem('token', 'jwt123');
    const url = 'https://kasir.utc.web.id/api/uploads/file.jpg?token=existing';
    expect(getAuthImageUrl(url)).toBe(url);
  });

  it('handle URL relatif /api/uploads/file.jpg', () => {
    window.localStorage.setItem('token', 'jwt123');
    const url = '/api/uploads/file.jpg';
    const result = getAuthImageUrl(url);
    // origin depends on jsdom (http://localhost), so check pathname + token
    expect(result).toContain('/api/uploads/file.jpg');
    expect(result).toContain('token=jwt123');
    const u = new URL(result);
    expect(u.searchParams.get('token')).toBe('jwt123');
  });

  it('encode token yang mengandung karakter khusus', () => {
    window.localStorage.setItem('token', 'a+b/c=d e');
    const url = '/api/uploads/file.jpg';
    const result = getAuthImageUrl(url);
    const u = new URL(result);
    expect(u.searchParams.get('token')).toBe('a+b/c=d e');
  });

  it('fallback concatenation bila URL tidak valid untuk new URL()', () => {
    window.localStorage.setItem('token', 'jwt123');
    // Simulate URL constructor throwing by passing weird but still string
    // getAuthImageUrl catches exception and does manual concat
    const originalURL = global.URL;
    global.URL = class { constructor() { throw new Error('invalid'); } };
    const url = 'http://bad url with spaces/file.jpg';
    const result = getAuthImageUrl(url);
    expect(result).toContain('token=' + encodeURIComponent('jwt123'));
    global.URL = originalURL;
  });
});
