// config/db.js - Konfigurasi Koneksi MongoDB
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      compressors: ['snappy'],
    });

    console.log(`✅ MongoDB Terhubung: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Pendengar event koneksi (Event listeners)
    mongoose.connection.on('error', (err) => {
      console.error('❌ Kesalahan koneksi MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  Koneksi MongoDB terputus');
    });

    // Penutupan yang aman (Graceful shutdown) saat aplikasi dimatikan
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('Koneksi MongoDB ditutup melalui penghentian aplikasi');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Koneksi MongoDB Gagal:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;