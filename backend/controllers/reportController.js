// controllers/reportController.js - Agregasi Pendapatan & Analitik
const Transaction = require('../models/Transaction');
const ServiceTicket = require('../models/ServiceTicket');
const mongoose = require('mongoose');

/**
 * @desc    Ambil pendapatan harian (Transaksi + Servis Selesai)
 * @route   GET /api/reports/revenue/daily
 * @access  Private (Admin, Kasir)
 */
exports.getDailyRevenue = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Ambil pendapatan transaksi
    const transactionRevenue = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$grand_total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Ambil pendapatan servis (tiket selesai)
    const serviceRevenue = await ServiceTicket.aggregate([
      {
        $match: {
          status: { $in: ['Completed', 'Picked_Up'] },
          'timestamps.completed_at': { $gte: startOfDay, $lte: endOfDay }
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
      date: targetDate.toISOString().split('T')[0],
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

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Pendapatan transaksi dikelompokkan per hari
    const transactionRevenue = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: '$date' },
          revenue: { $sum: '$grand_total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Pendapatan servis dikelompokkan per hari
    const serviceRevenue = await ServiceTicket.aggregate([
      {
        $match: {
          status: { $in: ['Completed', 'Picked_Up'] },
          'timestamps.completed_at': { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: '$timestamps.completed_at' },
          revenue: { $sum: '$total_cost' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Gabungkan data berdasarkan hari
    const dailyBreakdown = {};
    transactionRevenue.forEach(item => {
      dailyBreakdown[item._id] = {
        day: item._id,
        retail_revenue: item.revenue,
        retail_count: item.count,
        service_revenue: 0,
        service_count: 0
      };
    });

    serviceRevenue.forEach(item => {
      if (!dailyBreakdown[item._id]) {
        dailyBreakdown[item._id] = {
          day: item._id,
          retail_revenue: 0,
          retail_count: 0,
          service_revenue: item.revenue,
          service_count: item.count
        };
      } else {
        dailyBreakdown[item._id].service_revenue = item.revenue;
        dailyBreakdown[item._id].service_count = item.count;
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

    const startDate = new Date(start_date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);

    // Pendapatan Ritel
    const retailRevenue = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$grand_total' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Pendapatan Servis
    const serviceRevenue = await ServiceTicket.aggregate([
      {
        $match: {
          status: { $in: ['Completed', 'Picked_Up'] },
          'timestamps.completed_at': { $gte: startDate, $lte: endDate }
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

    const matchStage = {};
    if (start_date || end_date) {
      matchStage.date = {};
      if (start_date) matchStage.date.$gte = new Date(start_date);
      if (end_date) matchStage.date.$lte = new Date(end_date);
    }

    const topItems = await Transaction.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      { $unwind: '$items' },
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

    const matchStage = {};
    if (start_date || end_date) {
      matchStage.date = {};
      if (start_date) matchStage.date.$gte = new Date(start_date);
      if (end_date) matchStage.date.$lte = new Date(end_date);
    }

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

    const matchStage = { status: { $in: ['Completed', 'Picked_Up'] } };
    if (start_date || end_date) {
      matchStage['timestamps.completed_at'] = {};
      if (start_date) matchStage['timestamps.completed_at'].$gte = new Date(start_date);
      if (end_date) matchStage['timestamps.completed_at'].$lte = new Date(end_date);
    }

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