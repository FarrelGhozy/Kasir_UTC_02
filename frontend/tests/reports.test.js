/**
 * @jest-environment jsdom
 */
// frontend/tests/reports.test.js
// Menjaga fitur "Unduh Rekap Lengkap": row-builder null-safe, guard pustaka PDF,
// loader sekuensial+fallback, dan format meta/filename. Inilah test yang hilang
// sehingga bug 'doc.autoTable is not a function' lolos walau test lama hijau.
import Reports, {
  buildInventoryRows,
  buildServiceRows,
  buildTransactionRows,
  buildRecapMeta,
  buildRecapFilename,
  limitRecapRows,
  assertPdfLibsReady,
  assertRecapPayload,
  ensurePdfLibraries
} from '../public/js/modules/reports.js';
import { loadScriptWithFallback } from '../public/js/api.js';

jest.mock('../public/js/auth.js', () => ({
  __esModule: true,
  default: { user: { name: 'Admin Test' }, getUser: jest.fn(() => ({ name: 'Admin Test' })), hasRole: jest.fn(() => true) }
}));

// Mock loadScriptWithFallback saja (loader asli menyentuh DOM/network);
// helper format/tanggal tetap memakai implementasi asli.
jest.mock('../public/js/api.js', () => {
  const actual = jest.requireActual('../public/js/api.js');
  return {
    __esModule: true,
    ...actual,
    default: {},
    loadScriptWithFallback: jest.fn()
  };
});

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((k) => store[k] ?? null),
    setItem: jest.fn((k, v) => { store[k] = String(v); }),
    removeItem: jest.fn((k) => { delete store[k]; }),
    clear: jest.fn(() => { store = {}; })
  };
});
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  document.body.innerHTML = '<div id="app-content"></div><div id="report-content"></div><div id="toast-container"></div>';
  delete window.jspdf;
  delete window.Chart;
  window.bootstrap = {
    Toast: jest.fn().mockImplementation(() => ({ show: jest.fn() })),
    Modal: jest.fn().mockImplementation(() => ({ show: jest.fn(), hide: jest.fn(), dispose: jest.fn() }))
  };
  window.bootstrap.Modal.getInstance = jest.fn().mockReturnValue(null);
  document.querySelectorAll('script[data-test-pdf]').forEach((s) => s.remove());
  jest.restoreAllMocks();
});

// ───── buildInventoryRows: data legacy berlubang tidak boleh throw ─────

describe('buildInventoryRows', () => {
  it('memetakan field sesuai kontrak backend', () => {
    const rows = buildInventoryRows([{
      sku: 'SKU-1', name: 'Oli', category: 'Sparepart',
      selling_price: 50000, stock: 4, purchase_price: 30000
    }]);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('SKU-1');
    expect(rows[0][3]).toContain('50');
    expect(rows[0][4]).toBe(4);
    expect(rows[0][5]).toContain('120');
  });

  it('fallback "-" / Rp 0 untuk dokumen legacy berlubang, tanpa throw', () => {
    expect(() => buildInventoryRows([{}])).not.toThrow();
    const rows = buildInventoryRows([{}]);
    expect(rows[0][0]).toBe('-');
    expect(rows[0][1]).toBe('-');
    expect(rows[0][4]).toBe(0);
  });

  it('mengembalikan baris empty-state untuk array kosong/null', () => {
    expect(buildInventoryRows([])[0][0].content).toMatch(/tidak ada data/i);
    expect(buildInventoryRows(null)[0][0].content).toMatch(/tidak ada data/i);
    expect(buildInventoryRows(undefined)[0][0].content).toMatch(/tidak ada data/i);
  });
});

// ───── buildServiceRows: nested customer/device/technician ─────

describe('buildServiceRows', () => {
  const full = {
    ticket_number: 'SRV-2026-0001',
    history: { picked_up_at: '2026-06-15T10:00:00.000Z' },
    customer: { name: 'Budi' },
    device: { symptoms: 'Mati total' },
    technician: { name: 'Andi' },
    status: 'Picked_Up',
    total_cost: 75000
  };

  it('memetakan tiket lengkap', () => {
    const rows = buildServiceRows([full]);
    expect(rows[0][0]).toBe('SRV-2026-0001');
    expect(rows[0][2]).toBe('Budi');
    expect(rows[0][3]).toBe('Mati total');
    expect(rows[0][4]).toBe('Andi');
  });

  it('REGRESI BUG PDF: customer/device/technician null -> "-" bukan TypeError', () => {
    expect(() => buildServiceRows([{ ...full, customer: null, device: null, technician: null }])).not.toThrow();
    const rows = buildServiceRows([{ ...full, customer: null, device: undefined, technician: undefined }]);
    expect(rows[0][2]).toBe('-');
    expect(rows[0][3]).toBe('-');
    expect(rows[0][4]).toBe('-');
  });

  it('empty-state untuk array kosong', () => {
    expect(buildServiceRows([])[0][0].content).toMatch(/tidak ada data/i);
  });
});

// ───── buildTransactionRows: items hilang/kosong ─────

describe('buildTransactionRows', () => {
  it('menggabungkan items menjadi deskripsi', () => {
    const rows = buildTransactionRows([{
      invoice_no: 'INV-1', date: '2026-06-15T10:00:00.000Z', cashier_name: 'Kasir',
      items: [{ name: 'Oli', qty: 2 }, { name: 'Kampas', qty: 1 }],
      payment_method: 'Cash', grand_total: 100000
    }]);
    expect(rows[0][3]).toBe('Oli (x2), Kampas (x1)');
  });

  it('REGRESI BUG PDF: items undefined -> "-" bukan TypeError', () => {
    expect(() => buildTransactionRows([{ invoice_no: 'INV-X' }])).not.toThrow();
    expect(buildTransactionRows([{ invoice_no: 'INV-X' }])[0][3]).toBe('-');
    expect(buildTransactionRows([{ items: [] }])[0][3]).toBe('-');
  });
});

// ───── Meta & filename ─────

describe('buildRecapMeta & buildRecapFilename', () => {
  it('judul 30days vs all berbeda', () => {
    expect(buildRecapMeta('30days', 'A').rangeTitle).toMatch(/30 hari/i);
    expect(buildRecapMeta('all', 'A').rangeTitle).toMatch(/seluruh/i);
  });

  it('nomor laporan memuat kode periode', () => {
    expect(buildRecapMeta('30days', 'A').reportNo).toMatch(/^RECAP\/30H\//);
    expect(buildRecapMeta('all', 'A').reportNo).toMatch(/^RECAP\/ALL\//);
  });

  it('filename memakai tanggal WIB (bukan UTC off-by-one)', () => {
    // 2026-06-15 00:30 WIB = 2026-06-14 17:30 UTC — toISOString() akan salah hari.
    const wibEarly = new Date(2026, 5, 15, 0, 30, 0);
    expect(buildRecapFilename('all', wibEarly)).toBe('Laporan_Rekap_UTC_all_20260615.pdf');
    expect(buildRecapFilename('30days', wibEarly)).toBe('Laporan_Rekap_UTC_30days_20260615.pdf');
  });

  it('filename disanitasi dari karakter berbahaya', () => {
    const now = new Date(2026, 5, 15, 0, 30, 0);
    expect(buildRecapFilename('../../etc', now)).toBe('Laporan_Rekap_UTC_etc_20260615.pdf');
    expect(buildRecapFilename('a&b=c?d', now)).toBe('Laporan_Rekap_UTC_abcd_20260615.pdf');
    expect(buildRecapFilename('', now)).toBe('Laporan_Rekap_UTC_all_20260615.pdf');
  });
});

// ───── limitRecapRows: proteksi OOM ─────

describe('limitRecapRows', () => {
  it('melewatkan data kecil tanpa catatan', () => {
    const rows = [[1], [2]];
    const { body, note } = limitRecapRows(rows, 2);
    expect(body).toHaveLength(2);
    expect(note).toBe('');
  });

  it('memotong data raksasa + memberi catatan', () => {
    const rows = Array.from({ length: 2500 }, (_, i) => [i]);
    const { body, note } = limitRecapRows(rows, 2500);
    expect(body).toHaveLength(2000);
    expect(note).toMatch(/2000 dari 2500/);
  });
});

// ───── Guard pustaka PDF ─────

describe('assertPdfLibsReady (REGRESI: doc.autoTable is not a function)', () => {
  it('melempar pesan ramah bila jsPDF belum dimuat', () => {
    expect(() => assertPdfLibsReady()).toThrow(/jsPDF gagal dimuat/);
  });

  it('melempar pesan ramah bila autotable belum ter-register', () => {
    window.jspdf = { jsPDF: function () {} };
    window.jspdf.jsPDF.API = {};
    expect(() => assertPdfLibsReady()).toThrow(/Plugin tabel PDF gagal dimuat/);
  });

  it('lolos bila jsPDF + autotable terdaftar', () => {
    window.jspdf = { jsPDF: function () {} };
    window.jspdf.jsPDF.API = { autoTable: function () {} };
    expect(() => assertPdfLibsReady()).not.toThrow();
  });
});

describe('assertRecapPayload', () => {
  it('menolak payload kosong/rusak sebelum digambar', () => {
    expect(() => assertRecapPayload(null)).toThrow(/tidak lengkap/);
    expect(() => assertRecapPayload({})).toThrow(/tidak lengkap/);
    expect(() => assertRecapPayload({ summary: {} })).not.toThrow();
  });
});

// ───── Loader sekuensial + fallback ─────

describe('ensurePdfLibraries', () => {
  it('melewatkan load bila pustaka sudah siap', async () => {
    window.jspdf = { jsPDF: function () {} };
    window.jspdf.jsPDF.API = { autoTable: function () {} };
    window.Chart = function () {};
    loadScriptWithFallback.mockClear();
    await ensurePdfLibraries();
    expect(loadScriptWithFallback).not.toHaveBeenCalled();
  });

  it('memuat jspdf lalu autotable secara sekuensial (bukan paralel)', async () => {
    const order = [];
    loadScriptWithFallback.mockImplementation(async (sources) => {
      const src = sources[0];
      order.push(src.includes('autotable') ? 'autotable' : src.includes('jspdf') ? 'jspdf' : 'chart');
      // Catatan: 'jspdf.plugin.autotable.min.js' juga mengandung substring 'jspdf',
      // jadi cek 'autotable' HARUS lebih dulu.
      if (src.includes('autotable')) {
        window.jspdf.jsPDF.API.autoTable = function () {};
      } else if (src.includes('jspdf')) {
        window.jspdf = { jsPDF: function () {} };
        window.jspdf.jsPDF.API = {};
      } else {
        window.Chart = function () {};
      }
      return src;
    });
    await ensurePdfLibraries();
    expect(order[0]).toBe('jspdf');
    expect(order[1]).toBe('autotable');
    expect(() => assertPdfLibsReady()).not.toThrow();
  });

  it('tetap lanjut tanpa grafik bila Chart.js gagal total', async () => {
    window.jspdf = { jsPDF: function () {} };
    window.jspdf.jsPDF.API = { autoTable: function () {} };
    loadScriptWithFallback.mockRejectedValue(new Error('CDN mati'));
    await expect(ensurePdfLibraries()).resolves.toBeUndefined();
  });
});

// ───── generateChartImage: tak pernah throw ─────

describe('Reports.generateChartImage', () => {
  it('mengembalikan null (bukan throw) bila Chart belum dimuat', async () => {
    const r = new Reports();
    await expect(r.generateChartImage('hiddenPieChart', 'pie', { labels: [], datasets: [] })).resolves.toBeNull();
  });

  it('mengembalikan null bila canvas tidak ada', async () => {
    window.Chart = function () {};
    window.Chart.getChart = jest.fn(() => null);
    const r = new Reports();
    await expect(r.generateChartImage('canvas-tak-ada', 'pie', { labels: [], datasets: [] })).resolves.toBeNull();
  });
});
