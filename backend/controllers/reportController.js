// controllers/reportController.js - Agregasi Pendapatan & Analitik
const Transaction = require('../models/Transaction');
const ServiceTicket = require('../models/ServiceTicket');
const Item = require('../models/Item');

/**
 * Validasi parameter tanggal, lempar error 400 jika format tidak valid
 */
function validateDateParam(dateStr, paramName) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    const err = new Error(`Parameter '${paramName}' tidak valid`);
    err.statusCode = 400;
    throw err;
  }
  return date;
}

/**
 * Bangun match stage untuk pipeline agregasi dengan filter tanggal
 * @param {Date|null} startDate - Tanggal mulai (nullable)
 * @param {Date|null} endDate - Tanggal akhir (nullable)
 * @param {Object} matchStage - Base match stage (contoh: { status: 'Picked_Up' })
 * @returns {Object} - Match stage dengan filter tanggal
 */
function buildReportPipeline(startDate, endDate, matchStage = {}) {
  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = endDate;
    const dateField = matchStage.status ? 'history.picked_up_at' : 'date';
    matchStage[dateField] = dateFilter;
  }
  return matchStage;
}

/**
 * @desc    Ambil rekapitulasi penuh untuk backup/laporan lengkap (dengan filter rentang)
 * @route   GET /api/reports/full-recap
 * @access  Private (Admin)
 */
exports.getFullRecap = async (req, res, next) => {
  try {
    const { range = 'all' } = req.query;

    const thirtyDaysAgo = range === '30days' ? (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    })() : null;

    const txnMatch = buildReportPipeline(thirtyDaysAgo, null, {});
    const svcMatch = buildReportPipeline(thirtyDaysAgo, null, { status: 'Picked_Up' });

    // 1. Ambil semua data inventaris (selalu semua data untuk stok saat ini)
    const inventory = await Item.find({ isActive: true }).sort({ category: 1, name: 1 }).lean();

    // 2. Ambil tiket servis sesuai filter
    const services = await ServiceTicket.find(svcMatch).sort({ 'history.picked_up_at': -1 }).lean();

    // 3. Ambil transaksi ritel sesuai filter
    const transactions = await Transaction.find(txnMatch).sort({ date: -1 }).lean();

    // 4. Hitung ringkasan statistik
    const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.stock * item.purchase_price), 0);
    const totalServiceRevenue = services.reduce((sum, s) => sum + s.total_cost, 0);
    const totalRetailRevenue = transactions.reduce((sum, t) => sum + t.grand_total, 0);

    // 5. Ambil data untuk grafik (tren pendapatan)
    const serviceTrends = await ServiceTicket.aggregate([
      ...(Object.keys(svcMatch).length > 0 ? [{ $match: svcMatch }] : []),
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$history.picked_up_at", timezone: 'Asia/Jakarta' } },
          amount: { $sum: "$total_cost" }
        }
      }
    ]);

    const retailTrends = await Transaction.aggregate([
      ...(Object.keys(txnMatch).length > 0 ? [{ $match: txnMatch }] : []),
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: 'Asia/Jakarta' } },
          amount: { $sum: "$grand_total" }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      timestamp: new Date(),
      range,
      data: {
        summary: {
          inventory_items: inventory.length,
          total_inventory_value: totalInventoryValue,
          total_service_tickets: services.length,
          total_service_revenue: totalServiceRevenue,
          total_retail_transactions: transactions.length,
          total_retail_revenue: totalRetailRevenue,
          grand_total_revenue: totalServiceRevenue + totalRetailRevenue
        },
        trends: {
          services: serviceTrends,
          retail: retailTrends
        },
        inventory,
        services,
        transactions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil pendapatan harian (Transaksi + Servis Selesai)
 * @route   GET /api/reports/revenue/daily
 * @access  Private (Admin, Kasir)
 */
exports.getDailyRevenue = async (req, res, next) => {
  try {
    const { date } = req.query;
    let startOfDay, endOfDay, resultDate;

    if (date) {
      // Parse string YYYY-MM-DD langsung (timezone-agnostic)
      const p = date.split('-');
      const y = parseInt(p[0]), m = parseInt(p[1]) - 1, d = parseInt(p[2]);
      startOfDay = new Date(Date.UTC(y, m, d - 1, 17, 0, 0, 0));
      endOfDay = new Date(Date.UTC(y, m, d, 16, 59, 59, 999));
      resultDate = date;
    } else {
      // Hari ini dalam WIB: hitung dari UTC
      const today = new Date();
      const wibOffset = 7 * 60 * 60 * 1000;
      const nowWIB = new Date(today.getTime() + wibOffset);
      const wy = nowWIB.getUTCFullYear();
      const wm = nowWIB.getUTCMonth();
      const wd = nowWIB.getUTCDate();
      startOfDay = new Date(Date.UTC(wy, wm, wd - 1, 17, 0, 0, 0));
      endOfDay = new Date(Date.UTC(wy, wm, wd, 16, 59, 59, 999));
      resultDate = `${wy}-${String(wm + 1).padStart(2, '0')}-${String(wd).padStart(2, '0')}`;
    }

    const txnMatch = buildReportPipeline(startOfDay, endOfDay, {});

    // Ambil pendapatan transaksi
    const transactionRevenue = await Transaction.aggregate([
      { $match: txnMatch },
      {
        $group: {
          _id: null,
          total: { $sum: '$grand_total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Ambil pendapatan servis (Picked_Up) — tolerir jika picked_up_at null
    const serviceRevenue = await ServiceTicket.aggregate([
      {
        $match: {
          status: 'Picked_Up',
          $or: [
            { 'history.picked_up_at': { $gte: startOfDay, $lte: endOfDay } },
            { 'history.picked_up_at': null, 'history.completed_at': { $gte: startOfDay, $lte: endOfDay } },
            { 'history.picked_up_at': null, 'history.completed_at': null, 'history.created_at': { $gte: startOfDay, $lte: endOfDay } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total_cost' },
          count: { $sum: 1 }
        }
      }
    ]);

    const txnData = transactionRevenue[0] || { total: 0, count: 0 };
    const svcData = serviceRevenue[0] || { total: 0, count: 0 };

    res.status(200).json({
      success: true,
      date: resultDate,
      data: {
        retail_sales: {
          revenue: txnData.total,
          transactions: txnData.count
        },
        service_revenue: {
          revenue: svcData.total,
          tickets: svcData.count
        },
        total_revenue: txnData.total + svcData.total,
        total_transactions: txnData.count + svcData.count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil pendapatan bulanan (Transaksi + Servis Selesai)
 * @route   GET /api/reports/revenue/monthly
 * @access  Private (Admin)
 */
exports.getMonthlyRevenue = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;

    if (year && (isNaN(targetYear) || targetYear < 2000 || targetYear > 2100)) {
      return res.status(400).json({ success: false, message: 'Parameter tahun tidak valid' });
    }
    if (month && (isNaN(targetMonth) || targetMonth < 1 || targetMonth > 12)) {
      return res.status(400).json({ success: false, message: 'Parameter bulan tidak valid (1-12)' });
    }

    const TIMEZONE = 'Asia/Jakarta';

    // Buat batas UTC yang mencakup seluruh bulan di timezone Asia/Jakarta (WIB, UTC+7)
    // Awal bulan: tgl-1 00:00 WIB = tgl-1 - 7jam UTC = tgl-1+7jam = hari SEBELUMNYA jam 17:00 UTC
    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 0, 17, 0, 0, 0));
    // Akhir bulan: tgl-terakhir 23:59:59 WIB = tgl-terakhir 16:59:59 UTC
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = new Date(Date.UTC(targetYear, targetMonth - 1, daysInMonth, 16, 59, 59, 999));

    const txnMatch = buildReportPipeline(startDate, endDate, {});

    // Pendapatan transaksi dikelompokkan per hari (timezone-aware)
    const transactionRevenue = await Transaction.aggregate([
      { $match: txnMatch },
      {
        $group: {
          _id: {
            $dateToString: { format: '%d', date: '$date', timezone: TIMEZONE }
          },
          revenue: { $sum: '$grand_total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Pendapatan servis (Picked_Up) — pakai $or agar tetap kebaca jika picked_up_at null
    const serviceRevenue = await ServiceTicket.aggregate([
      {
        $match: {
          status: 'Picked_Up',
          $or: [
            { 'history.picked_up_at': { $gte: startDate, $lte: endDate } },
            { 'history.picked_up_at': null, 'history.completed_at': { $gte: startDate, $lte: endDate } },
            { 'history.picked_up_at': null, 'history.completed_at': null, 'history.created_at': { $gte: startDate, $lte: endDate } }
          ]
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%d',
              date: { $ifNull: ['$history.picked_up_at', { $ifNull: ['$history.completed_at', '$history.created_at'] }] },
              timezone: TIMEZONE
            }
          },
          revenue: { $sum: '$total_cost' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Gabungkan data berdasarkan hari
    const dailyBreakdown = {};
    transactionRevenue.forEach(item => {
      const dayNum = parseInt(item._id, 10);
      dailyBreakdown[dayNum] = {
        day: dayNum,
        retail_revenue: item.revenue,
        retail_count: item.count,
        service_revenue: 0,
        service_count: 0
      };
    });

    serviceRevenue.forEach(item => {
      const dayNum = parseInt(item._id, 10);
      if (!dailyBreakdown[dayNum]) {
        dailyBreakdown[dayNum] = {
          day: dayNum,
          retail_revenue: 0,
          retail_count: 0,
          service_revenue: item.revenue,
          service_count: item.count
        };
      } else {
        dailyBreakdown[dayNum].service_revenue = item.revenue;
        dailyBreakdown[dayNum].service_count = item.count;
      }
    });

    // Hitung total dan tambahkan total harian
    const breakdown = Object.values(dailyBreakdown).map(day => ({
      ...day,
      total_revenue: day.retail_revenue + day.service_revenue
    }));

    const totalRevenue = breakdown.reduce((sum, day) => sum + day.total_revenue, 0);
    const totalRetail = breakdown.reduce((sum, day) => sum + day.retail_revenue, 0);
    const totalService = breakdown.reduce((sum, day) => sum + day.service_revenue, 0);

    res.status(200).json({
      success: true,
      period: {
        year: targetYear,
        month: targetMonth,
        month_name: new Date(targetYear, targetMonth - 1).toLocaleString('id-ID', { month: 'long' })
      },
      data: {
        total_revenue: totalRevenue,
        retail_revenue: totalRetail,
        service_revenue: totalService,
        daily_breakdown: breakdown
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil pendapatan berdasarkan rentang tanggal
 * @route   GET /api/reports/revenue/range
 * @access  Private (Admin)
 */
exports.getRevenueByRange = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Tanggal mulai dan tanggal akhir wajib diisi'
      });
    }

    // Parse tanggal langsung dari string YYYY-MM-DD (timezone-agnostic)
    const sp = start_date.split('-');
    const ep = end_date.split('-');
    const sy = parseInt(sp[0]), sm = parseInt(sp[1]) - 1, sd = parseInt(sp[2]);
    const ey = parseInt(ep[0]), em = parseInt(ep[1]) - 1, ed = parseInt(ep[2]);

    // Konversi ke UTC bounds untuk timezone Asia/Jakarta (WIB, UTC+7)
    // 00:00 WIB = prev day 17:00 UTC, 23:59:59 WIB = same day 16:59:59 UTC
    const utcStart = new Date(Date.UTC(sy, sm, sd - 1, 17, 0, 0, 0));
    const utcEnd = new Date(Date.UTC(ey, em, ed, 16, 59, 59, 999));

    const txnMatch = buildReportPipeline(utcStart, utcEnd, {});

    // Pendapatan Ritel
    const retailRevenue = await Transaction.aggregate([
      { $match: txnMatch },
      {
        $group: {
          _id: null,
          total: { $sum: '$grand_total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Pendapatan Servis (Picked_Up) — tolerir jika picked_up_at null
    const serviceRevenue = await ServiceTicket.aggregate([
      {
        $match: {
          status: 'Picked_Up',
          $or: [
            { 'history.picked_up_at': { $gte: utcStart, $lte: utcEnd } },
            { 'history.picked_up_at': null, 'history.completed_at': { $gte: utcStart, $lte: utcEnd } },
            { 'history.picked_up_at': null, 'history.completed_at': null, 'history.created_at': { $gte: utcStart, $lte: utcEnd } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total_cost' },
          count: { $sum: 1 }
        }
      }
    ]);

    const retailData = retailRevenue[0] || { total: 0, count: 0 };
    const serviceData = serviceRevenue[0] || { total: 0, count: 0 };

    res.status(200).json({
      success: true,
      period: {
        start: start_date,
        end: end_date
      },
      data: {
        retail_revenue: retailData.total,
        retail_transactions: retailData.count,
        service_revenue: serviceData.total,
        service_tickets: serviceData.count,
        total_revenue: retailData.total + serviceData.total,
        total_count: retailData.count + serviceData.count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil barang terlaris
 * @route   GET /api/reports/top-items
 * @access  Private (Admin)
 */
exports.getTopSellingItems = async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;

    const startDate = validateDateParam(start_date, 'start_date');
    const endDate = validateDateParam(end_date, 'end_date');

    let startOfDay = null;
    let endOfDay = null;
    if (startDate) {
      startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
    }

    const matchStage = buildReportPipeline(startOfDay, endOfDay, {});

    const topItems = await Transaction.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      { $match: { 'items': { $exists: true, $ne: [] } } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$items.item_id',
          item_name: { $first: '$items.name' },
          total_qty_sold: { $sum: '$items.qty' },
          total_revenue: { $sum: '$items.subtotal' },
          times_purchased: { $sum: 1 }
        }
      },
      { $sort: { total_qty_sold: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.status(200).json({
      success: true,
      data: topItems
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil performa kasir
 * @route   GET /api/reports/cashier-performance
 * @access  Private (Admin)
 */
exports.getCashierPerformance = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = validateDateParam(start_date, 'start_date');
    const endDate = validateDateParam(end_date, 'end_date');

    let startOfDay = null;
    let endOfDay = null;
    if (startDate) {
      startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
    }

    const matchStage = buildReportPipeline(startOfDay, endOfDay, {});

    const performance = await Transaction.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: '$cashier_id',
          cashier_name: { $first: '$cashier_name' },
          total_transactions: { $sum: 1 },
          total_revenue: { $sum: '$grand_total' },
          avg_transaction_value: { $avg: '$grand_total' }
        }
      },
      { $sort: { total_revenue: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ambil performa teknisi
 * @route   GET /api/reports/technician-performance
 * @access  Private (Admin)
 */
exports.getTechnicianPerformance = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = validateDateParam(start_date, 'start_date');
    const endDate = validateDateParam(end_date, 'end_date');

    let startOfDay = null;
    let endOfDay = null;
    if (startDate) {
      startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
    }

    const matchStage = buildReportPipeline(startOfDay, endOfDay, { status: 'Picked_Up' });

    const performance = await ServiceTicket.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$technician.id',
          technician_name: { $first: '$technician.name' },
          total_tickets: { $sum: 1 },
          total_revenue: { $sum: '$total_cost' },
          avg_ticket_value: { $avg: '$total_cost' }
        }
      },
      { $sort: { total_tickets: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    next(error);
  }
};
