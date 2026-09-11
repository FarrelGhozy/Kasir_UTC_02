const whatsappService = require('../services/whatsappService');
const { checkPhoneFormat, checkPhoneExists } = require('../utils/waValidation');

/**
 * @desc    Cek apakah nomor terdaftar di WA
 * @route   GET /api/check-wa?phone=...
 */
exports.checkWANumber = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Nomor HP wajib diisi' });
    }

    // Tolak format jelas-jelas salah tanpa membebani WAHA
    const fmt = checkPhoneFormat(phone, { required: true });
    if (!fmt.ok) {
      return res.status(fmt.status).json({
        success: false,
        isValid: false,
        isError: false,
        exists: false,
        waStatus: 'unknown',
        code: 'WA_NUMBER_FORMAT',
        message: fmt.message
      });
    }

    const { verdict, waError } = await checkPhoneExists(fmt.clean);
    const isError = verdict === 'unknown';

    res.status(200).json({
      success: true,
      isValid: verdict === 'valid',
      isError,
      exists: verdict === 'valid', // Tetap sertakan exists untuk backward compatibility
      // waStatus: 'valid' | 'invalid' | 'unknown' — 'unknown' berarti WAHA tidak
      // terkoneksi / error sehingga pengecekan tidak berlaku (fail-open di form).
      waStatus: verdict,
      cached: undefined,
      details: verdict === 'unknown'
        ? { exists: false, error: waError }
        : { exists: verdict === 'valid', error: null }
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      isValid: false,
      isError: true,
      waStatus: 'unknown',
      message: 'Gagal memeriksa nomor WhatsApp: ' + error.message
    });
  }
};

/**
 * @desc    Cek status session WAHA (Health Check)
 * @route   GET /api/waha-status
 */
exports.getWAHAStatus = async (req, res, next) => {
  try {
    const result = await whatsappService.checkSessionStatus();
    
    // Normalisasi status untuk frontend
    let status = 'ERROR';
    if (result.status === 'WORKING') status = 'CONNECTED';
    else if (result.status === 'UNREACHABLE') status = 'UNREACHABLE';
    else if (result.status === 'DISCONNECTED' || result.status === 'STOPPED') status = 'DISCONNECTED';
    else if (result.status === 'SCAN_QR' || result.status === 'STARTING') status = 'STARTING';

    res.status(200).json({
      success: true,
      status: status,
      raw: result.status,
      error: result.error || null
    });
  } catch (error) {
    res.status(502).json({ success: false, status: 'ERROR', message: error.message });
  }
};
