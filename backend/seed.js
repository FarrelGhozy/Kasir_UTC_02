// seed.js - Pengisi Database (Seeder) untuk Data Awal
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Item = require('./models/Item');

// --- KONEKSI DATABASE ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Terhubung');
  } catch (error) {
    console.error('❌ Koneksi MongoDB Gagal:', error.message);
    process.exit(1);
  }
};

// --- DATA TEKNISI ---
const TECHNICIANS = [
  'Farrel Ghozy',
  'M Wildan',
  'Kaukab',
  'Rasya',
  'Tamam',
  'Noer Syamsi',
  'Baso Akbar'
];

const seedTechnicians = async () => {
  console.log('\n🔧 Menambahkan Data Teknisi...');
  
  let createdCount = 0;
  let skippedCount = 0;

  for (const techName of TECHNICIANS) {
    const username = techName.toLowerCase().replace(/\s+/g, '_');
    
    // Cek apakah teknisi sudah ada
    const existingTech = await User.findOne({ username });
    
    if (existingTech) {
      console.log(`   ⏭️  Dilewati: ${techName} (sudah ada)`);
      skippedCount++;
    } else {
      await User.create({
        name: techName,
        username: username,
        password: 'bengkelutc0326', // Password default
        role: 'teknisi'
      });
      console.log(`   ✅ Dibuat: ${techName} (username: ${username})`);
      createdCount++;
    }
  }

  console.log(`\n📊 Ringkasan Teknisi: +${createdCount} Baru, ${skippedCount} Dilewati`);
};

// --- DATA USER DEFAULT (ADMIN & KASIR) ---
const seedDefaultUsers = async () => {
  console.log('\n👤 Menambahkan Pengguna Default...');

  const defaultUsers = [
    {
      name: 'Admin UTC',

      username: 'admin-utc01',
      password: 'bengkelutc0326',

      role: 'admin'
    },
    {
      name: 'Kasir 1',
      username: 'kasir1',
      password: 'bengkelutc0326',

      role: 'kasir'
    }
  ];

  for (const userData of defaultUsers) {
    const existingUser = await User.findOne({ username: userData.username });
    
    if (existingUser) {
      console.log(`   ⏭️  Dilewati: ${userData.name} (sudah ada)`);
    } else {
      await User.create(userData);
      console.log(`   ✅ Dibuat: ${userData.name} (${userData.role})`);
    }
  }
};

// --- DATA BARANG & JASA (INVENTORY) ---
const seedInventory = async () => {
  console.log('\n📦 Menambahkan Data Inventory Lengkap...');

  // Data Gabungan Lengkap (Hardware + Software + Jasa)
  const inventoryItems = [
    // ==============================
    // 1. STORAGE (SSD & HDD)
    // ==============================
    { sku: 'SSD-SATA-128', name: 'SSD 128GB SATA 2.5" (V-GeN/RX7)', category: 'Sparepart', purchase_price: 180000, selling_price: 400000, stock: 10, min_stock_alert: 3 },
    { sku: 'SSD-SATA-256', name: 'SSD 256GB SATA 2.5" (Samsung/Kingston)', category: 'Sparepart', purchase_price: 280000, selling_price: 650000, stock: 8, min_stock_alert: 3 },
    { sku: 'SSD-SATA-512', name: 'SSD 512GB SATA 2.5"', category: 'Sparepart', purchase_price: 450000, selling_price: 870000, stock: 5, min_stock_alert: 2 },
    { sku: 'SSD-SATA-1TB', name: 'SSD 1TB SATA 2.5"', category: 'Sparepart', purchase_price: 850000, selling_price: 1500000, stock: 3, min_stock_alert: 1 },
    { sku: 'HDD-CADDY', name: 'HDD Caddy 9.5mm/12.7mm', category: 'Accessory', purchase_price: 25000, selling_price: 75000, stock: 15, min_stock_alert: 5 },

    // ==============================
    // 2. MEMORY (RAM)
    // ==============================
    { sku: 'RAM-D3-4GB', name: 'RAM DDR3 4GB PC12800', category: 'Sparepart', purchase_price: 120000, selling_price: 250000, stock: 8, min_stock_alert: 2 },
    { sku: 'RAM-D3-8GB', name: 'RAM DDR3 8GB PC12800', category: 'Sparepart', purchase_price: 350000, selling_price: 750000, stock: 5, min_stock_alert: 2 },
    { sku: 'RAM-D3-16GB', name: 'RAM DDR3 16GB Kit', category: 'Sparepart', purchase_price: 800000, selling_price: 1500000, stock: 2, min_stock_alert: 1 },
    { sku: 'RAM-D4-4GB', name: 'RAM DDR4 4GB PC2666', category: 'Sparepart', purchase_price: 180000, selling_price: 350000, stock: 10, min_stock_alert: 3 },
    { sku: 'RAM-D4-8GB', name: 'RAM DDR4 8GB PC2666/3200', category: 'Sparepart', purchase_price: 300000, selling_price: 670000, stock: 15, min_stock_alert: 5 },
    { sku: 'RAM-D4-16GB', name: 'RAM DDR4 16GB PC3200', category: 'Sparepart', purchase_price: 650000, selling_price: 1360000, stock: 8, min_stock_alert: 2 },
    { sku: 'RAM-D4-32GB', name: 'RAM DDR4 32GB Kit/Single', category: 'Sparepart', purchase_price: 1400000, selling_price: 2500000, stock: 2, min_stock_alert: 1 },
    { sku: 'RAM-D5-16GB', name: 'RAM DDR5 16GB PC4800/5600', category: 'Sparepart', purchase_price: 900000, selling_price: 2300000, stock: 4, min_stock_alert: 2 },

    // ==============================
    // 3. DISPLAY (LCD)
    // ==============================
    { sku: 'LCD-HP-LOW', name: 'LCD HP (Low IPS Quality)', category: 'Sparepart', purchase_price: 70000, selling_price: 120000, stock: 5, min_stock_alert: 2 },
    { sku: 'LCD-HP-MID', name: 'LCD HP (Mid IPS Quality)', category: 'Sparepart', purchase_price: 250000, selling_price: 470000, stock: 5, min_stock_alert: 2 },
    { sku: 'LCD-HP-HIGH', name: 'LCD HP (High IPS Quality)', category: 'Sparepart', purchase_price: 500000, selling_price: 900000, stock: 3, min_stock_alert: 1 },
    { sku: 'LCD-HP-AMOLED', name: 'LCD HP AMOLED (Low Quality)', category: 'Sparepart', purchase_price: 800000, selling_price: 1360000, stock: 2, min_stock_alert: 1 },
    { sku: 'LCD-NB-STD', name: 'LCD Laptop 14.0" (Standard/TN)', category: 'Sparepart', purchase_price: 300000, selling_price: 500000, stock: 3, min_stock_alert: 1 },
    { sku: 'LCD-NB-IPS', name: 'LCD Laptop 14.0" IPS FHD', category: 'Sparepart', purchase_price: 600000, selling_price: 900000, stock: 3, min_stock_alert: 1 },
    { sku: 'LCD-NB-HIGH', name: 'LCD Laptop High Gamut/144Hz', category: 'Sparepart', purchase_price: 950000, selling_price: 1500000, stock: 2, min_stock_alert: 1 },

    // ==============================
    // 4. PERIPHERALS & AKSESORIS
    // ==============================
    { sku: 'ACC-MOUSE-STD', name: 'Mouse Optik Standar (Logitech B100)', category: 'Accessory', purchase_price: 45000, selling_price: 75000, stock: 20, min_stock_alert: 5 },
    { sku: 'ACC-KB-STD', name: 'Keyboard Standar USB', category: 'Accessory', purchase_price: 60000, selling_price: 100000, stock: 10, min_stock_alert: 3 },
    { sku: 'ACC-FD-32', name: 'Flashdisk 32GB USB 3.0', category: 'Accessory', purchase_price: 50000, selling_price: 85000, stock: 15, min_stock_alert: 5 },
    { sku: 'ACC-MOUSEPAD', name: 'Mousepad Polos Hitam', category: 'Accessory', purchase_price: 5000, selling_price: 15000, stock: 30, min_stock_alert: 10 },
    { sku: 'ACC-KABEL-HDMI', name: 'Kabel HDMI 1.5m', category: 'Accessory', purchase_price: 15000, selling_price: 35000, stock: 20, min_stock_alert: 5 },
    { sku: 'ACC-CMOS', name: 'Baterai CMOS CR2032', category: 'Sparepart', purchase_price: 3000, selling_price: 10000, stock: 50, min_stock_alert: 10 },

    // ==============================
    // 5. NETWORKING
    // ==============================
    { sku: 'NET-WIFI-USB', name: 'USB WiFi Adapter 150Mbps', category: 'Accessory', purchase_price: 40000, selling_price: 85000, stock: 10, min_stock_alert: 3 },
    { sku: 'NET-KABEL-LAN', name: 'Kabel LAN UTP Cat5e (Per Meter)', category: 'Accessory', purchase_price: 3000, selling_price: 6000, stock: 300, min_stock_alert: 50 },
    { sku: 'NET-RJ45', name: 'Konektor RJ45 (Satuan)', category: 'Accessory', purchase_price: 1000, selling_price: 3000, stock: 100, min_stock_alert: 20 },
    { sku: 'NET-SWITCH-5', name: 'Switch Hub 5 Port', category: 'Accessory', purchase_price: 90000, selling_price: 150000, stock: 5, min_stock_alert: 1 },

    // ==============================
    // 6. SOFTWARE
    // ==============================
    { sku: 'SW-WIN10-PRO', name: 'Lisensi Windows 10 Pro', category: 'Software', purchase_price: 150000, selling_price: 350000, stock: 50, min_stock_alert: 10 },
    { sku: 'SW-WIN11-PRO', name: 'Lisensi Windows 11 Pro', category: 'Software', purchase_price: 175000, selling_price: 400000, stock: 50, min_stock_alert: 10 },
    { sku: 'SW-OFFICE-21', name: 'Microsoft Office 2021 Pro Plus', category: 'Software', purchase_price: 200000, selling_price: 450000, stock: 20, min_stock_alert: 5 },
    { sku: 'SW-AV-KASP', name: 'Antivirus Kaspersky Standard (1 Thn)', category: 'Software', purchase_price: 120000, selling_price: 220000, stock: 10, min_stock_alert: 3 },
    { sku: 'SW-ADOBE-CC', name: 'Jasa Instal Adobe CC Full (Offline)', category: 'Software', purchase_price: 0, selling_price: 100000, stock: 999, min_stock_alert: 0 },

    // ==============================
    // 7. OTHER (JASA & LAYANAN)
    // ==============================
    { sku: 'SVC-OS-REINST', name: 'Jasa Instal Ulang Windows + Driver', category: 'Other', purchase_price: 0, selling_price: 45000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-OS-FULL', name: 'Jasa Instal Paket Lengkap (App+Office)', category: 'Other', purchase_price: 0, selling_price: 75000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-INK-REFILL', name: 'Jasa Isi Ulang Tinta', category: 'Other', purchase_price: 5000, selling_price: 20000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-INK-KIT', name: 'Isi Ulang Tinta Inkjet Kit', category: 'Other', purchase_price: 35000, selling_price: 75000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-CHECKUP', name: 'Biaya Pengecekan / Diagnosa', category: 'Other', purchase_price: 0, selling_price: 25000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-CLEAN', name: 'Pembersihan + Ganti Pasta Thermal', category: 'Other', purchase_price: 10000, selling_price: 75000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-CLEAN-EXT', name: 'Deep Cleaning (Laptop Gaming/Total)', category: 'Other', purchase_price: 20000, selling_price: 150000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-INST-HW', name: 'Jasa Pasang Sparepart (Bawa Sendiri)', category: 'Other', purchase_price: 0, selling_price: 50000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-DATA-REC', name: 'Jasa Recovery Data (Ringan)', category: 'Other', purchase_price: 0, selling_price: 250000, stock: 999, min_stock_alert: 0 },
    
    // Tambahan Jasa Teknis Berat
    { sku: 'SVC-BIOS', name: 'Flash BIOS (Mainboard Error)', category: 'Other', purchase_price: 0, selling_price: 150000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-ENGSEL', name: 'Perbaikan Engsel Laptop (Per Sisi)', category: 'Other', purchase_price: 15000, selling_price: 100000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-KEYBOARD', name: 'Jasa Ganti Keyboard Tanam', category: 'Other', purchase_price: 0, selling_price: 75000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-MAINBOARD', name: 'Service Mainboard Ringan (No Display)', category: 'Other', purchase_price: 0, selling_price: 250000, stock: 999, min_stock_alert: 0 }
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const itemData of inventoryItems) {
    // Cek berdasarkan SKU agar tidak duplikat
    const existingItem = await Item.findOne({ sku: itemData.sku });
    
    if (existingItem) {
      console.log(`   ⏭️  Dilewati: ${itemData.name} (SKU ada)`);
      skippedCount++;
    } else {
      await Item.create(itemData);
      console.log(`   ✅ Dibuat: ${itemData.name}`);
      createdCount++;
    }
  }

  console.log(`\n📊 Ringkasan Inventory: +${createdCount} Baru, ${skippedCount} Dilewati`);
  console.log(`   Total Item dalam Kode: ${inventoryItems.length}`);
};

// --- FUNGSI EKSEKUSI UTAMA ---
const runSeeder = async () => {
  try {
    console.log('='.repeat(60));
    console.log('🌱 BENGKEL UTC - DATABASE SEEDER (FULL INVENTORY)');
    console.log('='.repeat(60));

    await connectDB();

    // Jalankan urutan seeding
    await seedTechnicians();      // 1. Teknisi
    await seedDefaultUsers();     // 2. Admin & Kasir
    await seedInventory();        // 3. Barang & Jasa Lengkap

    console.log('\n' + '='.repeat(60));
    console.log('✅ Pengisian database berhasil selesai!');
    console.log('='.repeat(60));
    console.log('\n📝 Kredensial Bawaan (Default):');
    console.log('   Admin    - Username: admin-utc01  | Pass: bengkelutc0326');
    console.log('   Kasir    - Username: kasir1       | Pass: bengkelutc0326');
    console.log('   Teknisi  - Username: [nama_user]  | Pass: bengkelutc0326');
    console.log('\n⚠️  Penting: Jangan lupa ubah password demi keamanan!');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Kesalahan Seeding:', error);
    process.exit(1);
  }
};

// Jalankan seeder
runSeeder();