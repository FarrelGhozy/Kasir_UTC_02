const {
  getServiceTotal,
  isServicePaid,
  getServicePaymentStatus,
  getOrderRemaining,
  isOrderPaid,
  getOrderPaymentStatus
} = require('../../utils/paymentStatus');

describe('paymentStatus.getServiceTotal', () => {
  it('mengembalikan 0 untuk null/undefined', () => {
    expect(getServiceTotal(null)).toBe(0);
    expect(getServiceTotal(undefined)).toBe(0);
  });

  it('memakai total_cost bila positif', () => {
    expect(getServiceTotal({ total_cost: 150000, parts_used: [], service_fee: 0 })).toBe(150000);
  });

  it('menjumlah parts + jasa bila total_cost 0', () => {
    const t = { total_cost: 0, parts_used: [{ subtotal: 50000 }, { subtotal: 25000 }], service_fee: 30000 };
    expect(getServiceTotal(t)).toBe(105000);
  });

  it('menangani subtotal string/invalid sebagai 0', () => {
    const t = { parts_used: [{ subtotal: 'abc' }, {}], service_fee: '50000' };
    expect(getServiceTotal(t)).toBe(50000);
  });
});

describe('paymentStatus.isServicePaid', () => {
  it('false untuk null', () => {
    expect(isServicePaid(null)).toBe(false);
  });

  it('true untuk total 0 (gratis)', () => {
    expect(isServicePaid({ total_cost: 0, parts_used: [], service_fee: 0 })).toBe(true);
  });

  it('true bila payment_status Lunas', () => {
    expect(isServicePaid({ total_cost: 100000, payment_status: 'Lunas', status: 'Queue' })).toBe(true);
  });

  it('true bila Picked_Up + ada payment_method', () => {
    expect(isServicePaid({ total_cost: 100000, status: 'Picked_Up', payment_method: 'Cash' })).toBe(true);
  });

  it('false bila berbayar tanpa metode dan belum diambil', () => {
    expect(isServicePaid({ total_cost: 100000, status: 'Completed' })).toBe(false);
  });
});

describe('paymentStatus.getServicePaymentStatus', () => {
  it('Lunas / Belum Lunas konsisten dengan isServicePaid', () => {
    expect(getServicePaymentStatus({ total_cost: 0 })).toBe('Lunas');
    expect(getServicePaymentStatus({ total_cost: 50000, status: 'Queue' })).toBe('Belum Lunas');
  });
});

describe('paymentStatus.getOrderRemaining', () => {
  it('0 untuk null', () => {
    expect(getOrderRemaining(null)).toBe(0);
  });

  it('estimasi - DP', () => {
    expect(getOrderRemaining({ estimated_price: 500000, down_payment: 100000 })).toBe(400000);
  });

  it('clamp 0 bila DP melebihi estimasi (overpayment tidak negatif)', () => {
    expect(getOrderRemaining({ estimated_price: 100000, down_payment: 200000 })).toBe(0);
  });
});

describe('paymentStatus.isOrderPaid / getOrderPaymentStatus', () => {
  it('true bila flag manual Lunas walau sisa > 0', () => {
    const o = { estimated_price: 500000, down_payment: 100000, payment_status: 'Lunas' };
    expect(isOrderPaid(o)).toBe(true);
    expect(getOrderPaymentStatus(o)).toBe('Lunas');
  });

  it('true bila DP penuh dan estimasi > 0', () => {
    const o = { estimated_price: 500000, down_payment: 500000 };
    expect(isOrderPaid(o)).toBe(true);
    expect(getOrderPaymentStatus(o)).toBe('Lunas');
  });

  it('FALSE bila estimasi 0 dan DP 0 (konsisten dengan pre-save SpecialOrder)', () => {
    const o = { estimated_price: 0, down_payment: 0, payment_status: 'Belum Lunas' };
    expect(isOrderPaid(o)).toBe(false);
    expect(getOrderPaymentStatus(o)).toBe('Belum Lunas');
  });

  it('false untuk null', () => {
    expect(isOrderPaid(null)).toBe(false);
    expect(getOrderPaymentStatus(null)).toBe('Belum Lunas');
  });
});
