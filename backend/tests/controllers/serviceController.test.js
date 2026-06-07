// Mock external services BEFORE requiring controller
jest.mock('../../services/whatsappService', () => require('../helpers/mocks').mockWhatsAppService);
jest.mock('../../services/emailService', () => require('../helpers/mocks').mockEmailService);

const mongoose = require('mongoose');
const {
  createTicket, getAllTickets, getTicketById, updateStatus,
  addPartToService, removePartFromService, updateServiceFee,
  deleteTicket, getTechnicianWorkload, updateTicketDetails,
  validateWA, resendWANotification, notifyTeknisi, claimWarranty,
  getSystemLogs
} = require('../../controllers/serviceController');
const ServiceTicket = require('../../models/ServiceTicket');
const Item = require('../../models/Item');
const User = require('../../models/User');
const SystemLog = require('../../models/SystemLog');
const { mockWhatsAppService, mockEmailService } = require('../helpers/mocks');
const {
  createUser, createAdmin, createKasir, createTeknisi,
  createItem, createServiceTicket
} = require('../helpers/factory');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  get: jest.fn().mockReturnValue('localhost:5000'),
  protocol: 'http',
  user: null,
  file: null,
  files: null,
  ...overrides
});

describe('ServiceController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should create a ticket successfully with customer/device objects', async () => {
      const teknisi = await createTeknisi();
      const req = mockReq({
        body: {
          customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
          device: { type: 'Laptop', brand: 'Dell', symptoms: 'Mati total' },
          technician_id: teknisi._id.toString(),
          service_fee: 50000,
          notes: 'Cepat rusak'
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Tiket servis berhasil dibuat'
        })
      );
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data.ticket_number).toMatch(/^SRV-/);
      expect(callArg.data.customer.name).toBe('Budi');
      expect(callArg.data.device.type).toBe('Laptop');
      expect(callArg.data.service_fee).toBe(50000);
      expect(callArg.data.technician.name).toBe(teknisi.name);
      expect(mockWhatsAppService.sendServiceWelcomeMessages).toHaveBeenCalled();
      expect(mockWhatsAppService.notifyTechnicianAssignment).toHaveBeenCalled();
    });

    it('should create a ticket with flat form fields', async () => {
      const teknisi = await createTeknisi();
      const req = mockReq({
        body: {
          customer_name: 'Siti',
          customer_phone: '08123456788',
          customer_type: 'Mahasiswa',
          device_type: 'HP',
          device_brand: 'Samsung',
          device_symptoms: 'Bootloop',
          technician_id: teknisi._id.toString()
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data.customer.name).toBe('Siti');
      expect(callArg.data.customer.type).toBe('Mahasiswa');
      expect(callArg.data.device.type).toBe('HP');
    });

    it('should create a ticket without customer phone (no WA notifications)', async () => {
      const teknisi = await createTeknisi();
      const req = mockReq({
        body: {
          customer: { name: 'Agus', phone: '', type: 'Umum' },
          device: { type: 'Printer', symptoms: 'Tidak bisa ngeprint' },
          technician_id: teknisi._id.toString()
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockWhatsAppService.sendServiceWelcomeMessages).not.toHaveBeenCalled();
    });

    it('should return 400 if customer or device is missing', async () => {
      const req = mockReq({
        body: {
          technician_id: new mongoose.Types.ObjectId().toString()
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('should return 400 if customer name is missing', async () => {
      const req = mockReq({
        body: {
          customer: { phone: '08123456789', type: 'Umum' },
          device: { type: 'Laptop', symptoms: 'Mati' },
          technician_id: new mongoose.Types.ObjectId().toString()
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if technician_id is invalid', async () => {
      const req = mockReq({
        body: {
          customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
          device: { type: 'Laptop', symptoms: 'Mati' },
          technician_id: new mongoose.Types.ObjectId().toString()
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'ID Teknisi tidak valid' })
      );
    });

    it('should create ticket with photos if files are uploaded', async () => {
      const teknisi = await createTeknisi();
      const req = mockReq({
        body: {
          customer: { name: 'Budi', phone: '08123456789', type: 'Umum' },
          device: { type: 'Laptop', symptoms: 'Mati' },
          technician_id: teknisi._id.toString()
        },
        files: {
          front: [{ filename: 'front.jpg' }],
          back: [{ filename: 'back.jpg' }],
          left: [{ filename: 'left.jpg' }],
          right: [{ filename: 'right.jpg' }]
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await createTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data.device.photos.front).toContain('front.jpg');
      expect(callArg.data.device.photos.back).toContain('back.jpg');
      expect(callArg.data.device.photos.left).toContain('left.jpg');
      expect(callArg.data.device.photos.right).toContain('right.jpg');
    });
  });

  describe('getAllTickets', () => {
    it('should return paginated tickets', async () => {
      await createServiceTicket();
      await createServiceTicket();
      await createServiceTicket();

      const req = mockReq({ query: { page: '1', limit: '10' } });
      const res = mockRes();
      const next = jest.fn();

      await getAllTickets(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.success).toBe(true);
      expect(callArg.data).toHaveLength(3);
      expect(callArg.pagination).toMatchObject({
        current_page: 1,
        total_records: 3,
        records_per_page: 10
      });
    });

    it('should filter tickets by status', async () => {
      const t1 = await createServiceTicket({ status: 'Queue' });
      await createServiceTicket({ status: 'Completed' });
      await createServiceTicket({ status: 'Queue' });

      const req = mockReq({ query: { status: 'Queue' } });
      const res = mockRes();
      const next = jest.fn();

      await getAllTickets(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data).toHaveLength(2);
      callArg.data.forEach(t => expect(t.status).toBe('Queue'));
    });

    it('should filter tickets by multiple statuses (comma-separated)', async () => {
      await createServiceTicket({ status: 'Queue' });
      await createServiceTicket({ status: 'Diagnosing' });
      await createServiceTicket({ status: 'Completed' });

      const req = mockReq({ query: { status: 'Queue,Diagnosing' } });
      const res = mockRes();
      const next = jest.fn();

      await getAllTickets(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data).toHaveLength(2);
    });

    it('should filter tickets by date range', async () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      await createServiceTicket();
      await createServiceTicket();

      const req = mockReq({ query: { start_date: dateStr, end_date: dateStr } });
      const res = mockRes();
      const next = jest.fn();

      await getAllTickets(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter tickets by technician', async () => {
      const tech1 = await createTeknisi();
      const tech2 = await createTeknisi();
      await createServiceTicket({
        technician: { id: tech1._id, name: tech1.name }
      });
      await createServiceTicket({
        technician: { id: tech2._id, name: tech2.name }
      });

      const req = mockReq({ query: { technician_id: tech1._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await getAllTickets(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data).toHaveLength(1);
      expect(callArg.data[0].technician.id.toString()).toBe(tech1._id.toString());
    });
  });

  describe('getTicketById', () => {
    it('should return a ticket by ID', async () => {
      const ticket = await createServiceTicket();

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await getTicketById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data._id.toString()).toBe(ticket._id.toString());
    });

    it('should return 404 if ticket not found', async () => {
      const req = mockReq({ params: { id: new mongoose.Types.ObjectId().toString() } });
      const res = mockRes();
      const next = jest.fn();

      await getTicketById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Tiket servis tidak ditemukan' })
      );
    });
  });

  describe('updateStatus', () => {
    it('should update ticket status successfully', async () => {
      const ticket = await createServiceTicket({ status: 'Queue' });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { status: 'Diagnosing' }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updated = await ServiceTicket.findById(ticket._id);
      expect(updated.status).toBe('Diagnosing');
      expect(mockWhatsAppService.notifyServiceStatus).toHaveBeenCalled();
    });

    it('should update with payment proof upload', async () => {
      const ticket = await createServiceTicket({ status: 'Completed' });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { status: 'Picked_Up', payment_method: 'Cash' },
        file: { filename: 'payment.jpg' }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updated = await ServiceTicket.findById(ticket._id);
      expect(updated.status).toBe('Picked_Up');
      expect(updated.payment_method).toBe('Cash');
      expect(updated.payment_proof).toContain('payment.jpg');
    });

    it('should send email when status is Completed', async () => {
      const ticket = await createServiceTicket({ status: 'Diagnosing' });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { status: 'Completed' }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockEmailService.sendInvoiceEmail).toHaveBeenCalled();
    });

    it('should return 404 if ticket not found', async () => {
      const req = mockReq({
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { status: 'Diagnosing' }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return error for invalid status transition', async () => {
      const ticket = await createServiceTicket({ status: 'Picked_Up' });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { status: 'Queue' }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateStatus(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toContain('Transisi status tidak valid');
    });
  });

  describe('addPartToService', () => {
    it('should add a part to a ticket successfully', async () => {
      const ticket = await createServiceTicket({ status: 'Queue' });
      const item = await createItem({ stock: 10 });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { item_id: item._id.toString(), quantity: 3 }
      });
      const res = mockRes();
      const next = jest.fn();

      await addPartToService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updatedTicket = await ServiceTicket.findById(ticket._id);
      expect(updatedTicket.parts_used).toHaveLength(1);
      expect(updatedTicket.parts_used[0].name).toBe(item.name);
      expect(updatedTicket.parts_used[0].qty).toBe(3);

      const updatedItem = await Item.findById(item._id);
      expect(updatedItem.stock).toBe(7);
    });

    it('should return 400 if item_id or quantity is invalid', async () => {
      const ticket = await createServiceTicket();

      let req = mockReq({
        params: { id: ticket._id.toString() },
        body: { quantity: 2 }
      });
      let res = mockRes();
      let next = jest.fn();
      await addPartToService(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);

      req = mockReq({
        params: { id: ticket._id.toString() },
        body: { item_id: new mongoose.Types.ObjectId().toString() }
      });
      res = mockRes();
      next = jest.fn();
      await addPartToService(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);

      req = mockReq({
        params: { id: ticket._id.toString() },
        body: { item_id: new mongoose.Types.ObjectId().toString(), quantity: 0 }
      });
      res = mockRes();
      next = jest.fn();
      await addPartToService(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);

      req = mockReq({
        params: { id: ticket._id.toString() },
        body: { item_id: new mongoose.Types.ObjectId().toString(), quantity: 1.5 }
      });
      res = mockRes();
      next = jest.fn();
      await addPartToService(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if ticket not found', async () => {
      const item = await createItem();
      const req = mockReq({
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { item_id: item._id.toString(), quantity: 1 }
      });
      const res = mockRes();
      const next = jest.fn();

      await addPartToService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 if item not found', async () => {
      const ticket = await createServiceTicket();
      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { item_id: new mongoose.Types.ObjectId().toString(), quantity: 1 }
      });
      const res = mockRes();
      const next = jest.fn();

      await addPartToService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if insufficient stock', async () => {
      const ticket = await createServiceTicket();
      const item = await createItem({ stock: 2 });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { item_id: item._id.toString(), quantity: 5 }
      });
      const res = mockRes();
      const next = jest.fn();

      await addPartToService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const updatedItem = await Item.findById(item._id);
      expect(updatedItem.stock).toBe(2);
    });

    it('should return 400 if ticket status is Picked_Up', async () => {
      const ticket = await createServiceTicket({ status: 'Picked_Up' });
      const item = await createItem({ stock: 10 });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { item_id: item._id.toString(), quantity: 1 }
      });
      const res = mockRes();
      const next = jest.fn();

      await addPartToService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Picked_Up')
        })
      );
    });
  });

  describe('removePartFromService', () => {
    it('should remove a part from a ticket and restore stock', async () => {
      const ticket = await createServiceTicket({ status: 'Queue' });
      const item = await createItem({ stock: 10 });
      ticket.parts_used.push({
        item_id: item._id,
        name: item.name,
        qty: 3,
        price_at_time: item.selling_price,
        subtotal: item.selling_price * 3
      });
      await ticket.save();
      const partId = ticket.parts_used[0]._id.toString();

      const req = mockReq({
        params: { id: ticket._id.toString(), part_id: partId }
      });
      const res = mockRes();
      const next = jest.fn();

      await removePartFromService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updatedTicket = await ServiceTicket.findById(ticket._id);
      expect(updatedTicket.parts_used).toHaveLength(0);

      const updatedItem = await Item.findById(item._id);
      expect(updatedItem.stock).toBe(13);
    });

    it('should return 404 if ticket not found', async () => {
      const req = mockReq({
        params: {
          id: new mongoose.Types.ObjectId().toString(),
          part_id: new mongoose.Types.ObjectId().toString()
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await removePartFromService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 if part not found on ticket', async () => {
      const ticket = await createServiceTicket();

      const req = mockReq({
        params: {
          id: ticket._id.toString(),
          part_id: new mongoose.Types.ObjectId().toString()
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await removePartFromService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if ticket status is Picked_Up', async () => {
      const ticket = await createServiceTicket({ status: 'Picked_Up' });

      const req = mockReq({
        params: {
          id: ticket._id.toString(),
          part_id: new mongoose.Types.ObjectId().toString()
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await removePartFromService(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateServiceFee', () => {
    it('should update service fee successfully', async () => {
      const ticket = await createServiceTicket({ service_fee: 25000 });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { service_fee: 75000 }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateServiceFee(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updated = await ServiceTicket.findById(ticket._id);
      expect(updated.service_fee).toBe(75000);
    });

    it('should return 400 if service fee is negative', async () => {
      const ticket = await createServiceTicket();

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { service_fee: -1000 }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateServiceFee(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Biaya tidak boleh negatif' })
      );
    });

    it('should return 404 if ticket not found', async () => {
      const req = mockReq({
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { service_fee: 50000 }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateServiceFee(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteTicket', () => {
    it('should hard delete ticket if user is admin', async () => {
      const admin = await createAdmin();
      const ticket = await createServiceTicket();

      const req = mockReq({
        params: { id: ticket._id.toString() },
        user: { _id: admin._id, role: 'admin' }
      });
      const res = mockRes();
      const next = jest.fn();

      await deleteTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const deleted = await ServiceTicket.findById(ticket._id);
      expect(deleted).toBeNull();
    });

    it('should cancel ticket if non-admin and status is not final', async () => {
      const user = await createUser({ role: 'kasir' });
      const ticket = await createServiceTicket({ status: 'Queue' });

      const req = mockReq({
        params: { id: ticket._id.toString() },
        user: { _id: user._id, role: 'kasir' }
      });
      const res = mockRes();
      const next = jest.fn();

      await deleteTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updated = await ServiceTicket.findById(ticket._id);
      expect(updated.status).toBe('Cancelled');
    });

    it('should return 400 if non-admin tries to delete ticket with final status', async () => {
      const user = await createUser({ role: 'kasir' });

      for (const finalStatus of ['Completed', 'Picked_Up', 'Cancelled']) {
        const ticket = await createServiceTicket({ status: finalStatus });
        const req = mockReq({
          params: { id: ticket._id.toString() },
          user: { _id: user._id, role: 'kasir' }
        });
        const res = mockRes();
        const next = jest.fn();

        await deleteTicket(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            message: expect.stringContaining('tidak dapat dibatalkan')
          })
        );
      }
    });

    it('should return 404 if ticket not found', async () => {
      const req = mockReq({
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' }
      });
      const res = mockRes();
      const next = jest.fn();

      await deleteTicket(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getTechnicianWorkload', () => {
    it('should return workload for a technician', async () => {
      const teknisi = await createTeknisi();
      await createServiceTicket({
        technician: { id: teknisi._id, name: teknisi.name },
        status: 'Queue'
      });
      await createServiceTicket({
        technician: { id: teknisi._id, name: teknisi.name },
        status: 'Diagnosing'
      });
      await createServiceTicket({
        technician: { id: teknisi._id, name: teknisi.name },
        status: 'Completed'
      });

      const req = mockReq({ params: { id: teknisi._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await getTechnicianWorkload(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.success).toBe(true);
      const queueCount = callArg.data.find(d => d._id === 'Queue');
      expect(queueCount.count).toBe(1);
    });

    it('should return empty array if technician has no active tickets', async () => {
      const teknisi = await createTeknisi();
      const req = mockReq({ params: { id: teknisi._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await getTechnicianWorkload(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data).toEqual([]);
    });
  });

  describe('updateTicketDetails', () => {
    it('should update customer and device details', async () => {
      const ticket = await createServiceTicket();

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: {
          customer: { name: 'Nama Baru', phone: '082345678901' },
          device: { type: 'HP', brand: 'Xiaomi' },
          notes: 'Catatan baru'
        }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateTicketDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updated = await ServiceTicket.findById(ticket._id);
      expect(updated.customer.name).toBe('Nama Baru');
      expect(updated.device.brand).toBe('Xiaomi');
      expect(updated.notes).toBe('Catatan baru');
    });

    it('should reassign technician and send notification', async () => {
      const ticket = await createServiceTicket();
      const newTech = await createTeknisi();

      const req = mockReq({
        params: { id: ticket._id.toString() },
        body: { technician_id: newTech._id.toString() }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateTicketDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const updated = await ServiceTicket.findById(ticket._id);
      expect(updated.technician.id.toString()).toBe(newTech._id.toString());
      expect(mockWhatsAppService.notifyTechnicianAssignment).toHaveBeenCalled();
    });

    it('should return 404 if ticket not found', async () => {
      const req = mockReq({
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { customer: { name: 'Nama' } }
      });
      const res = mockRes();
      const next = jest.fn();

      await updateTicketDetails(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('validateWA', () => {
    it('should validate a WhatsApp number', async () => {
      const req = mockReq({ body: { phone: '08123456789' } });
      const res = mockRes();
      const next = jest.fn();

      await validateWA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockWhatsAppService.checkExists).toHaveBeenCalledWith('08123456789');
    });

    it('should return 400 if phone is missing', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = jest.fn();

      await validateWA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Nomor WA wajib diisi' })
      );
    });
  });

  describe('resendWANotification', () => {
    it('should resend WA notification successfully', async () => {
      const ticket = await createServiceTicket({
        customer: { name: 'Test', phone: '08123456789', type: 'Umum' }
      });

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await resendWANotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockWhatsAppService.notifyServiceStatus).toHaveBeenCalled();
    });

    it('should return 404 if ticket not found', async () => {
      const req = mockReq({
        params: { id: new mongoose.Types.ObjectId().toString() }
      });
      const res = mockRes();
      const next = jest.fn();

      await resendWANotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if customer has no phone', async () => {
      const ticket = await createServiceTicket({
        customer: { name: 'Test', phone: '', type: 'Umum' }
      });

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await resendWANotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Pelanggan tidak memiliki nomor HP' })
      );
    });

    it('should return 500 if WA service fails', async () => {
      mockWhatsAppService.notifyServiceStatus.mockResolvedValueOnce({
        success: false,
        error: 'Network error'
      });
      const ticket = await createServiceTicket({
        customer: { name: 'Test', phone: '08123456789', type: 'Umum' }
      });

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await resendWANotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Network error')
        })
      );
    });
  });

  describe('notifyTeknisi', () => {
    it('should send notification to technician successfully', async () => {
      const teknisi = await createTeknisi();
      const ticket = await createServiceTicket({
        customer: { name: 'Test', phone: '08123456789', type: 'Umum' },
        technician: { id: teknisi._id, name: teknisi.name }
      });

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await notifyTeknisi(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockWhatsAppService.notifyTechnicianReminder).toHaveBeenCalled();
    });

    it('should return 404 if ticket not found', async () => {
      const req = mockReq({
        params: { id: new mongoose.Types.ObjectId().toString() }
      });
      const res = mockRes();
      const next = jest.fn();

      await notifyTeknisi(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if ticket has no technician', async () => {
      const ticket = await createServiceTicket();
      await ServiceTicket.findByIdAndUpdate(ticket._id, { $set: { technician: null } });
      // Clear the technician
      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await notifyTeknisi(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Tiket tidak memiliki teknisi' })
      );
    });

    it('should return 400 if technician has no phone', async () => {
      const teknisi = await createUser({ role: 'teknisi', phone: '' });
      const ticket = await createServiceTicket({
        technician: { id: teknisi._id, name: teknisi.name }
      });

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await notifyTeknisi(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Teknisi tidak memiliki nomor HP' })
      );
    });

    it('should return 500 if WA service fails', async () => {
      mockWhatsAppService.notifyTechnicianReminder.mockResolvedValueOnce({
        success: false,
        error: 'WA timeout'
      });
      const teknisi = await createTeknisi();
      const ticket = await createServiceTicket({
        technician: { id: teknisi._id, name: teknisi.name }
      });

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await notifyTeknisi(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('WA timeout')
        })
      );
    });
  });

  describe('claimWarranty', () => {
    it('should create a warranty claim ticket', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const ticket = await createServiceTicket({
        warranty_expires_at: futureDate
      });

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await claimWarranty(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data.ticket_number).toMatch(/^GRS-/);
      expect(callArg.data.notes).toContain(ticket.ticket_number);
      expect(callArg.data.service_fee).toBe(0);
    });

    it('should return 404 if original ticket not found', async () => {
      const req = mockReq({
        params: { id: new mongoose.Types.ObjectId().toString() }
      });
      const res = mockRes();
      const next = jest.fn();

      await claimWarranty(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if warranty has expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const ticket = await createServiceTicket({
        warranty_expires_at: pastDate
      });

      const req = mockReq({ params: { id: ticket._id.toString() } });
      const res = mockRes();
      const next = jest.fn();

      await claimWarranty(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Masa garansi telah habis' })
      );
    });
  });

  describe('getSystemLogs', () => {
    it('should return system logs', async () => {
      await SystemLog.create({
        level: 'INFO',
        source: 'Test',
        message: 'Test log entry'
      });
      await SystemLog.create({
        level: 'ERROR',
        source: 'Test',
        message: 'Error log entry'
      });

      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await getSystemLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data).toHaveLength(2);
    });

    it('should return empty array when no logs exist', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await getSystemLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const callArg = res.json.mock.calls[0][0];
      expect(callArg.data).toEqual([]);
    });
  });
});
