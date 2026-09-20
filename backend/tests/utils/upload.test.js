// tests/utils/upload.test.js — Storage filename sanitasi, fileFilter mime, limits, destination
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

describe('upload utils - service storage & fileFilter', () => {
  let upload;
  let uploadOrderPhoto;

  beforeAll(() => {
    // Load after dirs created — require fresh
    jest.resetModules();
    // Mock console to keep output clean
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const mod = require('../../utils/upload');
    upload = mod.upload;
    uploadOrderPhoto = mod.uploadOrderPhoto;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  function getFilename(storage, req, file) {
    return new Promise((resolve, reject) => {
      storage.getFilename(req, file, (err, name) => {
        if (err) reject(err);
        else resolve(name);
      });
    });
  }

  function getDestination(storage, req, file) {
    return new Promise((resolve, reject) => {
      storage.getDestination(req, file, (err, dest) => {
        if (err) reject(err);
        else resolve(dest);
      });
    });
  }

  function fileFilter(uf, req, file) {
    return new Promise((resolve, reject) => {
      uf.fileFilter(req, file, (err, accept) => {
        if (err) reject(err);
        else resolve(accept);
      });
    });
  }

  describe('upload directories', () => {
    it('membuat folder uploads/services & uploads/orders jika belum ada', () => {
      const servicesDir = path.join(__dirname, '..', '..', 'uploads', 'services');
      const ordersDir = path.join(__dirname, '..', '..', 'uploads', 'orders');
      expect(fs.existsSync(servicesDir)).toBe(true);
      expect(fs.existsSync(ordersDir)).toBe(true);
    });
  });

  describe('upload (service) destination', () => {
    it('destination adalah uploads/services', async () => {
      const dest = await getDestination(upload.storage, { body: {} }, { originalname: 'a.jpg' });
      expect(dest).toContain(path.join('uploads', 'services'));
    });
  });

  describe('upload (service) filename sanitasi', () => {
    beforeEach(() => {
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('abcd'));
    });
    afterEach(() => {
      jest.restoreAllMocks();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('customer & device object disanitasi non-alphanum -> underscore', async () => {
      const req = { body: { customer: { name: 'Budi Santoso!' }, device: { type: 'Laptop/Gaming' } } };
      const file = { originalname: 'foto.jpg', fieldname: 'front' };
      const name = await getFilename(upload.storage, req, file);
      expect(name).toMatch(/^Budi_Santoso__Laptop_Gaming_front_/);
      expect(name).toContain('_front_');
    });

    it('customer sebagai JSON string diparsing', async () => {
      const req = { body: { customer: JSON.stringify({ name: 'Rina' }), device: JSON.stringify({ type: 'HP' }) } };
      const file = { originalname: 'a.png', fieldname: 'back' };
      const name = await getFilename(upload.storage, req, file);
      expect(name).toMatch(/^Rina_HP_back_/);
      expect(name.endsWith('.png')).toBe(true);
    });

    it('JSON rusak fallback Unknown/Device', async () => {
      const req = { body: { customer: '{rusak', device: '[rusak' } };
      const file = { originalname: 'x.jpg', fieldname: 'left' };
      const name = await getFilename(upload.storage, req, file);
      expect(name).toMatch(/^Unknown_Device_left_/);
    });

    it('tanpa customer/device fallback Unknown/Device', async () => {
      const req = { body: {} };
      const file = { originalname: 'y.jpg', fieldname: 'right' };
      const name = await getFilename(upload.storage, req, file);
      expect(name).toMatch(/^Unknown_Device_right_/);
    });

    it('customer name dengan karakter berbahaya disanitasi (path traversal)', async () => {
      const req = { body: { customer: { name: '../../etc/passwd' }, device: { type: 'Laptop' } } };
      const file = { originalname: 'a.jpg', fieldname: 'front' };
      const name = await getFilename(upload.storage, req, file);
      expect(name).not.toContain('/');
      expect(name).not.toContain('..');
      expect(name).toMatch(/^______etc_passwd_/);
    });

    it('ekstensi allowed .jpg .jpeg .png .webp dipertahankan lowercase', async () => {
      const req = { body: {} };
      for (const ext of ['.jpg', '.JPG', '.jpeg', '.PNG', '.webp', '.WEBP']) {
        const file = { originalname: `f${ext}`, fieldname: 'front' };
        const name = await getFilename(upload.storage, req, file);
        const expectedExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
        expect(name.endsWith(expectedExt)).toBe(true);
      }
    });

    it('ekstensi tidak allowed fallback .jpg', async () => {
      const req = { body: {} };
      const file = { originalname: 'evil.exe', fieldname: 'front' };
      const name = await getFilename(upload.storage, req, file);
      expect(name.endsWith('.jpg')).toBe(true);
      expect(name).not.toContain('.exe');
    });

    it('nama file unik tiap panggilan (random hex)', async () => {
      const req = { body: {} };
      const file = { originalname: 'a.jpg', fieldname: 'front' };
      jest.spyOn(crypto, 'randomBytes').mockReturnValueOnce(Buffer.from('aaaa')).mockReturnValueOnce(Buffer.from('bbbb'));
      const a = await getFilename(upload.storage, req, file);
      const b = await getFilename(upload.storage, req, file);
      expect(a).not.toBe(b);
    });

    it('fieldname dimasukkan ke nama file', async () => {
      const req = { body: {} };
      for (const fn of ['front', 'back', 'left', 'right']) {
        const file = { originalname: 'a.jpg', fieldname: fn };
        const name = await getFilename(upload.storage, req, file);
        expect(name).toContain(`_${fn}_`);
      }
    });
  });

  describe('uploadOrderPhoto storage', () => {
    beforeEach(() => {
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('abcd'));
    });
    afterEach(() => {
      jest.restoreAllMocks();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('destination adalah uploads/orders', async () => {
      const dest = await getDestination(uploadOrderPhoto.storage, { body: {} }, { originalname: 'a.jpg' });
      expect(dest).toContain(path.join('uploads', 'orders'));
    });

    it('item_name disanitasi & trunc 30 char', async () => {
      const req = { body: { item_name: 'RAM 8GB DDR4 3200MHz - Corsair Vengeance RGB PRO Long Name Exceeds Thirty Chars' } };
      const file = { originalname: 'p.jpg', fieldname: 'photo' };
      const name = await getFilename(uploadOrderPhoto.storage, req, file);
      const prefix = name.split('_')[0];
      // sanitasi replaces non-alphanum, and substring 0,30
      expect(prefix.length).toBeLessThanOrEqual(30);
      expect(name).not.toContain('/');
    });

    it('tanpa item_name fallback Order', async () => {
      const req = { body: {} };
      const file = { originalname: 'x.png', fieldname: 'photo' };
      const name = await getFilename(uploadOrderPhoto.storage, req, file);
      expect(name).toMatch(/^Order_/);
    });

    it('ekstensi allowed vs fallback untuk order', async () => {
      const req = { body: { item_name: 'Laptop' } };
      const ok = await getFilename(uploadOrderPhoto.storage, req, { originalname: 'a.webp', fieldname: 'photo' });
      expect(ok.endsWith('.webp')).toBe(true);
      const bad = await getFilename(uploadOrderPhoto.storage, req, { originalname: 'a.pdf', fieldname: 'photo' });
      expect(bad.endsWith('.jpg')).toBe(true);
    });

    it('format nama order: ItemName_randomHex.ext (tanpa fieldname duplikat)', async () => {
      const req = { body: { item_name: 'Laptop' } };
      const file = { originalname: 'a.jpg', fieldname: 'photo' };
      const name = await getFilename(uploadOrderPhoto.storage, req, file);
      expect(name).toMatch(/^Laptop_[0-9a-f]{8}\.jpg$/);
    });
  });

  describe('fileFilter mime', () => {
    it('menerima image/jpeg, image/png, image/webp', async () => {
      for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
        const accept = await fileFilter(upload, {}, { mimetype: mime });
        expect(accept).toBe(true);
      }
      for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
        const accept2 = await fileFilter(uploadOrderPhoto, {}, { mimetype: mime });
        expect(accept2).toBe(true);
      }
    });

    it('menolak mime tidak allowed (application/pdf, text/plain, image/gif)', async () => {
      for (const mime of ['application/pdf', 'text/plain', 'image/gif', 'video/mp4']) {
        await expect(fileFilter(upload, {}, { mimetype: mime })).rejects.toThrow('Hanya file gambar');
        await expect(fileFilter(uploadOrderPhoto, {}, { mimetype: mime })).rejects.toThrow('Hanya file gambar');
      }
    });

    it('menolak tanpa mimetype', async () => {
      await expect(fileFilter(upload, {}, { mimetype: '' })).rejects.toThrow('Hanya file gambar');
      await expect(fileFilter(upload, {}, {})).rejects.toThrow('Hanya file gambar');
    });
  });

  describe('limits fileSize', () => {
    it('batas 5MB untuk upload & uploadOrderPhoto', () => {
      expect(upload.limits.fileSize).toBe(5 * 1024 * 1024);
      expect(uploadOrderPhoto.limits.fileSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('storage instances', () => {
    it('upload & uploadOrderPhoto adalah multer instances dengan storage DiskStorage', () => {
      expect(upload.storage.getFilename).toBeDefined();
      expect(upload.storage.getDestination).toBeDefined();
      expect(uploadOrderPhoto.storage.getFilename).toBeDefined();
      expect(uploadOrderPhoto.storage.getDestination).toBeDefined();
      expect(typeof upload.storage.getFilename).toBe('function');
      expect(upload.limits).toBeDefined();
    });
  });
});
