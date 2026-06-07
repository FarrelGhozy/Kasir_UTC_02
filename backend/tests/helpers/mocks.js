const mockWhatsAppService = {
  sendMessage: jest.fn().mockResolvedValue({ success: true }),
  sendServiceWelcomeMessages: jest.fn().mockResolvedValue({ success: true }),
  sendOrderWelcomeMessages: jest.fn().mockResolvedValue({ success: true }),
  notifyServiceStatus: jest.fn().mockResolvedValue({ success: true }),
  notifyOrderStatus: jest.fn().mockResolvedValue({ success: true }),
  notifyTechnicianAssignment: jest.fn().mockResolvedValue({ success: true }),
  notifyOrderAssignment: jest.fn().mockResolvedValue({ success: true }),
  sendCustomerPickupReminder: jest.fn().mockResolvedValue({ success: true }),
  sendOrderPickupReminder: jest.fn().mockResolvedValue({ success: true }),
  sendTechnicianTaskReminder: jest.fn().mockResolvedValue({ success: true }),
  notifyTechnicianReminder: jest.fn().mockResolvedValue({ success: true }),
  checkExists: jest.fn().mockResolvedValue({ exists: true }),
  checkSessionStatus: jest.fn().mockResolvedValue({ status: 'WORKING' }),
  delay: jest.fn().mockResolvedValue(undefined)
};

const mockEmailService = {
  sendInvoiceEmail: jest.fn().mockResolvedValue(undefined)
};

module.exports = { mockWhatsAppService, mockEmailService };
