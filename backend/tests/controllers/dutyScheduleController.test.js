// tests/controllers/dutyScheduleController.test.js
const duty = require('../../controllers/dutyScheduleController');
const DutySchedule = require('../../models/DutySchedule');
const { createTeknisi } = require('../helpers/factory');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('dutyScheduleController', () => {
  it('createSchedule 400 bila user/day kosong', async () => {
    const res = mockRes();
    await duty.createSchedule({ body: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('createSchedule 400 bila id user invalid', async () => {
    const res = mockRes();
    await duty.createSchedule({ body: { user: 'bukan-id', day: 'senin' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('createSchedule 400 bila hari invalid', async () => {
    const tech = await createTeknisi();
    const res = mockRes();
    await duty.createSchedule({ body: { user: tech._id.toString(), day: 'sabtu' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('createSchedule 201 + duplikat user+hari ditolak', async () => {
    const tech = await createTeknisi();
    const res1 = mockRes();
    await duty.createSchedule({ body: { user: tech._id.toString(), day: 'Senin' } }, res1, jest.fn());
    expect(res1.status).toHaveBeenCalledWith(201);
    expect(res1.json.mock.calls[0][0].data.day).toBe('senin');

    const res2 = mockRes();
    await duty.createSchedule({ body: { user: tech._id.toString(), day: 'senin' } }, res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('getAllSchedules menambahkan day_label', async () => {
    const tech = await createTeknisi();
    await DutySchedule.create({ user: tech._id, day: 'rabu' });
    const res = mockRes();
    await duty.getAllSchedules({}, res, jest.fn());
    const data = res.json.mock.calls[0][0].data;
    expect(data.find(s => s.day === 'rabu').day_label).toBe('Rabu');
  });

  it('getScheduleByDay 400 untuk hari invalid', async () => {
    const res = mockRes();
    await duty.getScheduleByDay({ params: { day: 'minggu' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updateSchedule pindah hari + tolak duplikat', async () => {
    const tech = await createTeknisi();
    const s1 = await DutySchedule.create({ user: tech._id, day: 'senin' });
    await DutySchedule.create({ user: tech._id, day: 'selasa' });
    const resDup = mockRes();
    await duty.updateSchedule({ params: { id: s1._id.toString() }, body: { day: 'selasa' } }, resDup, jest.fn());
    expect(resDup.status).toHaveBeenCalledWith(400);

    const res = mockRes();
    await duty.updateSchedule({ params: { id: s1._id.toString() }, body: { day: 'kamis' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.day).toBe('kamis');
  });

  it('updateSchedule 404 bila id tidak ada', async () => {
    const res = mockRes();
    const { Types } = require('mongoose');
    await duty.updateSchedule({ params: { id: new Types.ObjectId().toString() }, body: { day: 'senin' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deleteSchedule 200 + getMySchedule milik sendiri', async () => {
    const tech = await createTeknisi();
    const s = await DutySchedule.create({ user: tech._id, day: 'jumat' });
    const resMy = mockRes();
    await duty.getMySchedule({ user: { id: tech._id.toString() } }, resMy, jest.fn());
    expect(resMy.json.mock.calls[0][0].data.length).toBe(1);

    const res = mockRes();
    await duty.deleteSchedule({ params: { id: s._id.toString() } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getTodaySchedule selalu 200 (array, kosong di akhir pekan)', async () => {
    const res = mockRes();
    await duty.getTodaySchedule({}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Array.isArray(res.json.mock.calls[0][0].data)).toBe(true);
  });
});
