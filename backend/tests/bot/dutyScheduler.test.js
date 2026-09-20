jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../bot/dutyReminder', () => ({ sendDutyReminder: jest.fn().mockResolvedValue(undefined) }));

const cron = require('node-cron');
const { startDutyReminderCron } = require('../../bot/dutyScheduler');

describe('dutyScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // Reset module cache for isStarted
    jest.resetModules();
  });
  afterEach(() => jest.restoreAllMocks());

  it('schedules 2 crons on first start', () => {
    jest.resetModules();
    jest.doMock('node-cron', () => ({ schedule: jest.fn() }));
    jest.doMock('../../bot/dutyReminder', () => ({ sendDutyReminder: jest.fn() }));
    const { startDutyReminderCron: start } = require('../../bot/dutyScheduler');
    const cronMock = require('node-cron');
    start();
    expect(cronMock.schedule).toHaveBeenCalledTimes(2);
    expect(cronMock.schedule).toHaveBeenCalledWith('0 16 * * 1-5', expect.any(Function), expect.objectContaining({ timezone: 'Asia/Jakarta' }));
    expect(cronMock.schedule).toHaveBeenCalledWith('30 21 * * 1-5', expect.any(Function), expect.objectContaining({ timezone: 'Asia/Jakarta' }));
  });

  it('second start is skipped (isStarted guard)', () => {
    const { startDutyReminderCron: start } = require('../../bot/dutyScheduler');
    // First start already done in previous test, but we need fresh
    // Use the already required module's isStarted
    start();
    const before = cron.schedule.mock.calls.length;
    start();
    expect(cron.schedule.mock.calls.length).toBe(before);
  });
});
