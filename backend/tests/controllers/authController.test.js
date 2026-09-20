// tests/controllers/authController.test.js
jest.mock('../../services/whatsappService', () => require('../helpers/mocks').mockWhatsAppService);

const { login, getMe, getAllUsers, getTechnicians, register, updateUser, changePassword, deleteUser } = require('../../controllers/authController');
const { createAdmin, createKasir, createTeknisi, createUser } = require('../helpers/factory');
const User = require('../../models/User');
const { mockWhatsAppService } = require('../helpers/mocks');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWhatsAppService.checkSessionStatus.mockResolvedValue({ status: 'DISCONNECTED', error: 'down' });
});

describe('authController.login', () => {
  it('400 bila body kosong', async () => {
    const res = mockRes();
    await login({ body: null }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 bila username/password kosong', async () => {
    const res = mockRes();
    await login({ body: { username: '', password: '' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('401 bila kredensial salah', async () => {
    const res = mockRes();
    await login({ body: { username: 'tidak-ada', password: 'salah' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('200 + token bila kredensial benar', async () => {
    await createUser({ username: 'loginok', password: 'rahasia123' });
    const res = mockRes();
    await login({ body: { username: 'loginok', password: 'rahasia123' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.token).toBeTruthy();
  });

  it('403 bila akun dinonaktifkan', async () => {
    await createUser({ username: 'nonaktif', password: 'rahasia123', isActive: false });
    const res = mockRes();
    await login({ body: { username: 'nonaktif', password: 'rahasia123' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('authController.getMe / getAllUsers / getTechnicians', () => {
  it('getMe mengembalikan profil sendiri', async () => {
    const u = await createKasir();
    const res = mockRes();
    await getMe({ user: { id: u._id } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.username).toBe(u.username);
  });

  it('getAllUsers filter role', async () => {
    await createAdmin();
    await createKasir();
    const res = mockRes();
    await getAllUsers({ query: { role: 'kasir' } }, res, jest.fn());
    const data = res.json.mock.calls[0][0].data;
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.every(u => u.role === 'kasir')).toBe(true);
  });

  it('getTechnicians hanya teknisi aktif', async () => {
    await createTeknisi();
    const res = mockRes();
    await getTechnicians({}, res, jest.fn());
    const data = res.json.mock.calls[0][0].data;
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});

describe('authController.changePassword', () => {
  it('400 bila field kosong', async () => {
    const res = mockRes();
    await changePassword({ body: {}, user: { id: 'x' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('401 bila password lama salah', async () => {
    const u = await createUser({ username: 'gantipw', password: 'lama12345' });
    const res = mockRes();
    await changePassword({ body: { current_password: 'salah', new_password: 'baru12345' }, user: { id: u._id } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('200 + token lama hangus (tokenVersion naik)', async () => {
    const u = await createUser({ username: 'gantipw2', password: 'lama12345' });
    const before = (await User.findById(u._id).lean()).tokenVersion;
    const res = mockRes();
    await changePassword({ body: { current_password: 'lama12345', new_password: 'baru12345' }, user: { id: u._id } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    const after = (await User.findById(u._id).lean()).tokenVersion;
    expect(after).toBeGreaterThan(before);
  });
});

describe('authController.register / updateUser / deleteUser', () => {
  it('register 400 bila username duplikat', async () => {
    const u = await createKasir();
    const res = mockRes();
    await register({ body: { name: 'X', username: u.username, password: 'abc12345', role: 'kasir' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('register 201 untuk user baru (WA fail-open saat WAHA mati)', async () => {
    const res = mockRes();
    await register({ body: { name: 'Baru', username: `baru_${Date.now()}`, password: 'abc12345', role: 'kasir', phone: '08123456789' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updateUser 404 bila id tidak ada', async () => {
    const res = mockRes();
    const { Types } = require('mongoose');
    await updateUser({ params: { id: new Types.ObjectId() }, body: { name: 'X' }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deleteUser menonaktifkan + menaikkan tokenVersion', async () => {
    const u = await createKasir();
    const res = mockRes();
    await deleteUser({ params: { id: u._id }, user: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    const after = await User.findById(u._id).lean();
    expect(after.isActive).toBe(false);
  });
});
