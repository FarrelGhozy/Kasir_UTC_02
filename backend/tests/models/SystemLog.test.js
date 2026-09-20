const mongoose = require('mongoose');
const SystemLog = require('../../models/SystemLog');

describe('SystemLog - Model Validation', () => {
  it('should create log with defaults', async () => {
    const log = await SystemLog.create({
      source: 'Test',
      message: 'Hello world'
    });
    expect(log.level).toBe('INFO');
    expect(log.source).toBe('Test');
    expect(log.message).toBe('Hello world');
    expect(log.timestamp).toBeInstanceOf(Date);
    expect(log.details).toBeUndefined();
  });

  it('should accept ERROR, WARN, INFO levels', async () => {
    for (const lvl of ['ERROR', 'WARN', 'INFO']) {
      const log = await SystemLog.create({ level: lvl, source: 'S', message: 'm' });
      expect(log.level).toBe(lvl);
    }
  });

  it('should reject invalid level', async () => {
    await expect(SystemLog.create({ level: 'DEBUG', source: 'S', message: 'm' })).rejects.toThrow();
    await expect(SystemLog.create({ level: '', source: 'S', message: 'm' })).rejects.toThrow();
  });

  it('should require source and message', async () => {
    await expect(SystemLog.create({ message: 'm' })).rejects.toThrow();
    await expect(SystemLog.create({ source: 'S' })).rejects.toThrow();
    await expect(SystemLog.create({})).rejects.toThrow();
  });

  it('should store details as Mixed (object, string, array)', async () => {
    const logObj = await SystemLog.create({ source: 'S', message: 'm', details: { foo: 'bar', num: 123 } });
    expect(logObj.details.foo).toBe('bar');
    const logArr = await SystemLog.create({ source: 'S', message: 'm', details: ['a', 'b'] });
    expect(Array.isArray(logArr.details)).toBe(true);
  });

  it('should allow custom timestamp', async () => {
    const custom = new Date('2026-01-15T10:00:00.000Z');
    const log = await SystemLog.create({ source: 'S', message: 'm', timestamp: custom });
    expect(log.timestamp.toISOString()).toBe(custom.toISOString());
  });

  it('should have TTL index 90 days on timestamp', () => {
    const indexes = SystemLog.schema.indexes();
    const ttl = indexes.find(([fields, opts]) => fields.timestamp === 1 && opts.expireAfterSeconds === 90 * 24 * 60 * 60);
    expect(ttl).toBeDefined();
  });

  it('should have indexes on timestamp desc and level+timestamp', () => {
    const indexes = SystemLog.schema.indexes();
    const hasTimestampDesc = indexes.some(([fields]) => fields.timestamp === -1);
    expect(hasTimestampDesc).toBe(true);
    const hasLevel = indexes.some(([fields]) => fields.level === 1 && fields.timestamp === -1);
    expect(hasLevel).toBe(true);
  });
});
