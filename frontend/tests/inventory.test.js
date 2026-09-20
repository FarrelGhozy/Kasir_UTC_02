/**
 * @jest-environment jsdom
 */
import Inventory from '../public/js/modules/inventory.js';
import api from '../public/js/api.js';
import auth from '../public/js/auth.js';

jest.mock('../public/js/auth.js', () => ({
  __esModule: true,
  default: { user: null, hasRole: jest.fn(() => false) },
}));

jest.mock('../public/js/api.js', () => {
  const actual = jest.requireActual('../public/js/api.js');
  return {
    __esModule: true,
    ...actual,
    default: {
      getInventory: jest.fn(),
      deleteItem: jest.fn(),
    },
  };
});

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((k) => store[k] ?? null),
    setItem: jest.fn((k, v) => { store[k] = String(v); }),
    removeItem: jest.fn((k) => { delete store[k]; }),
    clear: jest.fn(() => { store = {}; }),
  };
});
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  document.body.innerHTML = '<div id="app-content"></div><table><tbody id="inventory-table-body"></tbody></table>';
  jest.clearAllMocks();
  window.bootstrap = {
    Toast: jest.fn().mockImplementation(() => ({ show: jest.fn() })),
    Modal: jest.fn().mockImplementation(() => ({ show: jest.fn(), hide: jest.fn(), dispose: jest.fn() })),
  };
  window.bootstrap.Modal.getInstance = jest.fn().mockReturnValue(null);
});

describe('Inventory.loadItems error state', () => {
  it('menampilkan baris error + tombol Coba lagi saat fetch gagal', async () => {
    api.getInventory.mockRejectedValue(new Error('jaringan putus'));
    const inv = new Inventory();
    await inv.render();
    const tbody = document.getElementById('inventory-table-body');
    expect(tbody.innerHTML).toContain('Gagal memuat data');
    expect(tbody.innerHTML).toContain('jaringan putus');
    expect(document.getElementById('inventory-retry-btn')).toBeTruthy();
  });

  it('tombol Coba lagi memanggil ulang loadItems', async () => {
    api.getInventory.mockRejectedValueOnce(new Error('gagal')).mockResolvedValueOnce({ data: [] });
    const inv = new Inventory();
    await inv.render();
    const btn = document.getElementById('inventory-retry-btn');
    expect(btn).toBeTruthy();
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(api.getInventory).toHaveBeenCalledTimes(2);
  });
});

describe('Inventory tombol hapus per role', () => {
  const items = [{ _id: 'a1', sku: 'S-1', name: 'Barang', category: 'Sparepart', purchase_price: 1000, selling_price: 2000, stock: 5, min_stock_alert: 2 }];

  it('admin melihat tombol hapus', async () => {
    auth.hasRole.mockImplementation((...roles) => roles.includes('admin'));
    api.getInventory.mockResolvedValue({ data: items });
    const inv = new Inventory();
    await inv.render();
    await inv.loadItems();
    expect(document.querySelector('.btn-action-delete')).toBeTruthy();
  });

  it('kasir TIDAK melihat tombol hapus', async () => {
    auth.hasRole.mockImplementation(() => false);
    api.getInventory.mockResolvedValue({ data: items });
    const inv = new Inventory();
    await inv.render();
    await inv.loadItems();
    expect(document.querySelector('.btn-action-delete')).toBeNull();
    expect(document.querySelector('.btn-action-edit')).toBeTruthy();
  });
});
