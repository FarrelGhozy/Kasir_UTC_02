const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { protect, authorize } = require('../../middleware/auth');
const User = require('../../models/User');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('auth - protect middleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-key';
  });

  it('should return 401 if no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization has wrong format', async () => {
    const req = { headers: { authorization: 'InvalidFormat token123' } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid/expired', async () => {
    const req = { headers: { authorization: 'Bearer invalid.token.here' } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() with valid token', async () => {
    const token = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.role).toBe('admin');
  });

  it('should return 401 if token signature is wrong', async () => {
    const token = jwt.sign(
      { id: 'abc123', role: 'admin' },
      'wrong-secret'
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if user account is inactive', async () => {
    const token = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), role: 'kasir', isActive: false },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should fetch role from DB if not in JWT payload', async () => {
    const user = await User.create({
      name: 'Test',
      username: 'test_fallback_role_' + Date.now(),
      password: 'pass123',
      role: 'teknisi'
    });
    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.role).toBe('teknisi');
  });

  it('should return 401 if user from token not found in DB', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign(
      { id: fakeId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('auth - authorize middleware', () => {
  it('should call next() if role matches', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    const middleware = authorize('admin', 'kasir');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if role does not match', () => {
    const req = { user: { role: 'kasir' } };
    const res = mockRes();
    const next = jest.fn();

    const middleware = authorize('admin');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 for unauthorized role with informative message', () => {
    const req = { user: { role: 'teknisi' } };
    const res = mockRes();
    const next = jest.fn();

    const middleware = authorize('admin', 'kasir');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('teknisi')
      })
    );
  });
});
