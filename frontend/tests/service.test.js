/**
 * @jest-environment jsdom
 */
import ServiceModule from '../public/js/modules/service.js';
import api from '../public/js/api.js';

jest.mock('../public/js/api.js', () => {
  const actual = jest.requireActual('../public/js/api.js');
  return {
    __esModule: true,
    ...actual,
    default: {},
    showToast: jest.fn(),
    showError: jest.fn(),
    formatCurrency: actual.formatCurrency,
    escapeHTML: actual.escapeHTML,
    confirmDialog: jest.fn().mockResolvedValue(true),
  };
});

describe('Service.getStatusBadge', () => {
  it('mapping semua status ke badge yang benar', () => {
    const svc = new ServiceModule();
    expect(svc.getStatusBadge('Queue')).toContain('Antrian');
    expect(svc.getStatusBadge('Diagnosing')).toContain('Diagnosa');
    expect(svc.getStatusBadge('Waiting_Part')).toContain('Tunggu Part');
    expect(svc.getStatusBadge('In_Progress')).toContain('Dikerjakan');
    expect(svc.getStatusBadge('Completed')).toContain('Selesai');
    expect(svc.getStatusBadge('Picked_Up')).toContain('Diambil');
    expect(svc.getStatusBadge('Cancelled')).toContain('Dibatalkan');
  });

  it('status tak dikenal dikembalikan apa adanya', () => {
    const svc = new ServiceModule();
    expect(svc.getStatusBadge('Aneh')).toBe('Aneh');
  });
});

describe('Service.getNotaType & getNotaLabel', () => {
  it('Completed/Picked_Up -> payment', () => {
    const svc = new ServiceModule();
    expect(svc.getNotaType({ status: 'Completed' })).toBe('payment');
    expect(svc.getNotaType({ status: 'Picked_Up' })).toBe('payment');
    expect(svc.getNotaLabel({ status: 'Completed' })).toBe('Cetak Nota Pembayaran');
  });

  it('Queue/Diagnosing/Waiting_Part/In_Progress -> entry', () => {
    const svc = new ServiceModule();
    for (const s of ['Queue', 'Diagnosing', 'Waiting_Part', 'In_Progress']) {
      expect(svc.getNotaType({ status: s })).toBe('entry');
    }
    expect(svc.getNotaLabel({ status: 'Queue' })).toBe('Cetak Tanda Terima');
  });

  it('Cancelled/null -> null (tidak ada nota valid)', () => {
    const svc = new ServiceModule();
    expect(svc.getNotaType({ status: 'Cancelled' })).toBeNull();
    expect(svc.getNotaType(null)).toBeNull();
    expect(svc.getNotaType(undefined)).toBeNull();
  });
});

describe('Service.getWarrantyBadge', () => {
  it("'' bila tidak ada warranty_expires_at", () => {
    const svc = new ServiceModule();
    expect(svc.getWarrantyBadge({})).toBe('');
    expect(svc.getWarrantyBadge({ warranty_expires_at: null })).toBe('');
  });

  it('Garansi Aktif bila expiry di masa depan', () => {
    const svc = new ServiceModule();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(svc.getWarrantyBadge({ warranty_expires_at: future })).toContain('Garansi Aktif');
  });

  it('Garansi Habis bila expiry di masa lalu', () => {
    const svc = new ServiceModule();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(svc.getWarrantyBadge({ warranty_expires_at: past })).toContain('Garansi Habis');
  });
});
