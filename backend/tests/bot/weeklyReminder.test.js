// tests/bot/weeklyReminder.test.js — reminder weekend via sendReply (mock model + waha)
jest.mock('../../models/User', () => ({
  find: jest.fn()
}));
jest.mock('../../bot/wahaClient', () => ({
  sendReply: jest.fn().mockResolvedValue(undefined)
}));

const User = require('../../models/User');
const { sendReply } = require('../../bot/wahaClient');
const { sendWeekendReminder } = require('../../bot/weeklyReminder');

function mockUsers(rows) {
  User.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) });
}

const ACTIVE = [
  { name: 'Budi', phone: '08123456789' },
  { name: 'Siti', phone: '08129876543' }
];

describe('weeklyReminder.sendWeekendReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('tanpa user aktif -> return early tanpa kirim', async () => {
    mockUsers([]);
    await sendWeekendReminder('pre', 6);
    expect(User.find).toHaveBeenCalledWith({ isActive: true, phone: { $ne: '' } });
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('Sabtu pre -> pengingat kumpul wajib ke semua user', async () => {
    mockUsers(ACTIVE);
    await sendWeekendReminder('pre', 6);
    expect(sendReply).toHaveBeenCalledTimes(2);
    expect(sendReply).toHaveBeenCalledWith('08123456789', expect.stringContaining('KUMPUL WAJIB'));
  });

  it('Sabtu now -> waktunya kumpul', async () => {
    mockUsers(ACTIVE);
    await sendWeekendReminder('now', 6);
    expect(sendReply).toHaveBeenCalledWith('08123456789', expect.stringContaining('WAKTUNYA KUMPUL'));
  });

  it('Minggu pre -> pengingat bersih-bersih', async () => {
    mockUsers(ACTIVE);
    await sendWeekendReminder('pre', 0);
    expect(sendReply).toHaveBeenCalledWith('08123456789', expect.stringContaining('BERSIH-BERSIH'));
  });

  it('Minggu now -> waktunya bersih-bersih', async () => {
    mockUsers(ACTIVE);
    await sendWeekendReminder('now', 0);
    expect(sendReply).toHaveBeenCalledWith('08129876543', expect.stringContaining('WAKTUNYA BERSIH'));
  });

  it('user tanpa phone di-skip', async () => {
    mockUsers([{ name: 'Anom', phone: '' }]);
    await sendWeekendReminder('pre', 6);
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('sendReply gagal per-user tidak menggagalkan keseluruhan', async () => {
    mockUsers(ACTIVE);
    sendReply.mockRejectedValueOnce(new Error('WA down'));
    await expect(sendWeekendReminder('pre', 6)).resolves.toBeUndefined();
    expect(sendReply).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalled();
  });

  it('DB error tidak throw', async () => {
    User.find.mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('DB mati')) });
    await expect(sendWeekendReminder('pre', 6)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
