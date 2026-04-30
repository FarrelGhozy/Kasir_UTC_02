// routes/api.js - Rute API Terpadu dengan Autentikasi
const express = require('express');
const router = express.Router();

// Impor controller
const authController = require('../controllers/authController');
const inventoryController = require('../controllers/inventoryController');
const serviceController = require('../controllers/serviceController');
const transactionController = require('../controllers/transactionController');
const reportController = require('../controllers/reportController');
const orderController = require('../controllers/orderController');
const adminController = require('../controllers/adminController');
const backupController = require('../controllers/backupController');

// Impor middleware
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

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

// Admin & Kasir dapat mengelola inventaris
router.post('/inventory', protect, authorize('admin', 'kasir'), inventoryController.createItem);
router.post('/inventory/import', protect, authorize('admin', 'kasir'), inventoryController.importItems);
router.put('/inventory/:id', protect, authorize('admin', 'kasir'), inventoryController.updateItem);
// Teknisi juga dapat menyesuaikan stok (misal: barang rusak/disesuaikan manual)
router.patch('/inventory/:id/stock', protect, authorize('admin', 'kasir', 'teknisi'), inventoryController.adjustStock);
router.delete('/inventory/:id', protect, authorize('admin'), inventoryController.deleteItem);

// ============================================
// RUTE TIKET SERVIS
// ============================================
router.get('/services', protect, serviceController.getAllTickets);
// Rute spesifik harus didefinisikan SEBELUM rute dengan parameter (:id)
router.get('/services/technician/:id/workload', protect, serviceController.getTechnicianWorkload);
router.get('/services/logs', protect, authorize('admin'), serviceController.getSystemLogs);
router.post('/services/validate-wa', protect, serviceController.validateWA);
router.post('/services/:id/resend-wa', protect, serviceController.resendWANotification);
router.post('/services/:id/claim-warranty', protect, authorize('teknisi', 'kasir', 'admin'), serviceController.claimWarranty);
router.get('/services/:id', protect, serviceController.getTicketById);

// Teknisi, Kasir & Admin dapat mengelola servis
router.post('/services', protect, authorize('teknisi', 'kasir', 'admin'), upload.fields([
  { name: 'front', maxCount: 1 },
  { name: 'back', maxCount: 1 },
  { name: 'left', maxCount: 1 },
  { name: 'right', maxCount: 1 }
]), serviceController.createTicket);

router.put('/services/:id', protect, authorize('teknisi', 'kasir', 'admin'), upload.fields([
  { name: 'front', maxCount: 1 },
  { name: 'back', maxCount: 1 },
  { name: 'left', maxCount: 1 },
  { name: 'right', maxCount: 1 }
]), serviceController.updateTicketDetails);

router.patch('/services/:id/status', protect, authorize('teknisi', 'kasir', 'admin'), upload.single('payment_proof'), serviceController.updateStatus);
router.post('/services/:id/parts', protect, authorize('teknisi', 'kasir', 'admin'), serviceController.addPartToService);
router.delete('/services/:id/parts/:part_id', protect, authorize('teknisi', 'kasir', 'admin'), serviceController.removePartFromService);
router.patch('/services/:id/service-fee', protect, authorize('teknisi', 'kasir', 'admin'), serviceController.updateServiceFee);
router.delete('/services/:id', protect, authorize('admin'), serviceController.deleteTicket);

// ============================================
// RUTE PEMESANAN BARANG (SPECIAL ORDER)
// ============================================
router.get('/orders', protect, orderController.getAllOrders);
router.get('/orders/:id', protect, orderController.getOrderById);
router.post('/orders', protect, authorize('kasir', 'teknisi', 'admin'), orderController.createOrder);
router.put('/orders/:id', protect, authorize('kasir', 'teknisi', 'admin'), orderController.updateOrderDetails);
router.patch('/orders/:id/status', protect, authorize('kasir', 'teknisi', 'admin'), orderController.updateOrderStatus);
router.delete('/orders/:id', protect, authorize('admin', 'kasir'), orderController.deleteOrder);

// ============================================
// RUTE TRANSAKSI / KASIR (POS)
// ============================================
router.get('/transactions', protect, transactionController.getAllTransactions);
router.get('/transactions/summary/today', protect, transactionController.getTodaySummary);
router.get('/transactions/invoice/:invoice_no', protect, transactionController.getTransactionByInvoice);
router.get('/transactions/:id', protect, transactionController.getTransactionById);

// Kasir, Teknisi & Admin dapat membuat transaksi
router.post('/transactions', protect, authorize('kasir', 'teknisi', 'admin'), transactionController.createRetailTransaction);
router.delete('/transactions/:id', protect, authorize('admin'), transactionController.deleteTransaction);

// ============================================
// RUTE LAPORAN
// ============================================
// RUTE LAPORAN
// Semua peran dapat melihat pendapatan dasar
router.get('/reports/revenue/daily', protect, authorize('admin', 'kasir', 'teknisi'), reportController.getDailyRevenue);
router.get('/reports/revenue/monthly', protect, authorize('admin', 'kasir', 'teknisi'), reportController.getMonthlyRevenue);
router.get('/reports/revenue/range', protect, authorize('admin', 'kasir', 'teknisi'), reportController.getRevenueByRange);
// Hanya Admin yang dapat melihat laporan detail/performa & rekap penuh
router.get('/reports/full-recap', protect, authorize('admin'), reportController.getFullRecap);
router.get('/reports/top-items', protect, authorize('admin'), reportController.getTopSellingItems);
router.get('/reports/cashier-performance', protect, authorize('admin'), reportController.getCashierPerformance);
router.get('/reports/technician-performance', protect, authorize('admin'), reportController.getTechnicianPerformance);

// ============================================
// RUTE ADMIN (PENGELOLAAN DATA TEKNISI)
// ============================================
router.get('/admin/technicians', protect, authorize('admin'), adminController.getAllTechnicians);
router.post('/admin/technicians', protect, authorize('admin'), adminController.createTechnician);
router.put('/admin/technicians/:id', protect, authorize('admin'), adminController.updateTechnician);
router.delete('/admin/technicians/:id', protect, authorize('admin'), adminController.deleteTechnician);

// --- Backup & Restore ---
router.get('/admin/backup/export', protect, authorize('admin'), backupController.exportData);
router.post('/admin/backup/import', protect, authorize('admin'), backupController.importData);

module.exports = router;
