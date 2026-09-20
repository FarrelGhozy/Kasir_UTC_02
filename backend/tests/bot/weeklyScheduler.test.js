jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../bot/weeklyReminder', () => ({ sendWeekendReminder: jest.fn().mockResolvedValue(undefined) }));

const cron = require('node-cron');
const { startWeekendReminderCron } = require('../../bot/weeklyScheduler');

describe('weeklyScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.resetModules();
  });
  afterEach(() => jest.restoreAllMocks());

  it('schedules 4 crons on first start', () => {
    jest.resetModules();
    jest.doMock('node-cron', () => ({ schedule: jest.fn() }));
    jest.doMock('../../bot/weeklyReminder', () => ({ sendWeekendReminder: jest.fn() }));
    const { startWeekendReminderCron: start } = require('../../bot/weeklyScheduler');
    const cronMock = require('node-cron');
    start();
    expect(cronMock.schedule).toHaveBeenCalledTimes(4);
  });

  it('second start skipped', () => {
    const { startWeekendReminderCron: start } = require('../../bot/weeklyScheduler');
    start();
    const before = cron.schedule.mock.calls.length;
    start();
    expect(cron.schedule.mock.calls.length).toBe(before);
  });
});
