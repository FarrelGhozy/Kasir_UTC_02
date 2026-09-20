const mongoose = require('mongoose');
const { convertDateStringsToDates, convertObjectIdFields } = require('../../utils/dateUtils');

describe('dateUtils.convertDateStringsToDates', () => {
  it('mengonversi string ISO menjadi Date', () => {
    const obj = { created_at: '2026-01-15T10:00:00.000Z', name: 'x' };
    convertDateStringsToDates(obj);
    expect(obj.created_at).toBeInstanceOf(Date);
    expect(obj.name).toBe('x');
  });

  it('mengonversi rekursif di nested object dan array', () => {
    const obj = { a: { b: '2026-02-01T00:00:00.000Z' }, list: [{ c: '2026-03-01T00:00:00.000Z' }] };
    convertDateStringsToDates(obj);
    expect(obj.a.b).toBeInstanceOf(Date);
    expect(obj.list[0].c).toBeInstanceOf(Date);
  });

  it('tidak mengubah string non-tanggal', () => {
    const obj = { name: 'Budi', phone: '08123456789', note: '2026-13-45' };
    convertDateStringsToDates(obj);
    expect(obj.name).toBe('Budi');
    expect(obj.phone).toBe('08123456789');
    expect(obj.note).toBe('2026-13-45');
  });

  it('menangani null/undefined/primitif tanpa error', () => {
    expect(convertDateStringsToDates(null)).toBeNull();
    expect(convertDateStringsToDates(undefined)).toBeUndefined();
    expect(convertDateStringsToDates(42)).toBe(42);
    expect(convertDateStringsToDates('2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z');
  });

  it('tidak mengubah Date yang sudah ada', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    const obj = { at: d };
    convertDateStringsToDates(obj);
    expect(obj.at).toBe(d);
  });
});

describe('dateUtils.convertObjectIdFields', () => {
  const oid = '507f1f77bcf86cd799439011';

  it('mengonversi string 24-hex pada field id menjadi ObjectId', () => {
    const obj = { _id: oid, cashier_id: oid, name: 'x' };
    convertObjectIdFields(obj);
    expect(obj._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(obj.cashier_id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(obj.name).toBe('x');
  });

  it('mengenali service_ticket sebagai field id', () => {
    const obj = { service_ticket: oid };
    convertObjectIdFields(obj);
    expect(obj.service_ticket).toBeInstanceOf(mongoose.Types.ObjectId);
  });

  it('tidak mengubah string hex pada field non-id', () => {
    const obj = { ticket_number: oid, notes: oid };
    convertObjectIdFields(obj);
    expect(obj.ticket_number).toBe(oid);
    expect(obj.notes).toBe(oid);
  });

  it('mengonversi rekursif di array dan nested', () => {
    const obj = { items: [{ item_id: oid }], nested: { user: { _id: oid } } };
    convertObjectIdFields(obj);
    expect(obj.items[0].item_id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(obj.nested.user._id).toBeInstanceOf(mongoose.Types.ObjectId);
  });

  it('tidak double-convert ObjectId yang sudah ada', () => {
    const existing = new mongoose.Types.ObjectId();
    const obj = { _id: existing };
    convertObjectIdFields(obj);
    expect(obj._id).toBe(existing);
  });

  it('menangani null/undefined tanpa error', () => {
    expect(convertObjectIdFields(null)).toBeNull();
    expect(convertObjectIdFields(undefined)).toBeUndefined();
  });
});
