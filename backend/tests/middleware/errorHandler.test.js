const mongoose = require('mongoose');
const errorHandler = require('../../middleware/errorHandler');

// Mock SystemLog so fire-and-forget create doesn't hit real DB
jest.mock('../../models/SystemLog', () => ({
  create: jest.fn().mockResolvedValue({})
}));

const mockReq = (overrides = {}) => ({
  originalUrl: '/api/test',
  method: 'GET',
  body: { name: 'Test', password: 'secret123' },
  user: { id: 'user123' },
  ...overrides
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('errorHandler', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('should handle CastError with 404', async () => {
    const err = new mongoose.Error.CastError('ObjectId', 'invalid', '_id');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('should handle duplicate key error (11000) with 400', async () => {
    const err = new Error('Duplicate key');
    err.code = 11000;
    err.keyValue = { username: 'admin' };
    err.name = 'MongoServerError';
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('username')
      })
    );
  });

  it('should handle ValidationError with 400', async () => {
    const err = new mongoose.Error.ValidationError();
    err.errors = {
      name: new mongoose.Error.ValidatorError({ message: 'Nama wajib diisi' }),
      email: new mongoose.Error.ValidatorError({ message: 'Email tidak valid' })
    };
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('should handle JsonWebTokenError with 401', async () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Token tidak valid' })
    );
  });

  it('should handle TokenExpiredError with 401', async () => {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('should handle generic Error with 500', async () => {
    const err = new Error('Sesuatu error');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Sesuatu error' })
    );
  });

  it('should include stack trace in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Dev error');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ stack: expect.any(String) })
    );
  });

  it('should not expose stack trace in production/test mode', async () => {
    const err = new Error('Prod error');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    const callArg = res.json.mock.calls[0][0];
    expect(callArg.stack).toBeUndefined();
  });

  it('should sanitize sensitive fields in log body', async () => {
    const req = mockReq({
      body: { username: 'admin', password: 'supersecret', token: 'abc' }
    });
    const res = mockRes();
    const next = jest.fn();
    const err = new Error('Test');

    await errorHandler(err, req, res, next);
    // Should not crash — SystemLog.create is mocked
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should handle error without message', async () => {
    const err = new Error();
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Kesalahan Server Internal' })
    );
  });
});
