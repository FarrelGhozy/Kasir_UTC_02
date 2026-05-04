const whatsappService = require('../services/whatsappService');

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

    const result = await whatsappService.checkExists(phone);
    
    // Sesuai permintaan instruksi: isValid dan isError
    // result.error ada jika koneksi ke WAHA gagal
    const isError = !!result.error;
    const isValid = result.exists === true || result.status === 'exists';

    res.status(200).json({
      success: true,
      isValid: isValid,
      isError: isError,
      exists: isValid, // Tetap sertakan exists untuk backward compatibility jika ada
      details: result
    });
  } catch (error) {
    // Jika terjadi error sistem, kirim isError: true agar frontend bisa menangani (Scenario Timeout/WAHA Error)
    res.status(200).json({
      success: true,
      isValid: false,
      isError: true,
      message: error.message
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
    else if (result.status === 'DISCONNECTED' || result.status === 'STOPPED') status = 'DISCONNECTED';
    else if (result.status === 'SCAN_QR' || result.status === 'STARTING') status = 'STARTING';

    res.status(200).json({
      success: true,
      status: status,
      raw: result.status
    });
  } catch (error) {
    res.status(200).json({ success: true, status: 'ERROR', message: error.message });
  }
};
