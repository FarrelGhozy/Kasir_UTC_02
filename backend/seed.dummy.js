require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Item = require('./models/Item');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Database Terhubung');
  } catch (error) {
    console.error('Koneksi Gagal:', error.message);
    process.exit(1);
  }
};

const TECHNICIANS = [
  { name: 'Alpha Centauri', username: 'alpha_tech', password: 'DummyPass123', phone: '6281111111111', jabatan: 'Chief' },
  { name: 'Beta Orionis', username: 'beta_tech', password: 'DummyPass123', phone: '6282222222222', jabatan: 'PDD' },
  { name: 'Gamma Cassiopeiae', username: 'gamma_tech', password: 'DummyPass123', phone: '6283333333333', jabatan: 'Secretary' },
  { name: 'Delta Velorum', username: 'delta_tech', password: 'DummyPass123', phone: '6284444444444', jabatan: 'Admin' },
  { name: 'Epsilon Eridani', username: 'epsilon_tech', password: 'DummyPass123', phone: '6285555555555', jabatan: 'Equipment' },
  { name: 'Zeta Reticuli', username: 'zeta_tech', password: 'DummyPass123', phone: '6286666666666', jabatan: 'Equipment' },
  { name: 'Eta Carinae', username: 'eta_tech', password: 'DummyPass123', phone: '6287777777777', jabatan: 'PDD' },
  { name: 'Theta Serpentis', username: 'theta_tech', password: 'DummyPass123', phone: '6288888888888', jabatan: 'Equipment' },
  { name: 'Iota Draconis', username: 'iota_tech', password: 'DummyPass123', phone: '6289999999999', jabatan: 'Secretary' },
  { name: 'Kappa Lyrae', username: 'kappa_tech', password: 'DummyPass123', phone: '6281010101010', jabatan: 'Admin' },
];

const seedTechnicians = async () => {
  console.log('\nMenyeimbangkan Data Teknisi...');

  let createdCount = 0;
  let updatedCount = 0;
  const validUsernames = TECHNICIANS.map(t => t.username);

  for (const tech of TECHNICIANS) {
    const existingTech = await User.findOne({ username: tech.username });

    if (existingTech) {
      existingTech.name = tech.name;
      existingTech.phone = tech.phone;
      existingTech.role = 'teknisi';
      existingTech.isActive = true;
      if (tech.jabatan) existingTech.jabatan = tech.jabatan;
      await existingTech.save();
      console.log(`   Diperbarui: ${tech.name}`);
      updatedCount++;
    } else {
      await User.create({ ...tech, role: 'teknisi', isActive: true });
      console.log(`   Dibuat: ${tech.name}`);
      createdCount++;
    }
  }

  const strayTechs = await User.find({ role: 'teknisi', username: { $nin: validUsernames } });
  if (strayTechs.length > 0) {
    console.log(`   Menonaktifkan ${strayTechs.length} teknisi di luar list...`);
    await User.updateMany({ role: 'teknisi', username: { $nin: validUsernames } }, { isActive: false });
  }

  console.log(`\nRingkasan Teknisi: +${createdCount} Baru, ${updatedCount} Diperbarui, ${strayTechs.length} Dinonaktifkan`);
};

const seedDefaultUsers = async () => {
  console.log('\nMenambahkan Pengguna Default...');

  const defaultUsers = [
    { name: 'Admin Utama', username: 'admin_dummy', password: 'DummyAdmin456', role: 'admin' },
    { name: 'Kasir Utama', username: 'kasir_dummy', password: 'DummyKasir456', role: 'kasir' },
    { name: 'Manajer Toko', username: 'manajer_dummy', password: 'DummyManajer456', role: 'admin' },
  ];

  for (const userData of defaultUsers) {
    const existingUser = await User.findOne({ username: userData.username });
    if (existingUser) {
      console.log(`   Dilewati: ${userData.name} (sudah ada)`);
    } else {
      await User.create(userData);
      console.log(`   Dibuat: ${userData.name} (${userData.role})`);
    }
  }
};

const seedInventory = async () => {
  console.log('\nMenambahkan Data Inventory...');

  const inventoryItems = [
    // Makanan & Minuman
    { sku: 'FNB-COFFEE', name: 'Kopi Hitam Arabika 250gr', category: 'Other', purchase_price: 35000, selling_price: 65000, stock: 25, min_stock_alert: 5 },
    { sku: 'FNB-TEA', name: 'Teh Hijau Premium 50 Kantong', category: 'Other', purchase_price: 20000, selling_price: 45000, stock: 30, min_stock_alert: 5 },
    { sku: 'FNB-SNACK', name: 'Keripik Singkong Pedas 200gr', category: 'Other', purchase_price: 8000, selling_price: 18000, stock: 50, min_stock_alert: 10 },
    { sku: 'FNB-INSTANT', name: 'Mie Instant Goreng Premium', category: 'Other', purchase_price: 3500, selling_price: 8000, stock: 100, min_stock_alert: 20 },
    { sku: 'FNB-WATER', name: 'Air Mineral 600ml', category: 'Other', purchase_price: 3000, selling_price: 6000, stock: 100, min_stock_alert: 20 },

    // Alat Tulis Kantor
    { sku: 'ATK-PENSIL', name: 'Pensil Mekanik 0.5mm', category: 'Accessory', purchase_price: 5000, selling_price: 15000, stock: 40, min_stock_alert: 10 },
    { sku: 'ATK-BUKU', name: 'Buku Catatan A5 200 Lembar', category: 'Accessory', purchase_price: 12000, selling_price: 28000, stock: 25, min_stock_alert: 5 },
    { sku: 'ATK-SPIDOL', name: 'Spidol Whiteboard Hitam', category: 'Accessory', purchase_price: 4000, selling_price: 10000, stock: 30, min_stock_alert: 5 },
    { sku: 'ATK-STIKER', name: 'Kertas Stiker A4 10 Lembar', category: 'Accessory', purchase_price: 8000, selling_price: 18000, stock: 20, min_stock_alert: 5 },

    // Peralatan Elektronik
    { sku: 'ELC-FAN', name: 'Kipas Angin USB 6 Inch', category: 'Accessory', purchase_price: 30000, selling_price: 65000, stock: 15, min_stock_alert: 3 },
    { sku: 'ELC-LAMP', name: 'Lampu LED Meja 12W', category: 'Accessory', purchase_price: 25000, selling_price: 55000, stock: 20, min_stock_alert: 5 },
    { sku: 'ELC-POWER', name: 'Power Bank 10000mAh', category: 'Accessory', purchase_price: 70000, selling_price: 150000, stock: 10, min_stock_alert: 2 },
    { sku: 'ELC-EARPHONE', name: 'Earphone Bluetooth TWS', category: 'Accessory', purchase_price: 40000, selling_price: 95000, stock: 12, min_stock_alert: 3 },
    { sku: 'ELC-ADAPTER', name: 'Adaptor Charger Universal 2A', category: 'Accessory', purchase_price: 15000, selling_price: 35000, stock: 20, min_stock_alert: 5 },

    // Pakaian & Fashion
    { sku: 'FASH-TSHIRT', name: 'Kaos Polos Hitam Dewasa', category: 'Accessory', purchase_price: 35000, selling_price: 75000, stock: 30, min_stock_alert: 5 },
    { sku: 'FASH-CAP', name: 'Topi Baseball Hitam', category: 'Accessory', purchase_price: 20000, selling_price: 45000, stock: 15, min_stock_alert: 3 },
    { sku: 'FASH-MASK', name: 'Masker Kain 3 Lapis (Pack 5)', category: 'Accessory', purchase_price: 15000, selling_price: 35000, stock: 40, min_stock_alert: 10 },

    // Software & Lisensi
    { sku: 'SW-VLC', name: 'Lisensi VLC Media Player Pro', category: 'Software', purchase_price: 50000, selling_price: 120000, stock: 100, min_stock_alert: 10 },
    { sku: 'SW-PHOTO', name: 'Software Editor Foto Pro', category: 'Software', purchase_price: 80000, selling_price: 200000, stock: 50, min_stock_alert: 5 },
    { sku: 'SW-PDF', name: 'Software PDF Editor Premium', category: 'Software', purchase_price: 60000, selling_price: 150000, stock: 50, min_stock_alert: 5 },

    // Jasa Layanan
    { sku: 'SVC-FOTO', name: 'Jasa Cetak Foto 4R', category: 'Other', purchase_price: 2000, selling_price: 5000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-FOTOCOPY', name: 'Jasa Fotocopy Hitam Putih (Per Lembar)', category: 'Other', purchase_price: 100, selling_price: 300, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-LAMINATE', name: 'Jasa Laminating A4', category: 'Other', purchase_price: 1500, selling_price: 4000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-JILID', name: 'Jasa Penjilidan Dokumen', category: 'Other', purchase_price: 3000, selling_price: 8000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-PASANG-CCTV', name: 'Jasa Pasang Kamera CCTV', category: 'Other', purchase_price: 50000, selling_price: 200000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-INSTALL-WIFI', name: 'Jasa Instalasi Jaringan WiFi', category: 'Other', purchase_price: 75000, selling_price: 250000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-AC', name: 'Jasa Service AC Ringan', category: 'Other', purchase_price: 0, selling_price: 100000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-KULKAS', name: 'Jasa Service Kulkas', category: 'Other', purchase_price: 0, selling_price: 150000, stock: 999, min_stock_alert: 0 },
    { sku: 'SVC-MESIN-CUCI', name: 'Jasa Service Mesin Cuci', category: 'Other', purchase_price: 0, selling_price: 120000, stock: 999, min_stock_alert: 0 },
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const itemData of inventoryItems) {
    const existingItem = await Item.findOne({ sku: itemData.sku });
    if (existingItem) {
      console.log(`   Dilewati: ${itemData.name} (SKU ada)`);
      skippedCount++;
    } else {
      await Item.create(itemData);
      console.log(`   Dibuat: ${itemData.name}`);
      createdCount++;
    }
  }

  console.log(`\nRingkasan Inventory: +${createdCount} Baru, ${skippedCount} Dilewati`);
};

const seedDutySchedules = async () => {
  console.log('\nMenambahkan Jadwal Piket...');

  const DutySchedule = require('./models/DutySchedule');

  const dutySchedules = [
    { username: 'alpha_tech', day: 'senin' },
    { username: 'beta_tech', day: 'senin' },
    { username: 'gamma_tech', day: 'selasa' },
    { username: 'delta_tech', day: 'selasa' },
    { username: 'epsilon_tech', day: 'rabu' },
    { username: 'zeta_tech', day: 'rabu' },
    { username: 'eta_tech', day: 'kamis' },
    { username: 'theta_tech', day: 'kamis' },
    { username: 'iota_tech', day: 'jumat' },
    { username: 'kappa_tech', day: 'jumat' },
  ];

  let createdCount = 0;
  let skippedCount = 0;

  for (const schedule of dutySchedules) {
    const user = await User.findOne({ username: schedule.username }).lean();
    if (!user) {
      console.log(`   User ${schedule.username} tidak ditemukan, skip.`);
      continue;
    }

    const existing = await DutySchedule.findOne({ user: user._id, day: schedule.day });
    if (existing) {
      console.log(`   Dilewati: ${schedule.username} - ${schedule.day} sudah ada`);
      skippedCount++;
      continue;
    }

    await DutySchedule.create({ user: user._id, day: schedule.day });
    console.log(`   Dibuat: ${schedule.username} - ${schedule.day}`);
    createdCount++;
  }

  console.log(`\nRingkasan Piket: +${createdCount} Baru, ${skippedCount} Dilewati`);
};

const runSeeder = async () => {
  try {
    console.log('='.repeat(60));
    console.log('SEED DUMMY - BENGKEL UTC');
    console.log('='.repeat(60));

    await connectDB();
    await seedTechnicians();
    await seedDefaultUsers();
    await seedInventory();
    await seedDutySchedules();

    console.log('\n' + '='.repeat(60));
    console.log('Seeding dummy berhasil selesai!');
    console.log('='.repeat(60));
    console.log('\nKredensial Dummy:');
    console.log('   Admin   - Username: admin_dummy   | Pass: DummyAdmin456');
    console.log('   Kasir   - Username: kasir_dummy   | Pass: DummyKasir456');
    console.log('   Manajer - Username: manajer_dummy | Pass: DummyManajer456');
    console.log('   Teknisi - Password: DummyPass123');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\nKesalahan Seeding:', error);
    process.exit(1);
  }
};

runSeeder();
