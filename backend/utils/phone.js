// utils/phone.js - Normalisasi & validasi format nomor HP Indonesia (terpusat)
// Dipakai oleh whatsappService, waController, dan helper validasi WA backend.
// Aturan: strip non-digit, awalan 0 -> 62. Format plausible: ^(62)8[0-9]{7,12}$
// (nomor seluler Indonesia diawali 08 / 628, total digit setelah normalisasi 10-15).

/**
 * Normalisasi nomor HP ke format internasional tanpa plus (628xx).
 * @param {string} phone - input mentah (boleh 08xx, 628xx, +628xx, spasi, strip)
 * @returns {string} digit ternormalisasi ('' bila input kosong)
 */
function normalizeIDPhone(phone) {
  if (phone === null || phone === undefined) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean;
}

/**
 * Cek apakah nomor layak dicek ke WAHA (cukup panjang & pola seluler ID).
 * Ambang ini juga dipakai frontend agar tidak menembak API saat user baru mengetik.
 * @param {string} phone - input mentah
 * @returns {boolean}
 */
function isPlausibleIDPhone(phone) {
  const clean = normalizeIDPhone(phone);
  // Minimal 9 digit agar request tidak spam saat baru mengetik;
  // pola penuh seluler: 62 + 8 + 7..12 digit (total 10-15 digit).
  if (clean.length < 9) return false;
  return /^62\d{8,13}$/.test(clean);
}

/**
 * Validasi ketat format seluler Indonesia (untuk penolakan 400 sebelum hit WAHA).
 * @param {string} phone - input mentah
 * @returns {boolean}
 */
function isStrictIDMobilePhone(phone) {
  const clean = normalizeIDPhone(phone);
  return /^628\d{7,12}$/.test(clean);
}

module.exports = { normalizeIDPhone, isPlausibleIDPhone, isStrictIDMobilePhone };
