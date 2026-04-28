const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Pastikan folder uploads ada
const uploadDir = path.join(__dirname, '..', 'uploads', 'services');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
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

      const randomStr = Math.round(Math.random() * 1E6);
      const ext = path.extname(file.originalname) || '.jpg';
      
      // Format: NamaCostumer_Jenislaptop_random (with side prefix for uniqueness within same request)
      const finalName = `${customerName}_${deviceType}_${file.fieldname}_${randomStr}${ext}`;
      console.log(`Uploading: ${finalName}`);
      cb(null, finalName);
    } catch (err) {
      console.error('Multer filename error:', err);
      cb(err);
    }
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Batas 5MB
  }
});

module.exports = upload;
