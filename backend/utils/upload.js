const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Pastikan folder uploads ada
const uploadServicesDir = path.join(__dirname, '..', 'uploads', 'services');
const uploadItemsDir = path.join(__dirname, '..', 'uploads', 'items');
const uploadOrdersDir = path.join(__dirname, '..', 'uploads', 'orders');
[uploadServicesDir, uploadItemsDir, uploadOrdersDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadServicesDir);
  },
  filename: function (req, file, cb) {
    try {
      let customerName = 'Unknown';
      let deviceType = 'Device';

      // Multer populates req.body with fields encountered before files
      if (req.body.customer) {
        try {
          const customer = typeof req.body.customer === 'string' ? JSON.parse(req.body.customer) : req.body.customer;
          if (customer && customer.name) {
            customerName = customer.name.replace(/[^a-z0-9]/gi, '_');
          }
        } catch (e) {
          console.error('Error parsing customer in upload:', e);
        }
      }

      if (req.body.device) {
        try {
          const device = typeof req.body.device === 'string' ? JSON.parse(req.body.device) : req.body.device;
          if (device && device.type) {
            deviceType = device.type.replace(/[^a-z0-9]/gi, '_');
          }
        } catch (e) {
          console.error('Error parsing device in upload:', e);
        }
      }

      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
      const originalExt = path.extname(file.originalname).toLowerCase();
      const ext = allowedExts.includes(originalExt) ? originalExt : '.jpg';

      const randomStr = crypto.randomBytes(4).toString('hex');
      
      const finalName = `${customerName}_${deviceType}_${file.fieldname}_${randomStr}${ext}`;
      console.log(`Uploading: ${finalName}`);
      cb(null, finalName);
    } catch (err) {
      console.error('Multer filename error:', err);
      cb(err);
    }
  }
});

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPG, PNG, WebP) yang diperbolehkan!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Batas 5MB
  }
});

const orderStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadOrdersDir);
  },
  filename: function (req, file, cb) {
    try {
      let itemName = 'Order';
      if (req.body.item_name) {
        itemName = req.body.item_name.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
      }
      const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
      const originalExt = path.extname(file.originalname).toLowerCase();
      const ext = allowedExts.includes(originalExt) ? originalExt : '.jpg';
      const randomStr = crypto.randomBytes(4).toString('hex');
      const finalName = `${itemName}_${randomStr}${ext}`;
      console.log(`Uploading order photo: ${finalName}`);
      cb(null, finalName);
    } catch (err) {
      cb(err);
    }
  }
});

const uploadOrderPhoto = multer({
  storage: orderStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = { upload, uploadOrderPhoto };
