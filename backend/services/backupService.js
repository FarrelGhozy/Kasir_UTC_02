const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const ServiceTicket = require('../models/ServiceTicket');
const Transaction = require('../models/Transaction');
const SpecialOrder = require('../models/SpecialOrder');
const SystemLog = require('../models/SystemLog');

const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '..', 'backups');
    this.schedule = '0 0 * * *';
    this.RETENTION_DAYS = 30;
  }

  init() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('[BackupService] Folder backup dibuat:', this.backupDir);
    }

    this.runBackup();

    console.log('[BackupService] Backup terjadwal setiap hari pukul 00:00 WIB');
    cron.schedule(this.schedule, () => {
      this.runBackup();
    }, {
      timezone: 'Asia/Jakarta'
    });
  }

  async runBackup() {
    try {
      console.log('[BackupService] Memulai backup database...');
      await this.doBackup();
      await this.cleanupOld();
      console.log('[BackupService] Backup selesai.');
    } catch (error) {
      console.error('[BackupService] Error saat backup:', error);
      try {
        await SystemLog.create({
          level: 'ERROR',
          source: 'BackupService',
          message: 'Gagal menjalankan backup otomatis',
          details: { error: error.message }
        });
      } catch (_) {}
    }
  }

  async doBackup() {
    const data = {
      users: await User.find({}).select('+password').lean(),
      items: await Item.find({}).lean(),
      service_tickets: await ServiceTicket.find({}).lean(),
      transactions: await Transaction.find({}).lean(),
      special_orders: await SpecialOrder.find({}).lean(),
      system_logs: await SystemLog.find({}).lean(),
      exported_at: new Date(),
      version: '1.0.0'
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup_${timestamp}.json.gz`;
    const filePath = path.join(this.backupDir, filename);

    const jsonStr = JSON.stringify(data);
    const compressed = await gzip(jsonStr);
    fs.writeFileSync(filePath, compressed);

    const metaFile = path.join(this.backupDir, 'last-backup.json');
    fs.writeFileSync(metaFile, JSON.stringify({
      last_backup_at: new Date(),
      filename: filename
    }));

    console.log(`[BackupService] Backup berhasil: ${filename} (${this.formatSize(compressed.length)})`);
    await SystemLog.create({
      level: 'INFO',
      source: 'BackupService',
      message: `Backup berhasil: ${filename}`,
      details: {
        filename,
        size: compressed.length,
        stats: {
          users: data.users.length,
          items: data.items.length,
          service_tickets: data.service_tickets.length,
          transactions: data.transactions.length,
          special_orders: data.special_orders.length,
          system_logs: data.system_logs.length
        }
      }
    });
  }

  async cleanupOld() {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.json.gz'))
      .map(f => ({
        name: f,
        path: path.join(this.backupDir, f),
        mtime: fs.statSync(path.join(this.backupDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.RETENTION_DAYS);

    let deleted = 0;
    for (let i = 0; i < files.length; i++) {
      if (files.length === 1) {
        console.log('[BackupService] Safety net: hanya 1 file backup, tidak dihapus.');
        break;
      }
      if (files[i].mtime < cutoff) {
        fs.unlinkSync(files[i].path);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`[BackupService] ${deleted} file backup lama dihapus.`);
    }
  }

  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];

    return fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.json.gz'))
      .map(f => {
        const filePath = path.join(this.backupDir, f);
        const stat = fs.statSync(filePath);
        return {
          filename: f,
          size: stat.size,
          size_formatted: this.formatSize(stat.size),
          created_at: stat.mtime
        };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async restoreFromFile(filename, preservedUserId = null) {
    const sanitized = path.basename(filename);
    const filePath = path.join(this.backupDir, sanitized);

    if (!fs.existsSync(filePath)) {
      throw new Error('File backup tidak ditemukan');
    }

    const compressed = fs.readFileSync(filePath);
    const jsonStr = await gunzip(compressed);
    const data = JSON.parse(jsonStr);

    if (!data.users || !data.items) {
      throw new Error('Format file backup tidak valid');
    }

    let adminDoc = null;
    let adminId = null;
    if (preservedUserId) {
      const currentAdmin = await User.findById(preservedUserId).select('+password').lean();
      if (currentAdmin) {
        adminDoc = { ...currentAdmin };
        adminId = currentAdmin._id;
        delete adminDoc._id;
      }
    }

    await Promise.all([
      User.deleteMany({}),
      Item.deleteMany({}),
      ServiceTicket.deleteMany({}),
      Transaction.deleteMany({}),
      SpecialOrder.deleteMany({}),
      SystemLog.deleteMany({})
    ]);

    const insertOps = [];
    if (data.users?.length > 0) {
      const filteredUsers = adminDoc
        ? data.users.filter(u => String(u._id) !== String(adminId))
        : data.users;
      if (filteredUsers.length > 0) {
        insertOps.push(User.collection.insertMany(filteredUsers));
      }
    }
    if (data.items?.length > 0) insertOps.push(Item.collection.insertMany(data.items));
    if (data.service_tickets?.length > 0) insertOps.push(ServiceTicket.collection.insertMany(data.service_tickets));
    if (data.transactions?.length > 0) insertOps.push(Transaction.collection.insertMany(data.transactions));
    if (data.special_orders?.length > 0) insertOps.push(SpecialOrder.collection.insertMany(data.special_orders));
    if (data.system_logs?.length > 0) insertOps.push(SystemLog.collection.insertMany(data.system_logs));

    await Promise.all(insertOps);

    if (adminDoc) {
      const adminExists = await User.collection.findOne({ _id: adminId });
      if (!adminExists) {
        await User.collection.insertOne({ ...adminDoc, _id: adminId });
      }
    }

    await SystemLog.create({
      level: 'INFO',
      source: 'BackupService',
      message: `Restore dari file ${sanitized} berhasil`,
      details: { filename: sanitized }
    });
  }

  async getBackupFileStream(filename) {
    const sanitized = path.basename(filename);
    const filePath = path.join(this.backupDir, sanitized);
    if (!fs.existsSync(filePath)) return null;
    return fs.createReadStream(filePath);
  }

  getBackupFilePath(filename) {
    const sanitized = path.basename(filename);
    const filePath = path.join(this.backupDir, sanitized);
    if (!fs.existsSync(filePath)) return null;
    return filePath;
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

module.exports = new BackupService();
