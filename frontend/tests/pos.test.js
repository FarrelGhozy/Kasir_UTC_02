/**
 * @jest-environment jsdom
 */
import POS from '../public/js/modules/pos.js';
import api from '../public/js/api.js';

jest.mock('../public/js/api.js', () => {
  const actual = jest.requireActual('../public/js/api.js');
  return {
    __esModule: true,
    ...actual,
    default: {
      getInventory: jest.fn().mockResolvedValue({ data: [] }),
      createTransaction: jest.fn().mockResolvedValue({ success: true, data: { invoice_no: 'INV-1', grand_total: 10000, amount_paid: 10000, date: new Date().toISOString(), cashier_name: 'Kasir', items: [] } }),
    },
    formatCurrency: actual.formatCurrency,
    escapeHTML: actual.escapeHTML,
    showToast: jest.fn(),
    showError: jest.fn(),
    setupCurrencyInput: jest.fn(),
    parseCurrencyValue: actual.parseCurrencyValue,
    formatInputCurrency: actual.formatInputCurrency,
    confirmDialog: jest.fn().mockResolvedValue(true),
  };
});

describe('POS.getStockBadgeClass', () => {
  it('bg-danger jika stok <= min', () => {
    const pos = new POS();
    expect(pos.getStockBadgeClass(2, 5)).toBe('bg-danger');
    expect(pos.getStockBadgeClass(5, 5)).toBe('bg-danger');
  });
  it('bg-warning jika stok <= 2*min', () => {
    const pos = new POS();
    expect(pos.getStockBadgeClass(6, 5)).toBe('bg-warning text-dark');
    expect(pos.getStockBadgeClass(10, 5)).toBe('bg-warning text-dark');
  });
  it('bg-success jika stok > 2*min', () => {
    const pos = new POS();
    expect(pos.getStockBadgeClass(20, 5)).toBe('bg-success bg-opacity-75');
  });
});

describe('POS.addToCart & renderCart', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-content"></div><div id="cart-items"></div><div id="cart-count"></div><div id="cart-total"></div><button id="pay-btn"></button><div id="change-display"></div><select id="payment-method"><option value="Cash">Cash</option></select><input id="amount-paid" value="0">';
  });

  it('addToCart menambah item baru', () => {
    const pos = new POS();
    pos.items = [{ _id: 'a1', name: 'Barang', selling_price: 10000, stock: 5 }];
    pos.addToCart('a1');
    expect(pos.cart.length).toBe(1);
    expect(pos.cart[0].qty).toBe(1);
  });

  it('addToCart increment qty jika sudah ada', () => {
    const pos = new POS();
    pos.items = [{ _id: 'a1', name: 'Barang', selling_price: 10000, stock: 5 }];
    pos.addToCart('a1');
    pos.addToCart('a1');
    expect(pos.cart[0].qty).toBe(2);
  });

  it('addToCart tidak melebihi stok', () => {
    const pos = new POS();
    pos.items = [{ _id: 'a1', name: 'Barang', selling_price: 10000, stock: 1 }];
    pos.addToCart('a1');
    pos.addToCart('a1');
    expect(pos.cart[0].qty).toBe(1);
  });

  it('renderCart menghitung total & count', () => {
    const pos = new POS();
    pos.cart = [{ item_id: 'a1', name: 'A', price: 10000, qty: 2 }, { item_id: 'b1', name: 'B', price: 5000, qty: 1 }];
    document.getElementById('payment-method').value = 'Transfer';
    pos.renderCart();
    expect(document.getElementById('cart-count').textContent).toBe('3');
    expect(document.getElementById('cart-total').textContent).toContain('25.000');
    expect(document.getElementById('pay-btn').disabled).toBe(false);
  });

  it('renderCart kosong -> payBtn disabled', () => {
    const pos = new POS();
    pos.cart = [];
    pos.renderCart();
    expect(document.getElementById('pay-btn').disabled).toBe(true);
  });

  it('updateChange menghitung kembalian Cash', () => {
    const pos = new POS();
    pos.cart = [{ price: 10000, qty: 2 }];
    document.body.innerHTML += '<input id="amount-paid" value="25.000"><select id="payment-method"><option value="Cash" selected>Cash</option></select><div id="change-display"></div><button id="pay-btn"></button>';
    document.getElementById('payment-method').value = 'Cash';
    document.getElementById('amount-paid').value = '25.000';
    pos.updateChange();
    const changeEl = document.getElementById('change-display');
    expect(changeEl.textContent).toContain('5.000');
  });
});

describe('POS.loadItems filter stock >0', () => {
  it('hanya tampilkan item stok >0', async () => {
    api.getInventory.mockResolvedValueOnce({ data: [{ _id: '1', stock: 5, selling_price: 10000, name: 'A', sku: 'A' }, { _id: '2', stock: 0, selling_price: 10000, name: 'B', sku: 'B' }] });
    const pos = new POS();
    document.body.innerHTML = '<div id="app-content"><div id="product-grid"></div><span id="total-products-badge"></span></div>';
    await pos.loadItems();
    expect(pos.items.length).toBe(1);
    expect(pos.items[0]._id).toBe('1');
  });
});
