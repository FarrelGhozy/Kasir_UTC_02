/**
 * @jest-environment jsdom
 */

import Dashboard from '../public/js/modules/dashboard.js';
import api from '../public/js/api.js';

jest.mock('../public/js/api.js', () => {
  const actual = jest.requireActual('../public/js/api.js');
  return {
    __esModule: true,
    ...actual,
    default: {
      getWAHAStatus: jest.fn(),
    },
  };
});

beforeEach(() => {
  document.body.innerHTML = '<div id="main-app"><div id="app-content"></div></div>';
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Banner WAHA Dashboard', () => {
  it('banner memakai latar biru, permanen (tanpa tombol tutup), dan berisi pesan kenyamanan pelanggan', () => {
    const dashboard = new Dashboard();
    document.body.innerHTML = dashboard.wahaBannerHTML();

    const banner = document.getElementById('waha-banner');
    expect(banner).not.toBeNull();
    expect(banner.className).toContain('waha-banner');
    expect(banner.querySelector('[data-bs-dismiss]')).toBeNull();
    expect(banner.querySelector('.btn-close')).toBeNull();
    expect(banner.textContent).toContain('harap segera dinyalakan kembali demi kenyamanan pelanggan');
  });

  it('banner sembunyi saat status CONNECTED', () => {
    const dashboard = new Dashboard();
    document.body.innerHTML = dashboard.wahaBannerHTML();
    const banner = document.getElementById('waha-banner');

    dashboard.applyWAHABannerState(banner, 'CONNECTED');

    expect(banner.classList.contains('d-none')).toBe(true);
    expect(banner.classList.contains('d-flex')).toBe(false);
  });

  it('banner tampil saat status bermasalah beserta statusnya', () => {
    const dashboard = new Dashboard();
    document.body.innerHTML = dashboard.wahaBannerHTML();
    const banner = document.getElementById('waha-banner');

    dashboard.applyWAHABannerState(banner, 'DISCONNECTED');

    expect(banner.classList.contains('d-none')).toBe(false);
    expect(banner.classList.contains('d-flex')).toBe(true);
    expect(document.getElementById('waha-banner-status').textContent).toContain('DISCONNECTED');
  });

  it('refreshWAHABanner menyembunyikan banner saat API CONNECTED', async () => {
    api.getWAHAStatus.mockResolvedValue({ status: 'CONNECTED' });
    const dashboard = new Dashboard();
    document.body.innerHTML = dashboard.wahaBannerHTML();

    await dashboard.refreshWAHABanner();

    expect(document.getElementById('waha-banner').classList.contains('d-none')).toBe(true);
  });

  it('refreshWAHABanner menampilkan banner saat API bermasalah atau error', async () => {
    const dashboard = new Dashboard();

    api.getWAHAStatus.mockResolvedValue({ status: 'UNREACHABLE' });
    document.body.innerHTML = dashboard.wahaBannerHTML();
    await dashboard.refreshWAHABanner();
    let banner = document.getElementById('waha-banner');
    expect(banner.classList.contains('d-none')).toBe(false);
    expect(document.getElementById('waha-banner-status').textContent).toContain('UNREACHABLE');

    api.getWAHAStatus.mockRejectedValue(new Error('jaringan putus'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = dashboard.wahaBannerHTML();
    await dashboard.refreshWAHABanner();
    banner = document.getElementById('waha-banner');
    expect(banner.classList.contains('d-none')).toBe(false);
    expect(document.getElementById('waha-banner-status').textContent).toContain('ERROR');
    consoleSpy.mockRestore();
  });

  it('polling berhenti saat banner sudah tidak ada (pindah halaman)', () => {
    const dashboard = new Dashboard();
    const clearSpy = jest.spyOn(global, 'clearInterval');

    dashboard.startWAHABannerPolling();
    expect(dashboard.wahaBannerInterval).not.toBeNull();

    // Simulasi pindah halaman: banner dihapus dari DOM
    document.body.innerHTML = '<div id="main-app"><div id="app-content"></div></div>';
    jest.advanceTimersByTime(dashboard.WAHA_POLL_MS);

    expect(dashboard.wahaBannerInterval).toBeNull();
    clearSpy.mockRestore();
  });
});
