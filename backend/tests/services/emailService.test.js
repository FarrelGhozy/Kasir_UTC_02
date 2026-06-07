jest.mock('nodemailer');
jest.mock('../../models/SystemLog');

const nodemailer = require('nodemailer');
const SystemLog = require('../../models/SystemLog');

let sendInvoiceEmail;
let mockTransporter;

beforeAll(() => {
  mockTransporter = { sendMail: jest.fn() };
  nodemailer.createTransport.mockReturnValue(mockTransporter);
  sendInvoiceEmail = require('../../services/emailService').sendInvoiceEmail;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendInvoiceEmail', () => {
  const ticket = {
    _id: '60f7b1b2b3b3b3b3b3b3b3b3',
    customer: { name: 'Budi Santoso', email: 'budi@example.com' },
    device: { brand: 'Samsung', model: 'Galaxy A52' },
    ticket_number: 'SRV-2026-0001',
    service_fee: 50000,
    parts_used: [
      { name: 'Battery Li-Ion', qty: 1, subtotal: 100000 },
      { name: 'Charger 18W', qty: 1, subtotal: 50000 }
    ],
    total_cost: 200000
  };

  test('sends email with ticket info when customer has email', async () => {
    mockTransporter.sendMail.mockResolvedValue({ accepted: ['budi@example.com'] });

    await sendInvoiceEmail(ticket);

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    const opts = mockTransporter.sendMail.mock.calls[0][0];

    expect(opts.to).toBe('budi@example.com');
    expect(opts.subject).toContain('SRV-2026-0001');
    expect(opts.html).toContain('Budi Santoso');
    expect(opts.html).toContain('Samsung');
    expect(opts.html).toContain('Galaxy A52');
    expect(opts.html).toContain('Battery Li-Ion');
    expect(opts.html).toContain('Charger 18W');
    expect(opts.html).toContain('Rp 200.000');
    expect(opts.html).toContain('Grand Total');
  });

  test('skips and logs WARN when no customer email', async () => {
    const noEmail = { ...ticket, customer: { ...ticket.customer, email: null } };

    await sendInvoiceEmail(noEmail);

    expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    expect(SystemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'WARN', source: 'EmailService' })
    );
  });

  test('handles sendMail failure gracefully and logs ERROR', async () => {
    mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

    await sendInvoiceEmail(ticket);

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    expect(SystemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'ERROR', source: 'EmailService' })
    );
  });

  test('HTML escaping special characters in customer name', async () => {
    const xssTicket = {
      ...ticket,
      customer: {
        name: 'Budi <script>alert("xss")</script> & Friends',
        email: 'budi@example.com'
      }
    };
    mockTransporter.sendMail.mockResolvedValue({ accepted: ['budi@example.com'] });

    await sendInvoiceEmail(xssTicket);

    const html = mockTransporter.sendMail.mock.calls[0][0].html;
    expect(html).toContain('Budi &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; Friends');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('"xss"');
  });

  test('retry logic fails 2 times, succeeds on 3rd attempt', async () => {
    mockTransporter.sendMail
      .mockRejectedValueOnce(new Error('Temporary error 1'))
      .mockRejectedValueOnce(new Error('Temporary error 2'))
      .mockResolvedValueOnce({ accepted: ['budi@example.com'] });

    await sendInvoiceEmail(ticket);

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    expect(SystemLog.create).not.toHaveBeenCalled();
  });
});
