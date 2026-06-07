/**
 * @jest-environment jsdom
 */

import api, {
  formatCurrency,
  formatWhatsAppNumber,
  formatDate,
  formatDateTime,
  toLocalDateString,
  escapeHTML,
  formatInputCurrency,
  parseCurrencyValue,
  calculateElapsedTime,
  loadScript,
  setupCurrencyInput,
  confirmDialog,
  showToast,
  showLoading,
  showError,
  validateWhatsApp,
} from '../public/js/api.js';

// ───── Setup ─────

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: (() => {
      let store = {};
      return {
        getItem: jest.fn((key) => store[key] ?? null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; }),
      };
    })(),
    writable: true,
  });
});

beforeEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
  window.confirm = jest.fn();
  window.bootstrap = {
    Toast: jest.fn().mockImplementation(() => ({ show: jest.fn() })),
  };
});

// ───── formatCurrency ─────

describe('formatCurrency(amount)', () => {
  it('mengembalikan "Rp 0" untuk angka 0', () => {
    expect(formatCurrency(0)).toBe('Rp\u00a00');
  });

  it('mengembalikan "Rp 15.000" untuk 15000', () => {
    expect(formatCurrency(15000)).toBe('Rp\u00a015.000');
  });

  it('mengembalikan "Rp 1.000.000" untuk 1 juta', () => {
    expect(formatCurrency(1000000)).toBe('Rp\u00a01.000.000');
  });

  it('mengembalikan "Rp 500" untuk 500', () => {
    expect(formatCurrency(500)).toBe('Rp\u00a0500');
  });

  it('menangani null dengan mengonversi ke 0', () => {
    expect(formatCurrency(null)).toBe('Rp\u00a00');
  });

  it('menangani undefined (menjadi NaN)', () => {
    const result = formatCurrency(undefined);
    expect(result).toContain('NaN');
  });
});

// ───── formatWhatsAppNumber ─────

describe('formatWhatsAppNumber(phone)', () => {
  it('mengubah "08123456789" menjadi "628123456789"', () => {
    expect(formatWhatsAppNumber('08123456789')).toBe('628123456789');
  });

  it('mempertahankan "628123456789" jika sudah benar', () => {
    expect(formatWhatsAppNumber('628123456789')).toBe('628123456789');
  });

  it('menghapus "+" dari "+628123456789"', () => {
    expect(formatWhatsAppNumber('+628123456789')).toBe('628123456789');
  });

  it('menangani nomor dengan spasi dan tanda hubung', () => {
    expect(formatWhatsAppNumber('0812-3456 789')).toBe('628123456789');
  });

  it('mengembalikan string kosong untuk null', () => {
    expect(formatWhatsAppNumber(null)).toBe('');
  });

  it('mengembalikan string kosong untuk undefined', () => {
    expect(formatWhatsAppNumber(undefined)).toBe('');
  });

  it('mengembalikan string kosong untuk string kosong', () => {
    expect(formatWhatsAppNumber('')).toBe('');
  });
});

// ───── formatDate ─────

describe('formatDate(date)', () => {
  it('memformat Date object dengan benar', () => {
    expect(formatDate(new Date(2024, 5, 15))).toBe('15 Juni 2024');
  });

  it('memformat string tanggal yang valid', () => {
    const result = formatDate('2024-06-15');
    expect(result).toBe('15 Juni 2024');
  });

  it('mengembalikan "-" untuk null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('mengembalikan "-" untuk undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('mengembalikan "-" untuk string kosong', () => {
    expect(formatDate('')).toBe('-');
  });

  it('menangani tanggal tidak valid', () => {
    const result = formatDate('not-a-date');
    expect(result).toContain('Invalid');
  });
});

// ───── formatDateTime ─────

describe('formatDateTime(date)', () => {
  it('memformat Date object dengan tanggal dan waktu', () => {
    const result = formatDateTime(new Date(2024, 5, 15, 10, 30));
    expect(result).toBe('15 Juni 2024 pukul 10.30');
  });

  it('memformat string tanggal yang valid', () => {
    const result = formatDateTime('2024-06-15T10:30:00');
    expect(result).toBe('15 Juni 2024 pukul 10.30');
  });

  it('mengembalikan "-" untuk null', () => {
    expect(formatDateTime(null)).toBe('-');
  });

  it('mengembalikan "-" untuk undefined', () => {
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('menangani tanggal tidak valid', () => {
    const result = formatDateTime('bukan-tanggal');
    expect(result).toContain('Invalid');
  });
});

// ───── toLocalDateString ─────

describe('toLocalDateString(date)', () => {
  it('mengonversi Date object ke "YYYY-MM-DD"', () => {
    expect(toLocalDateString(new Date(2024, 5, 15))).toBe('2024-06-15');
  });

  it('mengonversi string tanggal ke "YYYY-MM-DD"', () => {
    const result = toLocalDateString('2024-06-15');
    expect(result.length).toBe(10);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('mengembalikan string kosong untuk null', () => {
    expect(toLocalDateString(null)).toBe('');
  });

  it('mengembalikan string kosong untuk undefined', () => {
    expect(toLocalDateString(undefined)).toBe('');
  });

  it('mengembalikan string kosong untuk string kosong', () => {
    expect(toLocalDateString('')).toBe('');
  });

  it('menghasilkan "NaN-NaN-NaN" untuk tanggal tidak valid', () => {
    const result = toLocalDateString('bukan-tanggal');
    expect(result).toMatch(/^N+aN-N+aN-N+aN$/);
  });

  it('menangani timestamp number', () => {
    const ts = new Date(2024, 5, 15).getTime();
    expect(toLocalDateString(ts)).toBe('2024-06-15');
  });
});

// ───── escapeHTML ─────

describe('escapeHTML(str)', () => {
  it('meng-escape tag script XSS', () => {
    const input = " <script>alert('xss')</script> ";
    const output = escapeHTML(input);
    expect(output).not.toContain('<script>');
    expect(output).toContain('&lt;script&gt;');
    expect(output).toContain('&#039;');
  });

  it('mengembalikan string kosong untuk null', () => {
    expect(escapeHTML(null)).toBe('');
  });

  it('mengembalikan string kosong untuk undefined', () => {
    expect(escapeHTML(undefined)).toBe('');
  });

  it('mengembalikan teks normal tanpa perubahan', () => {
    expect(escapeHTML('normal text')).toBe('normal text');
  });

  it('meng-escape semua 5 karakter spesial HTML', () => {
    const input = '&<>"\'';
    expect(escapeHTML(input)).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('menangani string kosong', () => {
    expect(escapeHTML('')).toBe('');
  });

  it('mengonversi number ke string', () => {
    expect(escapeHTML(123)).toBe('123');
  });
});

// ───── formatInputCurrency ─────

describe('formatInputCurrency(value)', () => {
  it('memformat "15000" menjadi "15.000"', () => {
    expect(formatInputCurrency('15000')).toBe('15.000');
  });

  it('memformat "0" menjadi "0"', () => {
    expect(formatInputCurrency('0')).toBe('0');
  });

  it('mengembalikan string kosong untuk string kosong', () => {
    expect(formatInputCurrency('')).toBe('');
  });

  it('mengembalikan string kosong untuk null', () => {
    expect(formatInputCurrency(null)).toBe('');
  });

  it('mengembalikan string kosong untuk undefined', () => {
    expect(formatInputCurrency(undefined)).toBe('');
  });

  it('mengembalikan string kosong untuk input non-digit murni', () => {
    expect(formatInputCurrency('abc')).toBe('');
  });

  it('menangani angka dengan digit campuran', () => {
    expect(formatInputCurrency('12ab34')).toBe('1.234');
  });
});

// ───── parseCurrencyValue ─────

describe('parseCurrencyValue(formattedValue)', () => {
  it('mengurai "15.000" menjadi 15000', () => {
    expect(parseCurrencyValue('15.000')).toBe(15000);
  });

  it('mengembalikan 0 untuk string kosong', () => {
    expect(parseCurrencyValue('')).toBe(0);
  });

  it('mengembalikan 0 untuk input non-digit', () => {
    expect(parseCurrencyValue('abc')).toBe(0);
  });

  it('mengembalikan 0 untuk null', () => {
    expect(parseCurrencyValue(null)).toBe(0);
  });

  it('mengembalikan 0 untuk undefined', () => {
    expect(parseCurrencyValue(undefined)).toBe(0);
  });

  it('mengurai "1.234.567" menjadi 1234567', () => {
    expect(parseCurrencyValue('1.234.567')).toBe(1234567);
  });

  it('mengurai angka tanpa separator', () => {
    expect(parseCurrencyValue('500')).toBe(500);
  });
});

// ───── calculateElapsedTime ─────

describe('calculateElapsedTime(startTime, endTime)', () => {
  const now = new Date(2024, 5, 15, 12, 0, 0);

  it('mengembalikan "5 menit" untuk selisih 5 menit', () => {
    const start = new Date(2024, 5, 15, 11, 55, 0);
    expect(calculateElapsedTime(start, now)).toBe('5 menit');
  });

  it('mengembalikan "2 jam 30 menit" untuk selisih 2,5 jam', () => {
    const start = new Date(2024, 5, 15, 9, 30, 0);
    expect(calculateElapsedTime(start, now)).toBe('2 jam 30 menit');
  });

  it('mengembalikan "3 hari 4 jam" untuk selisih 3 hari 4 jam', () => {
    const start = new Date(2024, 5, 12, 8, 0, 0);
    expect(calculateElapsedTime(start, now)).toBe('3 hari 4 jam');
  });

  it('mengembalikan "Baru saja" untuk waktu di masa depan', () => {
    const future = new Date(2024, 5, 15, 13, 0, 0);
    expect(calculateElapsedTime(future, now)).toBe('Baru saja');
  });

  it('mengembalikan "0 menit" untuk waktu yang sama', () => {
    expect(calculateElapsedTime(now, now)).toBe('0 menit');
  });

  it('menangani hari penuh tanpa jam sisa', () => {
    const start = new Date(2024, 5, 12, 12, 0, 0);
    expect(calculateElapsedTime(start, now)).toBe('3 hari 0 jam');
  });
});

// ───── loadScript ─────

describe('loadScript(src)', () => {
  it('memuat script baru dan resolve', async () => {
    const src = 'https://cdn.example.com/script.js';
    const promise = loadScript(src);

    const scriptEl = document.querySelector(`script[src="${src}"]`);
    expect(scriptEl).not.toBeNull();
    expect(scriptEl.parentNode).toBe(document.head);

    scriptEl.onload(new Event('load'));

    await expect(promise).resolves.toBeUndefined();
  });

  it('resolve segera jika script sudah dimuat', async () => {
    const src = 'https://cdn.example.com/already-loaded.js';
    const existing = document.createElement('script');
    existing.src = src;
    document.head.appendChild(existing);

    const promise = loadScript(src);
    await expect(promise).resolves.toBeUndefined();
  });

  it('reject dengan error jika script gagal dimuat', async () => {
    const src = 'https://cdn.example.com/fail.js';
    const promise = loadScript(src);

    const scriptEl = document.querySelector(`script[src="${src}"]`);
    expect(scriptEl).not.toBeNull();

    scriptEl.onerror(new Error('Load failed'));

    await expect(promise).rejects.toThrow(`Gagal memuat script: ${src}`);
  });
});

// ───── setupCurrencyInput ─────

describe('setupCurrencyInput(inputElement)', () => {
  it('memformat nilai awal input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = '15000';
    document.body.appendChild(input);

    setupCurrencyInput(input);

    expect(input.value).toBe('15.000');
  });

  it('memformat input saat pengguna mengetik', () => {
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);

    setupCurrencyInput(input);

    input.value = '25000';
    Object.defineProperty(input, 'selectionStart', { value: 5, writable: true });
    const event = new Event('input', { bubbles: true });
    input.dispatchEvent(event);

    expect(input.value).toBe('25.000');
  });

  it('tidak melakukan apa-apa jika inputElement null', () => {
    expect(() => setupCurrencyInput(null)).not.toThrow();
    expect(() => setupCurrencyInput(undefined)).not.toThrow();
  });
});

// ───── confirmDialog ─────

describe('confirmDialog(message)', () => {
  it('memanggil window.confirm dengan pesan yang benar', () => {
    confirmDialog('Apakah Anda yakin?');
    expect(window.confirm).toHaveBeenCalledWith('Apakah Anda yakin?');
  });

  it('mengembalikan true jika user mengonfirmasi', () => {
    window.confirm.mockReturnValueOnce(true);
    expect(confirmDialog('Lanjutkan?')).toBe(true);
  });

  it('mengembalikan false jika user membatalkan', () => {
    window.confirm.mockReturnValueOnce(false);
    expect(confirmDialog('Batalkan?')).toBe(false);
  });
});

// ───── showToast ─────

describe('showToast(message, type)', () => {
  function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  it('menampilkan toast sukses dengan benar', () => {
    const container = createToastContainer();
    showToast('Berhasil disimpan!', 'success');

    expect(container.innerHTML).toContain('Berhasil disimpan!');
    expect(container.innerHTML).toContain('bg-success');
    expect(container.innerHTML).toContain('bi-check-circle');
    expect(container.innerHTML).toContain('toast');
  });

  it('menampilkan toast error dengan benar', () => {
    const container = createToastContainer();
    showToast('Terjadi kesalahan!', 'error');

    expect(container.innerHTML).toContain('Terjadi kesalahan!');
    expect(container.innerHTML).toContain('bg-danger');
    expect(container.innerHTML).toContain('bi-x-circle');
  });

  it('menampilkan toast warning dengan benar', () => {
    const container = createToastContainer();
    showToast('Peringatan!', 'warning');

    expect(container.innerHTML).toContain('Peringatan!');
    expect(container.innerHTML).toContain('bg-warning');
    expect(container.innerHTML).toContain('bi-exclamation-triangle');
  });

  it('menampilkan toast info dengan benar', () => {
    const container = createToastContainer();
    showToast('Informasi', 'info');

    expect(container.innerHTML).toContain('Informasi');
    expect(container.innerHTML).toContain('bg-info');
    expect(container.innerHTML).toContain('bi-info-circle');
  });

  it('tidak melakukan apa-apa jika toast-container tidak ada', () => {
    expect(() => showToast('test')).not.toThrow();
    expect(document.body.innerHTML).toBe('');
  });

  it('mencegah XSS dalam pesan toast', () => {
    const container = createToastContainer();
    showToast('<script>alert("xss")</script>', 'success');

    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).toContain('&lt;script&gt;');
  });

  it('memanggil bootstrap.Toast dengan elemen yang benar', () => {
    createToastContainer();
    showToast('Test toast', 'success');

    expect(window.bootstrap.Toast).toHaveBeenCalledTimes(1);
    const callArg = window.bootstrap.Toast.mock.calls[0][0];
    expect(callArg.id).toMatch(/^toast-/);
    expect(window.bootstrap.Toast.mock.calls[0][1]).toEqual({ delay: 3000 });

    const mockToast = window.bootstrap.Toast.mock.results[0].value;
    expect(mockToast.show).toHaveBeenCalledTimes(1);
  });
});

// ───── showLoading ─────

describe('showLoading(containerId)', () => {
  it('menampilkan spinner loading di container', () => {
    const container = document.createElement('div');
    container.id = 'loading-container';
    document.body.appendChild(container);

    showLoading('loading-container');

    expect(container.innerHTML).toContain('spinner-border');
    expect(container.innerHTML).toContain('text-primary');
    expect(container.innerHTML).toContain('Sedang memuat data...');
  });

  it('tidak melakukan apa-apa jika container tidak ditemukan', () => {
    expect(() => showLoading('non-existent-id')).not.toThrow();
  });

  it('menampilkan visually hidden text untuk aksesibilitas', () => {
    const container = document.createElement('div');
    container.id = 'a11y-container';
    document.body.appendChild(container);

    showLoading('a11y-container');

    expect(container.innerHTML).toContain('visually-hidden');
    expect(container.innerHTML).toContain('Memuat...');
  });
});

// ───── showError ─────

describe('showError(containerId, message)', () => {
  it('menampilkan pesan error di container', () => {
    const container = document.createElement('div');
    container.id = 'error-container';
    document.body.appendChild(container);

    showError('error-container', 'Gagal memuat data');

    expect(container.innerHTML).toContain('alert-danger');
    expect(container.innerHTML).toContain('Kesalahan:');
    expect(container.innerHTML).toContain('Gagal memuat data');
  });

  it('tidak melakukan apa-apa jika container tidak ditemukan', () => {
    expect(() => showError('non-existent', 'error')).not.toThrow();
  });

  it('mencegah XSS dalam pesan error', () => {
    const container = document.createElement('div');
    container.id = 'xss-container';
    document.body.appendChild(container);

    showError('xss-container', '<img src=x onerror=alert(1)>');

    expect(container.innerHTML).not.toContain('<img');
    expect(container.innerHTML).toContain('&lt;img');
  });

  it('menampilkan ikon error', () => {
    const container = document.createElement('div');
    container.id = 'icon-container';
    document.body.appendChild(container);

    showError('icon-container', 'test');

    expect(container.innerHTML).toContain('bi-exclamation-triangle');
  });
});

// ───── validateWhatsApp ─────

describe('validateWhatsApp(phone, msgElementId, submitBtnId)', () => {
  function setupDOM() {
    document.body.innerHTML = `
      <div id="wa-msg"></div>
      <button id="wa-submit">Simpan</button>
    `;
  }

  beforeEach(() => {
    setupDOM();
    jest.spyOn(api, 'checkWA').mockResolvedValue({ isValid: true });
  });

  it('mengembalikan true untuk nomor pendek (< 5 karakter)', async () => {
    const result = await validateWhatsApp('12', 'wa-msg', 'wa-submit');
    expect(result).toBe(true);
    expect(document.getElementById('wa-msg').classList.contains('d-none')).toBe(true);
    expect(document.getElementById('wa-submit').disabled).toBe(false);
  });

  it('mengembalikan true untuk nomor kosong', async () => {
    const result = await validateWhatsApp('', 'wa-msg', 'wa-submit');
    expect(result).toBe(true);
  });

  it('menampilkan pesan terverifikasi untuk nomor valid', async () => {
    api.checkWA.mockResolvedValue({ isValid: true });
    const result = await validateWhatsApp('08123456789', 'wa-msg', 'wa-submit');
    expect(result).toBe(true);

    const msgEl = document.getElementById('wa-msg');
    expect(msgEl.innerHTML).toContain('Terverifikasi');
    expect(msgEl.className).toContain('text-success');
    expect(document.getElementById('wa-submit').disabled).toBe(false);
  });

  it('menampilkan peringatan untuk nomor tidak terdaftar', async () => {
    api.checkWA.mockResolvedValue({ isValid: false });
    const result = await validateWhatsApp('08123456789', 'wa-msg', 'wa-submit');
    expect(result).toBe(true);

    const msgEl = document.getElementById('wa-msg');
    expect(msgEl.innerHTML).toContain('tidak terdaftar');
    expect(msgEl.className).toContain('text-danger');
    expect(document.getElementById('wa-submit').disabled).toBe(false);
  });

  it('menampilkan pesan error API WAHA', async () => {
    api.checkWA.mockResolvedValue({ isError: true });
    const result = await validateWhatsApp('08123456789', 'wa-msg', 'wa-submit');
    expect(result).toBe(true);

    const msgEl = document.getElementById('wa-msg');
    expect(msgEl.innerHTML).toContain('Pengecekan WA gagal');
    expect(msgEl.className).toContain('text-warning');
    expect(document.getElementById('wa-submit').disabled).toBe(false);
  });

  it('menangani error jaringan / server sibuk', async () => {
    api.checkWA.mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await validateWhatsApp('08123456789', 'wa-msg', 'wa-submit');
    expect(result).toBe(true);

    const msgEl = document.getElementById('wa-msg');
    expect(msgEl.innerHTML).toContain('Server sibuk');
    expect(msgEl.className).toContain('text-warning');

    consoleSpy.mockRestore();
  });

  it('menangani kasus ketika elemen DOM tidak ditemukan', async () => {
    const result = await validateWhatsApp('08123456789', 'non-existent-msg', 'non-existent-btn');
    expect(result).toBe(true);
  });

  it('memanggil api.checkWA dengan nomor yang sudah diformat', async () => {
    await validateWhatsApp('08123456789', 'wa-msg', 'wa-submit');
    expect(api.checkWA).toHaveBeenCalledWith('628123456789');
  });

  it('menampilkan indikator pengecekan sebelum API merespon', async () => {
    api.checkWA.mockImplementation(() => new Promise(() => {}));

    const promise = validateWhatsApp('08123456789', 'wa-msg', 'wa-submit');

    const msgEl = document.getElementById('wa-msg');
    expect(msgEl.className).toContain('text-muted');
    expect(msgEl.innerHTML).toContain('Mengecek WhatsApp');
    expect(msgEl.classList.contains('d-none')).toBe(false);
  });
});
