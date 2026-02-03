// server.js (GABUNGAN DENGAN SEEDER)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // Kita butuh mongoose langsung di sini
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');

// Import Model untuk Seeding
const User = require('./models/User');
const Item = require('./models/Item');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. DATA & LOGIKA SEEDING (Dari seed.js)
// ==========================================

const TECHNICIANS = [
  'Farrel Ghozy', 'M Wildan', 'Kaukab', 'Rasya', 
  'Tamam', 'Noer Syamsi', 'Baso Akbar'
];

const runSeederLogic = async () => {
  console.log('\n🌱 MEMULAI PROSES CEK & SEEDING DATABASE OTOMATIS...');
  
  try {
    // A. SEED TEKNISI
    for (const techName of TECHNICIANS) {
      const username = techName.toLowerCase().replace(/\s+/g, '_');
      const existingTech = await User.findOne({ username });
      
      if (!existingTech) {
        await User.create({
          name: techName,
          username: username,
          password: 'password123', // PENTING: Pastikan Backend Anda menghandle hashing, atau ganti hash manual
          role: 'teknisi'
        });
        console.log(`   ✅ Teknisi Dibuat: ${techName}`);
      }
    }

    // B. SEED ADMIN & KASIR
    const defaultUsers = [
      { name: 'Admin UTC', username: 'admin', password: 'admin123', role: 'admin' },
      { name: 'Kasir 1', username: 'kasir1', password: 'kasir123', role: 'kasir' }
    ];

    for (const userData of defaultUsers) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        await User.create(userData);
        console.log(`   ✅ User Dibuat: ${userData.name}`);
      }
    }

    // C. SEED BARANG (ITEMS)
    const sampleItems = [
      { sku: 'RAM-8GB-001', name: 'RAM DDR4 8GB Kingston', category: 'Sparepart', purchase_price: 400000, selling_price: 500000, stock: 15, min_stock_alert: 5 },
      { sku: 'SSD-256-001', name: 'SSD 256GB Samsung', category: 'Sparepart', purchase_price: 500000, selling_price: 650000, stock: 10, min_stock_alert: 3 },
      { sku: 'KB-MECH-001', name: 'Keyboard Mekanikal RGB', category: 'Accessory', purchase_price: 300000, selling_price: 450000, stock: 8, min_stock_alert: 2 },
      { sku: 'MOUSE-001', name: 'Mouse Gaming Logitech', category: 'Accessory', purchase_price: 200000, selling_price: 300000, stock: 12, min_stock_alert: 4 },
      { sku: 'HDMI-001', name: 'Kabel HDMI 2M', category: 'Accessory', purchase_price: 50000, selling_price: 75000, stock: 25, min_stock_alert: 10 },
      { sku: 'HDD-1TB-001', name: 'HDD 1TB Seagate', category: 'Sparepart', purchase_price: 600000, selling_price: 750000, stock: 7, min_stock_alert: 3 },
      { sku: 'PSU-500W-001', name: 'PSU 500W 80+ Bronze', category: 'Sparepart', purchase_price: 450000, selling_price: 600000, stock: 5, min_stock_alert: 2 },
      { sku: 'COOL-FAN-001', name: 'Kipas Pendingin CPU', category: 'Sparepart', purchase_price: 150000, selling_price: 225000, stock: 10, min_stock_alert: 3 },
      { sku: 'USB-HUB-001', name: 'USB Hub 4 Port', category: 'Accessory', purchase_price: 75000, selling_price: 120000, stock: 15, min_stock_alert: 5 },
      { sku: 'THERMAL-001', name: 'Pasta Termal Arctic', category: 'Sparepart', purchase_price: 40000, selling_price: 60000, stock: 20, min_stock_alert: 8 }
    ];

    for (const itemData of sampleItems) {
      const existingItem = await Item.findOne({ sku: itemData.sku });
      if (!existingItem) {
        await Item.create(itemData);
        console.log(`   ✅ Barang Dibuat: ${itemData.name}`);
      }
    }
    console.log('✅ SEEDING SELESAI (Data sudah lengkap/terupdate).\n');

  } catch (error) {
    console.error('⚠️  SEEDING ERROR (Server tetap jalan):', error.message);
    // Kita tidak exit process agar server tetap nyala walau seeding gagal
  }
};

// ==========================================
// 2. SETUP SERVER EXPRESS
// ==========================================

// Middleware

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://kasir.utc.web.id', 'https://www.kasir.utc.web.id'] 
    : '*', // <--- Development? Izinkan semua!
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API Bengkel UTC Ready' });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Rute tidak ditemukan' });
});

// Error Handler
app.use(errorHandler);

// ==========================================
// 3. START SERVER DENGAN URUTAN YANG BENAR
// ==========================================

const startServer = async () => {
  try {
    // 1. Hubungkan Database dulu
    await connectDB();
    
    // 2. Jalankan Seeding (Tunggu sampai selesai)
    await runSeederLogic();

    // 3. Baru jalankan Listen Port
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server API Bengkel UTC Berjalan`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(50));
    });

  } catch (err) {
    console.error('🔥 Gagal Menjalankan Server:', err);
    process.exit(1);
  }
};

// Jalankan fungsi utama
startServer();

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM diterima: menutup server HTTP');
  process.exit(0);
});