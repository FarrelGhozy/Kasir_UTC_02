// tests/controllers/reportDateValidation.test.js — tanggal tak-kalendar ditolak 400
const { getDailyRevenue, getRevenueByRange } = require('../../controllers/reportController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('reportController validasi tanggal ketat', () => {
  it('getDailyRevenue 400 untuk 2026-13-45', async () => {
    const res = mockRes();
    const next = jest.fn();
    await getDailyRevenue({ query: { date: '2026-13-45' } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it('getDailyRevenue 400 untuk 2025-02-30', async () => {
    const res = mockRes();
    const next = jest.fn();
    await getDailyRevenue({ query: { date: '2025-02-30' } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it('getDailyRevenue 200 untuk tanggal valid', async () => {
    const res = mockRes();
    await getDailyRevenue({ query: { date: '2026-01-15' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].date).toBe('2026-01-15');
  });

  it('getRevenueByRange 400 bila start tak-kalendar', async () => {
    const res = mockRes();
    const next = jest.fn();
    await getRevenueByRange({ query: { start_date: '2026-13-01', end_date: '2026-01-31' } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it('getRevenueByRange 400 bila end tak-kalendar', async () => {
    const res = mockRes();
    const next = jest.fn();
    await getRevenueByRange({ query: { start_date: '2026-01-01', end_date: '2025-02-30' } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it('getRevenueByRange 200 untuk rentang valid', async () => {
    const res = mockRes();
    await getRevenueByRange({ query: { start_date: '2026-01-01', end_date: '2026-01-31' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
