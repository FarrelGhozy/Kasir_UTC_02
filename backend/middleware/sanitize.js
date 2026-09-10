// middleware/sanitize.js - Proteksi NoSQL Injection
// Menghapus key berbahaya ('$...' atau mengandung '.') dari body/query/params
// sebelum mencapai query Mongoose. Mutasi in-place agar kompatibel Express 5.

/**
 * Cek apakah nama key berpotensi operator MongoDB
 */
function isKunciBerbahaya(key) {
  return typeof key === 'string' && (key.startsWith('$') || key.includes('.'));
}

/**
 * Cek apakah value adalah plain object (bukan Date/Buffer/ObjectId/dll)
 */
function isObjekPolos(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Bersihkan object/array secara rekursif (in-place).
 * Objek polos yang menjadi kosong setelah pembersihan ikut dibuang
 * (mis. { password: { $ne: null } } → key password hilang total).
 * Array kosong dipertahankan (bisa bermakna "kosongkan daftar").
 */
function bersihkan(data) {
  if (Array.isArray(data)) {
    data.forEach((item) => {
      if (Array.isArray(item)) bersihkan(item);
      else if (isObjekPolos(item)) bersihkan(item);
    });
    return;
  }

  if (!isObjekPolos(data)) return;

  for (const key of Object.keys(data)) {
    if (isKunciBerbahaya(key)) {
      delete data[key];
      continue;
    }
    const value = data[key];
    if (Array.isArray(value)) {
      bersihkan(value);
    } else if (isObjekPolos(value)) {
      bersihkan(value);
      if (Object.keys(value).length === 0) delete data[key];
    }
  }
}

/**
 * Middleware sanitasi input — pasang global setelah body parser
 */
module.exports = (req, res, next) => {
  try {
    if (req.body && typeof req.body === 'object') bersihkan(req.body);
    if (req.query && typeof req.query === 'object') bersihkan(req.query);
    if (req.params && typeof req.params === 'object') bersihkan(req.params);
  } catch (error) {
    console.error('[Sanitize] Gagal membersihkan input:', error.message);
  }
  next();
};
