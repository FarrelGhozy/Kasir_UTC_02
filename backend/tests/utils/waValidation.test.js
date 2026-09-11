// tests/utils/waValidation.test.js - Unit test kebijakan soft-block WA backend
jest.mock('../../services/whatsappService');
jest.mock('../../models/SystemLog');

const whatsappService = require('../../services/whatsappService');
const SystemLog = require('../../models/SystemLog');
const {
  checkPhoneFormat,
  checkPhoneExists,
  assertWAValidOrOverride,
  applyWACustomerMeta
} = require('../../utils/waValidation');

beforeEach(() => {
  jest.clearAllMocks();
  SystemLog.create.mockResolvedValue({});
});

describe('checkPhoneFormat', () => {
  test('kosong + opsional -> ok empty', () => {
    expect(checkPhoneFormat('', { required: false })).toMatchObject({ ok: true, empty: true });
  });

  test('kosong + required -> 400', () => {
    const r = checkPhoneFormat('', { required: true });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  test('format salah -> 400 WA_NUMBER_FORMAT', () => {
    const r = checkPhoneFormat('12345', { required: false });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  test('format benar -> ok + clean 628xx', () => {
    const r = checkPhoneFormat('08123456789', { required: false });
    expect(r).toMatchObject({ ok: true, empty: false, clean: '628123456789' });
  });
});

describe('checkPhoneExists (hanya berlaku saat WAHA WORKING)', () => {
  test('WORKING + exists -> valid', async () => {
    whatsappService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
    whatsappService.checkExists.mockResolvedValue({ exists: true, error: null });
    await expect(checkPhoneExists('628123456789')).resolves.toMatchObject({ verdict: 'valid' });
  });

  test('WORKING + not exists -> invalid', async () => {
    whatsappService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
    whatsappService.checkExists.mockResolvedValue({ exists: false, error: null });
    await expect(checkPhoneExists('628123456789')).resolves.toMatchObject({ verdict: 'invalid' });
  });

  test('WAHA tidak WORKING -> unknown (fail-open, tanpa cek exists)', async () => {
    whatsappService.checkSessionStatus.mockResolvedValue({ status: 'DISCONNECTED', error: 'down' });
    const r = await checkPhoneExists('628123456789');
    expect(r).toMatchObject({ verdict: 'unknown' });
    expect(whatsappService.checkExists).not.toHaveBeenCalled();
  });

  test('WORKING tapi check-exists error -> unknown', async () => {
    whatsappService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
    whatsappService.checkExists.mockResolvedValue({ exists: false, error: 'timeout' });
    const r = await checkPhoneExists('628123456789');
    expect(r).toMatchObject({ verdict: 'unknown', waError: 'timeout' });
  });
});

describe('assertWAValidOrOverride (soft-block)', () => {
  function mockInvalid() {
    whatsappService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
    whatsappService.checkExists.mockResolvedValue({ exists: false, error: null });
  }

  test('invalid tanpa override -> 422 WA_NUMBER_NOT_FOUND', async () => {
    mockInvalid();
    const r = await assertWAValidOrOverride('08123456789', { override: false });
    expect(r).toMatchObject({ allowed: false, status: 422, code: 'WA_NUMBER_NOT_FOUND', waStatus: 'invalid' });
    expect(SystemLog.create).not.toHaveBeenCalled();
  });

  test('invalid + override "Tetap simpan" -> allowed + log WARN', async () => {
    mockInvalid();
    const r = await assertWAValidOrOverride('08123456789', {
      override: true,
      logContext: { by: 'kasir1', source: 'createTicket' }
    });
    expect(r).toMatchObject({ allowed: true, waStatus: 'invalid', overridden: true });
    expect(SystemLog.create).toHaveBeenCalledWith(expect.objectContaining({
      level: 'WARN',
      source: 'WAValidation'
    }));
  });

  test('unknown (WAHA mati) -> allowed fail-open', async () => {
    whatsappService.checkSessionStatus.mockResolvedValue({ status: 'UNREACHABLE', error: 'down' });
    const r = await assertWAValidOrOverride('08123456789', { override: false });
    expect(r).toMatchObject({ allowed: true, waStatus: 'unknown' });
  });

  test('valid -> allowed', async () => {
    whatsappService.checkSessionStatus.mockResolvedValue({ status: 'WORKING' });
    whatsappService.checkExists.mockResolvedValue({ exists: true, error: null });
    const r = await assertWAValidOrOverride('08123456789', { override: false });
    expect(r).toMatchObject({ allowed: true, waStatus: 'valid' });
  });
});

describe('applyWACustomerMeta', () => {
  test('menandai is_wa_valid/wa_status/wa_checked_at', () => {
    const customer = { name: 'Budi', phone: '08123456789' };
    applyWACustomerMeta(customer, 'valid');
    expect(customer.is_wa_valid).toBe(true);
    expect(customer.wa_status).toBe('valid');
    expect(customer.wa_checked_at).toBeInstanceOf(Date);
  });

  test('invalid -> is_wa_valid false', () => {
    const customer = {};
    applyWACustomerMeta(customer, 'invalid');
    expect(customer.is_wa_valid).toBe(false);
    expect(customer.wa_status).toBe('invalid');
  });
});
