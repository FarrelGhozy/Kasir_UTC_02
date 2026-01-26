// seed.js - Pengisi Database (Seeder) untuk Data Awal
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Item = require('./models/Item');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Terhubung');
  } catch (error) {
    console.error('❌ Koneksi MongoDB Gagal:', error.message);
    process.exit(1);
  }
};

// WAJIB: Nama teknisi sesuai spesifikasi
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
        password: 'password123', // Password default - GANTI SAAT PRODUKSI!
        role: 'teknisi'
      });
      console.log(`   ✅ Dibuat: ${techName} (username: ${username})`);
      createdCount++;
    }
  }

  console.log(`\n📊 Ringkasan Penambahan Teknisi:`);
  console.log(`   - Dibuat   : ${createdCount}`);
  console.log(`   - Dilewati : ${skippedCount}`);
  console.log(`   - Total    : ${TECHNICIANS.length}`);
};

const seedDefaultUsers = async () => {
  console.log('\n👤 Menambahkan Pengguna Default...');

  const defaultUsers = [
    {
      name: 'Admin UTC',
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    },
    {
      name: 'Kasir 1',
      username: 'kasir1',
      password: 'kasir123',
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

const seedSampleItems = async () => {
  console.log('\n📦 Menambahkan Contoh Barang Gudang...');

  const sampleItems = [
    {
      sku: 'RAM-8GB-001',
      name: 'RAM DDR4 8GB Kingston',
      category: 'Sparepart',
      purchase_price: 400000,
      selling_price: 500000,
      stock: 15,
      min_stock_alert: 5
    },
    {
      sku: 'SSD-256-001',
      name: 'SSD 256GB Samsung',
      category: 'Sparepart',
      purchase_price: 500000,
      selling_price: 650000,
      stock: 10,
      min_stock_alert: 3
    },
    {
      sku: 'KB-MECH-001',
      name: 'Keyboard Mekanikal RGB',
      category: 'Accessory',
      purchase_price: 300000,
      selling_price: 450000,
      stock: 8,
      min_stock_alert: 2
    },
    {
      sku: 'MOUSE-001',
      name: 'Mouse Gaming Logitech',
      category: 'Accessory',
      purchase_price: 200000,
      selling_price: 300000,
      stock: 12,
      min_stock_alert: 4
    },
    {
      sku: 'HDMI-001',
      name: 'Kabel HDMI 2M',
      category: 'Accessory',
      purchase_price: 50000,
      selling_price: 75000,
      stock: 25,
      min_stock_alert: 10
    },
    {
      sku: 'HDD-1TB-001',
      name: 'HDD 1TB Seagate',
      category: 'Sparepart',
      purchase_price: 600000,
      selling_price: 750000,
      stock: 7,
      min_stock_alert: 3
    },
    {
      sku: 'PSU-500W-001',
      name: 'PSU 500W 80+ Bronze',
      category: 'Sparepart',
      purchase_price: 450000,
      selling_price: 600000,
      stock: 5,
      min_stock_alert: 2
    },
    {
      sku: 'COOL-FAN-001',
      name: 'Kipas Pendingin CPU',
      category: 'Sparepart',
      purchase_price: 150000,
      selling_price: 225000,
      stock: 10,
      min_stock_alert: 3
    },
    {
      sku: 'USB-HUB-001',
      name: 'USB Hub 4 Port',
      category: 'Accessory',
      purchase_price: 75000,
      selling_price: 120000,
      stock: 15,
      min_stock_alert: 5
    },
    {
      sku: 'THERMAL-001',
      name: 'Pasta Termal Arctic',
      category: 'Sparepart',
      purchase_price: 40000,
      selling_price: 60000,
      stock: 20,
      min_stock_alert: 8
    }
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const itemData of sampleItems) {
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

  console.log(`\n📊 Ringkasan Penambahan Barang:`);
  console.log(`   - Dibuat   : ${createdCount}`);
  console.log(`   - Dilewati : ${skippedCount}`);
  console.log(`   - Total    : ${sampleItems.length}`);
};

const runSeeder = async () => {
  try {
    console.log('='.repeat(60));
    console.log('🌱 BENGKEL UTC - DATABASE SEEDER (PENGISI DATA)');
    console.log('='.repeat(60));

    await connectDB();

    // Jalankan urutan seeding
    await seedTechnicians();      // WAJIB: Teknisi
    await seedDefaultUsers();     // Admin & Kasir
    await seedSampleItems();      // Contoh barang gudang

    console.log('\n' + '='.repeat(60));
    console.log('✅ Pengisian database berhasil selesai!');
    console.log('='.repeat(60));
    console.log('\n📝 Kredensial Bawaan (Default):');
    console.log('   Admin    - Username: admin    | Password: admin123');
    console.log('   Kasir    - Username: kasir1   | Password: kasir123');
    console.log('   Teknisi  - Username: farrel   | Password: password123');
    console.log('\n⚠️  PENTING: Ubah kata sandi ini di mode produksi!');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Kesalahan Seeding:', error);
    process.exit(1);
  }
};

// Jalankan seeder
runSeeder();