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

// Buat user asli di DB memory + token yang sinkron dengan versi sesinya
const buatUserDanToken = async (overrides = {}, klaimTambahan = {}) => {
  const user = await User.create({
    name: 'Test',
    username: 'test_user_' + Date.now() + Math.floor(Math.random() * 1e6),
    password: 'pass123',
    role: 'kasir',
    ...overrides
  });
  const token = jwt.sign(
    { id: user._id.toString(), role: user.role, tv: user.tokenVersion, ...klaimTambahan },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { user, token };
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

  it('should call next() with valid token and take role from DB', async () => {
    const { token } = await buatUserDanToken({ role: 'admin' });
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
      { id: 'abc123', role: 'admin', tv: 0 },
      'wrong-secret'
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if user account is inactive in DB', async () => {
    const { token } = await buatUserDanToken({ role: 'kasir', isActive: false });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 for deactivated account even if token payload claims active', async () => {
    // Token meniru payload lama { isActive: true } — keputusan harus dari DB
    const { user } = await buatUserDanToken({ role: 'kasir', isActive: false });
    const token = jwt.sign(
      { id: user._id.toString(), role: 'kasir', isActive: true, tv: 0 },
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

  it('should return 401 for legacy token without session version', async () => {
    const { user } = await buatUserDanToken({ role: 'teknisi' });
    const token = jwt.sign(
      { id: user._id.toString(), role: 'teknisi' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('login kembali') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if session version does not match DB (session reset)', async () => {
    const { user, token } = await buatUserDanToken({ role: 'kasir' });
    // Simulasi ganti password / nonaktifkan akun: versi sesi naik
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if user from token not found in DB', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign(
      { id: fakeId, tv: 0 },
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
