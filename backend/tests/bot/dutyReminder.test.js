// tests/bot/dutyReminder.test.js — reminder piket via sendReply (mock model + waha)
jest.mock('../../models/DutySchedule', () => ({
  find: jest.fn()
}));
jest.mock('../../bot/wahaClient', () => ({
  sendReply: jest.fn().mockResolvedValue(undefined)
}));

const DutySchedule = require('../../models/DutySchedule');
const { sendReply } = require('../../bot/wahaClient');
const { sendDutyReminder } = require('../../bot/dutyReminder');

function mockSchedules(rows) {
  DutySchedule.find.mockReturnValue({
    populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) })
  });
}

// 16 Sep 2026 = Rabu (weekday), 20 Sep 2026 = Minggu (weekend)
const WEDNESDAY_WIB = new Date('2026-09-16T03:00:00+07:00');
const SUNDAY_WIB = new Date('2026-09-20T03:00:00+07:00');

describe('dutyReminder.sendDutyReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('akhir pekan (Minggu) -> return early tanpa query jadwal', async () => {
    jest.setSystemTime(SUNDAY_WIB);
    await sendDutyReminder('pre');
    expect(DutySchedule.find).not.toHaveBeenCalled();
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('weekday tanpa jadwal -> tidak kirim', async () => {
    jest.setSystemTime(WEDNESDAY_WIB);
    mockSchedules([]);
    await sendDutyReminder('pre');
    expect(DutySchedule.find).toHaveBeenCalledWith({ day: 'rabu' });
    expect(sendReply).not.toHaveBeenCalled();
  });

  it("type 'pre' -> pesan pengingat piket ke user berphone", async () => {
    jest.setSystemTime(WEDNESDAY_WIB);
    mockSchedules([{ user: { name: 'Budi', phone: '08123456789' } }]);
    await sendDutyReminder('pre');
    expect(sendReply).toHaveBeenCalledTimes(1);
    expect(sendReply).toHaveBeenCalledWith('08123456789', expect.stringContaining('Piket'));
  });

  it("type 'now' -> pesan waktunya piket", async () => {
    jest.setSystemTime(WEDNESDAY_WIB);
    mockSchedules([{ user: { name: 'Budi', phone: '08123456789' } }]);
    await sendDutyReminder('now');
    expect(sendReply).toHaveBeenCalledWith('08123456789', expect.stringContaining('Waktunya Piket'));
  });

  it('user tanpa phone di-skip', async () => {
    jest.setSystemTime(WEDNESDAY_WIB);
    mockSchedules([{ user: { name: 'Anom', phone: '' } }, { user: null }]);
    await sendDutyReminder('pre');
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('sendReply gagal per-user tidak menggagalkan keseluruhan', async () => {
    jest.setSystemTime(WEDNESDAY_WIB);
    mockSchedules([{ user: { name: 'Budi', phone: '08123456789' } }]);
    sendReply.mockRejectedValueOnce(new Error('WA down'));
    await expect(sendDutyReminder('pre')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('DB error tidak throw', async () => {
    jest.setSystemTime(WEDNESDAY_WIB);
    DutySchedule.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockRejectedValue(new Error('DB mati')) })
    });
    await expect(sendDutyReminder('pre')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
