jest.mock('../../bot/wahaClient', () => ({
  sendReply: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../models/User');

const User = require('../../models/User');
const { handleIncomingMessage } = require('../../bot/botHandler');
const { sendReply } = require('../../bot/wahaClient');

describe('botHandler.handleIncomingMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    const { _clearCache } = require('../../bot/botHandler');
    if (_clearCache) _clearCache();
  });

  it('skip fromMe true', async () => {
    await handleIncomingMessage({ from: '628123@c.us', fromMe: true, isGroup: false, isStatus: false });
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('skip isGroup true', async () => {
    await handleIncomingMessage({ from: '628123@c.us', fromMe: false, isGroup: true, isStatus: false });
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('skip isStatus true', async () => {
    await handleIncomingMessage({ from: '628123@c.us', fromMe: false, isGroup: false, isStatus: true });
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('skip @g.us', async () => {
    await handleIncomingMessage({ from: '123@g.us', fromMe: false, isGroup: false, isStatus: false });
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('skip teknisi (phone di cache)', async () => {
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ phone: '628123456789' }]) });
    // First call populates cache
    await handleIncomingMessage({ from: '628123456789@c.us', fromMe: false, isGroup: false, isStatus: false });
    expect(sendReply).not.toHaveBeenCalled();
    // Second call with same phone should still skip via cache
    await handleIncomingMessage({ from: '628123456789@c.us', fromMe: false, isGroup: false, isStatus: false });
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('non-teknisi tetap return early karena bot dimatikan sementara', async () => {
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
    await handleIncomingMessage({ from: '628999@c.us', fromMe: false, isGroup: false, isStatus: false });
    expect(sendReply).not.toHaveBeenCalled();
  });

  it('getTechnicianPhones cache 5 menit', async () => {
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ phone: '628111' }]) });
    await handleIncomingMessage({ from: '628999@c.us', fromMe: false, isGroup: false, isStatus: false });
    await handleIncomingMessage({ from: '628999@c.us', fromMe: false, isGroup: false, isStatus: false });
    expect(User.find).toHaveBeenCalledTimes(1);
  });
});
