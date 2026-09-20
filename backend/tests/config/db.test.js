jest.mock('mongoose');
const mongoose = require('mongoose');
const connectDB = require('../../config/db');

describe('config/db', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(process, 'on').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...OLD_ENV };
  });

  it('connects and logs host/name', async () => {
    mongoose.connect.mockResolvedValue({ connection: { host: 'localhost', name: 'testdb' } });
    mongoose.connection = { on: jest.fn(), close: jest.fn() };
    await connectDB();
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/test', expect.any(Object));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('MongoDB Terhubung'));
  });

  it('handles connection error and exits', async () => {
    mongoose.connect.mockRejectedValue(new Error('fail'));
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    await expect(connectDB()).rejects.toThrow('exit');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Koneksi MongoDB Gagal'), expect.any(String));
    exitSpy.mockRestore();
  });

  it('registers event listeners', async () => {
    mongoose.connect.mockResolvedValue({ connection: { host: 'h', name: 'n' } });
    const onSpy = jest.fn();
    mongoose.connection = { on: onSpy, close: jest.fn() };
    await connectDB();
    expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('disconnected', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });
});
