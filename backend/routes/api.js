// routes/api.js - Rute API Terpadu dengan Autentikasi
const express = require('express');
const router = express.Router();

// Impor controller
const authController = require('../controllers/authController');
const inventoryController = require('../controllers/inventoryController');
const serviceController = require('../controllers/serviceController');
const transactionController = require('../controllers/transactionController');
const reportController = require('../controllers/reportController');

// Impor middleware
const { protect, authorize } = require('../middleware/auth');

// ============================================
// RUTE PUBLIK (Tanpa Login)
// ============================================
router.post('/auth/login', authController.login);

// ============================================
// RUTE TERLINDUNGI (PERLU LOGIN)
// ============================================

// --- Manajemen Autentikasi & Pengguna ---
router.get('/auth/me', protect, authController.getMe);
router.get('/auth/technicians', protect, authController.getTechnicians);
router.patch('/auth/change-password', protect, authController.changePassword);

// Manajemen pengguna khusus Admin
router.post('/auth/register', protect, authorize('admin'), authController.register);
router.get('/auth/users', protect, authorize('admin'), authController.getAllUsers);
router.put('/auth/users/:id', protect, authorize('admin'), authController.updateUser);
router.delete('/auth/users/:id', protect, authorize('admin'), authController.deleteUser);

// ============================================
// RUTE INVENTARIS / GUDANG
// ============================================
router.get('/inventory', protect, inventoryController.getAllItems);
router.get('/inventory/alerts/low-stock', protect, inventoryController.getLowStockItems);
router.get('/inventory/summary/value', protect, authorize('admin'), inventoryController.getInventoryValue);
router.get('/inventory/summary/by-category', protect, inventoryController.getItemsByCategory);
router.get('/inventory/:id', protect, inventoryController.getItemById);

// Admin & Kasir dapat mengelola inventaris (Tambah/Edit)
router.post('/inventory', protect, authorize('admin', 'kasir'), inventoryController.createItem);
router.put('/inventory/:id', protect, authorize('admin', 'kasir'), inventoryController.updateItem);
router.patch('/inventory/:id/stock', protect, authorize('admin'), inventoryController.adjustStock);
router.delete('/inventory/:id', protect, authorize('admin'), inventoryController.deleteItem);

// ============================================
// RUTE TIKET SERVIS
// ============================================
router.get('/services', protect, serviceController.getAllTickets);
router.get('/services/:id', protect, serviceController.getTicketById);
router.get('/services/technician/:id/workload', protect, serviceController.getTechnicianWorkload);

// Teknisi & Admin dapat mengelola servis
router.post('/services', protect, authorize('teknisi', 'admin'), serviceController.createTicket);
router.patch('/services/:id/status', protect, authorize('teknisi', 'admin'), serviceController.updateStatus);
router.post('/services/:id/parts', protect, authorize('teknisi', 'admin'), serviceController.addPartToService);
router.patch('/services/:id/service-fee', protect, authorize('teknisi', 'admin'), serviceController.updateServiceFee);
router.delete('/services/:id', protect, authorize('admin'), serviceController.deleteTicket);

// ============================================
// RUTE TRANSAKSI / KASIR (POS)
// ============================================
router.get('/transactions', protect, transactionController.getAllTransactions);
router.get('/transactions/summary/today', protect, transactionController.getTodaySummary);
router.get('/transactions/invoice/:invoice_no', protect, transactionController.getTransactionByInvoice);
router.get('/transactions/:id', protect, transactionController.getTransactionById);

// Kasir & Admin dapat membuat transaksi
router.post('/transactions', protect, authorize('kasir', 'admin'), transactionController.createRetailTransaction);
router.delete('/transactions/:id', protect, authorize('admin'), transactionController.deleteTransaction);

// ============================================
// RUTE LAPORAN (Admin & Kasir)
// ============================================
router.get('/reports/revenue/daily', protect, authorize('admin', 'kasir'), reportController.getDailyRevenue);
router.get('/reports/revenue/monthly', protect, authorize('admin', 'kasir'), reportController.getMonthlyRevenue);
router.get('/reports/revenue/range', protect, authorize('admin', 'kasir'), reportController.getRevenueByRange);
router.get('/reports/top-items', protect, authorize('admin'), reportController.getTopSellingItems);
router.get('/reports/cashier-performance', protect, authorize('admin'), reportController.getCashierPerformance);
router.get('/reports/technician-performance', protect, authorize('admin'), reportController.getTechnicianPerformance);

module.exports = router;