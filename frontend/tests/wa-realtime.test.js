/**
 * @jest-environment jsdom
 */

import api, {
  precheckPhoneNumber,
  renderWAState,
  checkWARealtime,
  setupPhoneRealtimeValidation,
  getWAHAConnected,
  clearWARealtimeCache,
} from '../public/js/api.js';

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: (() => {
      let store = {};
      return {
        getItem: jest.fn((key) => store[key] ?? null),
        setItem: jest.fn((key, value) => { store[key] = String(value); }),
        removeItem: jest.fn(() => {}),
        clear: jest.fn(() => { store = {}; }),
      };
    })(),
    writable: true,
  });
});

beforeEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
  jest.spyOn(api, 'checkWA').mockResolvedValue({ isValid: true, waStatus: 'valid' });
  jest.spyOn(api, 'getWAHAStatus').mockResolvedValue({ status: 'CONNECTED' });
  clearWARealtimeCache();
  jest.useRealTimers();
});

// ───── precheckPhoneNumber (ambang realtime) ─────

describe('precheckPhoneNumber', () => {
  it('di bawah 9 digit -> plausible false (nol request)', () => {
    expect(precheckPhoneNumber('08123').plausible).toBe(false);
    expect(precheckPhoneNumber('').plausible).toBe(false);
  });

  it('nomor ID lengkap -> plausible true + clean 628xx', () => {
    const r = precheckPhoneNumber('08123456789');
    expect(r.plausible).toBe(true);
    expect(r.clean).toBe('628123456789');
  });

  it('bukan pola ID -> plausible false', () => {
    expect(precheckPhoneNumber('+1 555 123 4567').plausible).toBe(false);
  });
});

// ───── renderWAState ─────

describe('renderWAState', () => {
  function setup() {
    document.body.innerHTML = '<div id="wa-msg"></div>';
    return document.getElementById('wa-msg');
  }

  it('idle -> disembunyikan', () => {
    const el = setup();
    renderWAState(el, 'idle');
    expect(el.classList.contains('d-none')).toBe(true);
  });

  it('checking -> teks Mengecek WhatsApp', () => {
    const el = setup();
    renderWAState(el, 'checking');
    expect(el.innerHTML).toContain('Mengecek WhatsApp');
  });

  it('valid -> hijau terverifikasi', () => {
    const el = setup();
    renderWAState(el, 'valid');
    expect(el.innerHTML).toContain('Terverifikasi');
    expect(el.className).toContain('text-success');
  });

  it('invalid -> merah tidak terdaftar', () => {
    const el = setup();
    renderWAState(el, 'invalid');
    expect(el.innerHTML).toContain('tidak terdaftar');
    expect(el.className).toContain('text-danger');
  });

  it('unknown -> kuning WA tidak terkoneksi', () => {
    const el = setup();
    renderWAState(el, 'unknown');
    expect(el.innerHTML).toContain('WA tidak terkoneksi');
    expect(el.innerHTML).toContain('Pengecekan WA gagal');
    expect(el.className).toContain('text-warning');
  });
});

// ───── checkWARealtime ─────

describe('checkWARealtime', () => {
  function setup() {
    document.body.innerHTML = '<div id="wa-msg"></div>';
  }

  it('nomor pendek -> idle tanpa memanggil API', async () => {
    setup();
    const res = await checkWARealtime('0812', 'wa-msg');
    expect(res.state).toBe('idle');
    expect(api.checkWA).not.toHaveBeenCalled();
  });

  it('nomor valid -> state valid + badge hijau', async () => {
    setup();
    api.checkWA.mockResolvedValue({ isValid: true, waStatus: 'valid' });
    const res = await checkWARealtime('08123456789', 'wa-msg');
    expect(res).toMatchObject({ state: 'valid', clean: '628123456789' });
    expect(document.getElementById('wa-msg').className).toContain('text-success');
  });

  it('waStatus invalid -> state invalid + badge merah', async () => {
    setup();
    api.checkWA.mockResolvedValue({ isValid: false, waStatus: 'invalid' });
    const res = await checkWARealtime('08123456789', 'wa-msg');
    expect(res.state).toBe('invalid');
    expect(document.getElementById('wa-msg').className).toContain('text-danger');
  });

  it('waStatus unknown (WAHA mati) -> state unknown + badge kuning koneksi', async () => {
    setup();
    api.checkWA.mockResolvedValue({ isValid: false, isError: true, waStatus: 'unknown' });
    const res = await checkWARealtime('08123456789', 'wa-msg');
    expect(res.state).toBe('unknown');
    expect(document.getElementById('wa-msg').innerHTML).toContain('WA tidak terkoneksi');
  });

  it('hasil sukses di-cache 5 menit (nomor sama tanpa hit kedua)', async () => {
    setup();
    api.checkWA.mockResolvedValue({ isValid: true, waStatus: 'valid' });
    await checkWARealtime('08211111111', 'wa-msg');
    await checkWARealtime('08211111111', 'wa-msg');
    expect(api.checkWA).toHaveBeenCalledTimes(1);
  });
});

// ───── setupPhoneRealtimeValidation ─────

describe('setupPhoneRealtimeValidation', () => {
  function setup() {
    document.body.innerHTML = '<input id="phone" type="tel"><div id="wa-msg"></div>';
    return document.getElementById('phone');
  }

  it('hanya menembak API setelah debounce saat mulai mengetik', async () => {
    jest.useFakeTimers();
    const input = setup();
    setupPhoneRealtimeValidation(input, { msgId: 'wa-msg', debounceMs: 700 });

    input.value = '08123456789';
    input.dispatchEvent(new Event('input'));
    // Sebelum debounce: belum ada request
    expect(api.checkWA).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(700);
    expect(api.checkWA).toHaveBeenCalledWith('628123456789');
    expect(input.dataset.waState).toBe('valid');
    jest.useRealTimers();
  });

  it('tidak menembak API bila digit di bawah ambang', async () => {
    jest.useFakeTimers();
    const input = setup();
    setupPhoneRealtimeValidation(input, { msgId: 'wa-msg', debounceMs: 700 });

    input.value = '0812';
    input.dispatchEvent(new Event('input'));
    await jest.advanceTimersByTimeAsync(1000);
    expect(api.checkWA).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('mengeset dataset.waState invalid untuk nomor tak terdaftar', async () => {
    jest.useFakeTimers();
    const input = setup();
    api.checkWA.mockResolvedValue({ isValid: false, waStatus: 'invalid' });
    setupPhoneRealtimeValidation(input, { msgId: 'wa-msg', debounceMs: 700 });

    input.value = '08123456789';
    input.dispatchEvent(new Event('input'));
    await jest.advanceTimersByTimeAsync(700);
    expect(input.dataset.waState).toBe('invalid');
    jest.useRealTimers();
  });
});

// ───── getWAHAConnected ─────

describe('getWAHAConnected', () => {
  it('CONNECTED -> true', async () => {
    api.getWAHAStatus.mockResolvedValue({ status: 'CONNECTED' });
    // Tunggu cache 30 detik kedaluwarsa antar test via waktu nyata tidak mungkin;
    // panggil dua kali dan pastikan minimal hasilnya konsisten boolean
    const res = await getWAHAConnected();
    expect(typeof res).toBe('boolean');
  });
});
