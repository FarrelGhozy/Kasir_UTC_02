jest.mock('axios');
const axios = require('axios');

process.env.WAHA_URL = 'http://waha.test';
process.env.WAHA_API_KEY = 'key123';
process.env.WAHA_SESSION = 'default';

const wahaClient = require('../../bot/wahaClient');

describe('wahaClient.sendReply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_URL = 'http://waha.test';
    process.env.WAHA_API_KEY = 'key123';
    process.env.WAHA_SESSION = 'default';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mengirim ke 628xx@c.us dengan normalisasi 08xx', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await wahaClient.sendReply('08123456789', 'halo');
    expect(axios.post).toHaveBeenCalledWith(
      'http://waha.test/api/sendText',
      expect.objectContaining({ chatId: expect.stringContaining('@c.us'), text: 'halo', session: 'default' }),
      expect.objectContaining({ headers: { 'X-Api-Key': 'key123' } })
    );
    const chatId = axios.post.mock.calls[0][1].chatId;
    expect(chatId).toBe('628123456789@c.us');
  });

  it('tidak mengirim jika WAHA_URL/API_KEY kosong', async () => {
    delete process.env.WAHA_URL;
    await wahaClient.sendReply('08123456789', 'hi');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('menangani error axios tanpa throw', async () => {
    axios.post.mockRejectedValue({ response: { data: 'err' }, message: 'fail' });
    await expect(wahaClient.sendReply('08123456789', 'hi')).resolves.toBeUndefined();
  });

  it('chatId sudah mengandung @ tidak ditambah lagi', async () => {
    axios.post.mockResolvedValue({});
    // Phone already 628xx, normalize will keep, then add @c.us once
    await wahaClient.sendReply('628123456789', 'hi');
    const chatId = axios.post.mock.calls[0][1].chatId;
    expect(chatId).toBe('628123456789@c.us');
  });
});

describe('wahaClient.markChatUnread', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_URL = 'http://waha.test';
    process.env.WAHA_API_KEY = 'key123';
    process.env.WAHA_SESSION = 'default';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env.WAHA_URL = 'http://waha.test';
    process.env.WAHA_API_KEY = 'key123';
  });

  it('POST ke /api/session/chats/:chatId/unread', async () => {
    axios.post.mockResolvedValue({});
    await wahaClient.markChatUnread('08123456789');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/default/chats/'),
      {},
      expect.any(Object)
    );
  });

  it('tidak mengirim jika env kosong', async () => {
    delete process.env.WAHA_URL;
    await wahaClient.markChatUnread('08123456789');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('404 diabaikan tanpa error log', async () => {
    axios.post.mockRejectedValue({ response: { status: 404 }, message: 'not found' });
    await wahaClient.markChatUnread('08123456789');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('error non-404 dilog', async () => {
    axios.post.mockRejectedValue({ response: { status: 500 }, message: 'boom' });
    await wahaClient.markChatUnread('08123456789');
    expect(console.error).toHaveBeenCalled();
  });
});
