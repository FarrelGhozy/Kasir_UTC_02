const mongoose = require('mongoose');
const DutySchedule = require('../../models/DutySchedule');
const { createTeknisi } = require('../helpers/factory');

describe('DutySchedule - Model Validation', () => {
  it('should create schedule with valid senin-jumat', async () => {
    const tech = await createTeknisi();
    for (const day of ['senin', 'selasa', 'rabu', 'kamis', 'jumat']) {
      const t = await createTeknisi();
      const s = await DutySchedule.create({ user: t._id, day });
      expect(s.day).toBe(day);
      expect(s.created_at).toBeInstanceOf(Date);
      expect(s.updated_at).toBeInstanceOf(Date);
    }
  });

  it('should reject invalid day (sabtu, minggu, empty)', async () => {
    const tech = await createTeknisi();
    for (const bad of ['sabtu', 'minggu', 'Senin', 'MONDAY', '', null]) {
      await expect(DutySchedule.create({ user: tech._id, day: bad })).rejects.toThrow();
    }
  });

  it('should reject missing user', async () => {
    await expect(DutySchedule.create({ day: 'senin' })).rejects.toThrow('User wajib diisi');
  });

  it('should reject missing day', async () => {
    const tech = await createTeknisi();
    await expect(DutySchedule.create({ user: tech._id })).rejects.toThrow('Hari wajib diisi');
  });

  it('should enforce unique {user, day}', async () => {
    const tech = await createTeknisi();
    await DutySchedule.create({ user: tech._id, day: 'senin' });
    await expect(DutySchedule.create({ user: tech._id, day: 'senin' })).rejects.toThrow();
    // same user different day allowed
    const s2 = await DutySchedule.create({ user: tech._id, day: 'selasa' });
    expect(s2.day).toBe('selasa');
    // different user same day allowed
    const tech2 = await createTeknisi();
    const s3 = await DutySchedule.create({ user: tech2._id, day: 'senin' });
    expect(s3.day).toBe('senin');
  });

  it('should allow same day for different users', async () => {
    const tech1 = await createTeknisi();
    const tech2 = await createTeknisi();
    const s1 = await DutySchedule.create({ user: tech1._id, day: 'rabu' });
    const s2 = await DutySchedule.create({ user: tech2._id, day: 'rabu' });
    expect(s1.user.toString()).not.toBe(s2.user.toString());
  });

  it('should have indexes on day and user+day', () => {
    const indexes = DutySchedule.collection ? [] : [];
    // Check schema indexes definirion
    const schemaIndexes = DutySchedule.schema.indexes();
    const hasDay = schemaIndexes.some(([fields]) => fields.day === 1 && !fields.user);
    const hasUnique = schemaIndexes.some(([fields, opts]) => fields.user === 1 && fields.day === 1 && opts.unique === true);
    expect(hasDay).toBe(true);
    expect(hasUnique).toBe(true);
  });
});

describe('DutySchedule - Timestamps', () => {
  it('should auto-set created_at and updated_at', async () => {
    const tech = await createTeknisi();
    const s = await DutySchedule.create({ user: tech._id, day: 'kamis' });
    expect(s.created_at).toBeInstanceOf(Date);
    expect(s.updated_at).toBeInstanceOf(Date);
    const before = s.updated_at;
    await new Promise(r => setTimeout(r, 10));
    s.day = 'jumat';
    await s.save();
    expect(s.updated_at.getTime()).toBeGreaterThan(before.getTime());
  });
});
