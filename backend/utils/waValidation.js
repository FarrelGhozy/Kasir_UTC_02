// utils/waValidation.js - Validasi nomor WA otoritatif di backend (sebelum tulis DB)
// Kebijakan (sesuai kesepakatan):
// - Hanya memblokir bila ada BUKTI KUAT nomor tidak terdaftar:
//   session WAHA WORKING + check-exists tegas exists:false.
// - Bila WAHA mati/error/timeout -> fail-open (wa_status 'unknown'), simpan tetap jalan.
// - Soft-block: tanpa flag override -> 422 WA_NUMBER_NOT_FOUND (tanpa simpan).
// - Dengan flag wa_override_confirmed:true -> simpan + catat SystemLog WARN.
const SystemLog = require('../models/SystemLog');
const whatsappService = require('../services/whatsappService');
const { normalizeIDPhone, isStrictIDMobilePhone } = require('./phone');

/**
 * Normalisasi + validasi format nomor. Kembalikan { ok, clean, error }.
 * @param {*} rawPhone
 */
function checkPhoneFormat(rawPhone, { required = false } = {}) {
  const raw = rawPhone === null || rawPhone === undefined ? '' : String(rawPhone).trim();
  if (!raw) {
    if (required) return { ok: false, status: 400, message: 'Nomor telepon wajib diisi' };
    return { ok: true, empty: true, clean: '' };
  }
  if (!isStrictIDMobilePhone(raw)) {
    return {
      ok: false,
      status: 400,
      message: 'Format nomor telepon tidak valid. Gunakan format: 08xx-xxxx-xxxx atau +628xx-xxxx-xxxx'
    };
  }
  return { ok: true, empty: false, clean: normalizeIDPhone(raw) };
}

/**
 * Cek keberadaan nomor di WA via WAHA (dengan cache 5 menit di service).
 * @param {string} cleanPhone - nomor ternormalisasi
 * @returns {Promise<{ verdict: 'valid'|'invalid'|'unknown', waError: string|null }>}
 */
async function checkPhoneExists(cleanPhone) {
  let sessionStatus = 'UNKNOWN';
  try {
    const session = await whatsappService.checkSessionStatus();
    sessionStatus = session && session.status ? session.status : 'UNKNOWN';
  } catch (e) {
    sessionStatus = 'UNREACHABLE';
  }

  // Sesuai permintaan: pengecekan HANYA berlaku saat WAHA terkoneksi (WORKING).
  // Bila tidak WORKING -> unknown, simpan tetap jalan (fail-open).
  if (sessionStatus !== 'WORKING') {
    return { verdict: 'unknown', waError: `WAHA tidak terkoneksi (status: ${sessionStatus})` };
  }

  const result = await whatsappService.checkExists(cleanPhone);
  if (result && result.error) {
    return { verdict: 'unknown', waError: result.error };
  }
  if (result && result.exists === true) {
    return { verdict: 'valid', waError: null };
  }
  return { verdict: 'invalid', waError: null };
}

/**
 * Penegakan soft-block sebelum simpan ke DB.
 * Kembalikan { allowed: boolean, status?, code?, message?, waStatus }.
 * Bila !allowed, controller WAJIB return respons error tanpa menyimpan.
 *
 * @param {*} rawPhone - nomor mentah dari body
 * @param {object} opts
 * @param {boolean} opts.required - apakah nomor wajib ada
 * @param {boolean} opts.override - flag wa_override_confirmed dari body
 * @param {object} opts.logContext - { by, source, ticket_number/order_number/username }
 */
async function assertWAValidOrOverride(rawPhone, { required = false, override = false, logContext = {} } = {}) {
  const fmt = checkPhoneFormat(rawPhone, { required });
  if (!fmt.ok) {
    return { allowed: false, status: fmt.status, code: 'WA_NUMBER_FORMAT', message: fmt.message, waStatus: 'unknown' };
  }
  if (fmt.empty) {
    return { allowed: true, waStatus: 'unknown', clean: '' };
  }

  const { verdict, waError } = await checkPhoneExists(fmt.clean);

  if (verdict === 'valid') {
    return { allowed: true, waStatus: 'valid', clean: fmt.clean };
  }

  if (verdict === 'unknown') {
    return { allowed: true, waStatus: 'unknown', clean: fmt.clean, warning: waError };
  }

  // verdict === 'invalid' -> bukti kuat tidak terdaftar
  if (override === true) {
    SystemLog.create({
      level: 'WARN',
      source: 'WAValidation',
      message: 'Nomor WA tidak terdaftar tetapi disimpan via override kasir',
      details: { phone: fmt.clean, ...logContext }
    }).catch((err) => console.error('Gagal simpan log override WA:', err.message));
    return { allowed: true, waStatus: 'invalid', clean: fmt.clean, overridden: true };
  }

  return {
    allowed: false,
    status: 422,
    code: 'WA_NUMBER_NOT_FOUND',
    message: 'Nomor tidak terdeteksi terdaftar di WhatsApp. Periksa kembali nomornya, atau klik "Tetap simpan" untuk menyimpan dengan risiko notifikasi WA gagal.',
    waStatus: 'invalid',
    clean: fmt.clean
  };
}

/**
 * Terapkan hasil validasi ke sub-dokumen customer (ServiceTicket / SpecialOrder).
 * @param {object} customerObj - objek customer (plain object)
 * @param {string} waStatus - 'valid' | 'invalid' | 'unknown'
 */
function applyWACustomerMeta(customerObj, waStatus) {
  if (!customerObj || typeof customerObj !== 'object') return;
  customerObj.is_wa_valid = waStatus === 'valid';
  customerObj.wa_status = waStatus;
  customerObj.wa_checked_at = new Date();
}

module.exports = { checkPhoneFormat, checkPhoneExists, assertWAValidOrOverride, applyWACustomerMeta };
