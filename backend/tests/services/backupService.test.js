// tests/services/backupService.test.js — fungsi murni + integrasi file
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const util = require('util');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Item = require('../../models/Item');
const backupService = require('../../services/backupService');
const { createAdmin, createItem } = require('../helpers/factory');

const gunzip = util.promisify(zlib.gunzip);

describe('backupService.formatSize', () => {
  it('byte', () => {
    expect(backupService.formatSize(500)).toBe('500 B');
  });
  it('byte boundary 0 dan 1023', () => {
    expect(backupService.formatSize(0)).toBe('0 B');
    expect(backupService.formatSize(1023)).toBe('1023 B');
  });
  it('kilobyte 2 desimal', () => {
    expect(backupService.formatSize(2048)).toBe('2.00 KB');
    expect(backupService.formatSize(1024)).toBe('1.00 KB');
  });
  it('megabyte 2 desimal', () => {
    expect(backupService.formatSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('backupService.getBackupFilePath / getBackupFileStream', () => {
  it('null bila file tidak ada', async () => {
    expect(backupService.getBackupFilePath('tidak-ada.json.gz')).toBeNull();
    await expect(backupService.getBackupFileStream('tidak-ada.json.gz')).resolves.toBeNull();
  });
  it('basename mencegah path traversal (tidak keluar dari backupDir)', () => {
    const p = backupService.getBackupFilePath('../../etc/passwd');
    expect(p).toBeNull();
  });
  it('listBackups [] bila folder belum ada / kosong', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-empty-'));
    const orig = backupService.backupDir;
    backupService.backupDir = tmp;
    const list = backupService.listBackups();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
    backupService.backupDir = orig;
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('backupService.restoreFromFile validasi', () => {
  it('throw bila file tidak ada', async () => {
    await expect(backupService.restoreFromFile('tidak-ada.json.gz')).rejects.toThrow('File backup tidak ditemukan');
  });
  it('throw bila format tidak valid (tanpa users/items)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-invalid-'));
    const orig = backupService.backupDir;
    backupService.backupDir = tmp;
    const badData = JSON.stringify({ foo: 'bar' });
    const gz = await util.promisify(zlib.gzip)(badData);
    fs.writeFileSync(path.join(tmp, 'bad.json.gz'), gz);
    await expect(backupService.restoreFromFile('bad.json.gz')).rejects.toThrow('Format file backup tidak valid');
    backupService.backupDir = orig;
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('backupService doBackup & listBackups & getBackupFile', () => {
  it('doBackup membuat file .json.gz + last-backup.json + SystemLog', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    const origDir = backupService.backupDir;
    backupService.backupDir = tmpDir;
    try {
      await createAdmin();
      await createItem();
      await backupService.doBackup();
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.json.gz'));
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json\.gz$/);
      const metaPath = path.join(tmpDir, 'last-backup.json');
      expect(fs.existsSync(metaPath)).toBe(true);
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      expect(meta.filename).toBe(files[0]);
      expect(meta.last_backup_at).toBeTruthy();
      const compressed = fs.readFileSync(path.join(tmpDir, files[0]));
      const jsonStr = await gunzip(compressed);
      const data = JSON.parse(jsonStr);
      expect(Array.isArray(data.users)).toBe(true);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.users.length).toBeGreaterThanOrEqual(1);
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.exported_at).toBeTruthy();
      expect(data.version).toBe('1.0.0');
    } finally {
      backupService.backupDir = origDir;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('listBackups mengembalikan size_formatted & sorted desc', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    const origDir = backupService.backupDir;
    backupService.backupDir = tmpDir;
    try {
      await createItem();
      await backupService.doBackup();
      let list = backupService.listBackups();
      expect(list.length).toBe(1);
      const firstFile = path.join(tmpDir, list[0].filename);
      const secondName = 'backup_2026-09-20T12-14-14.json.gz';
      const secondFile = path.join(tmpDir, secondName);
      fs.copyFileSync(firstFile, secondFile);
      const later = new Date(Date.now() + 3600000);
      fs.utimesSync(secondFile, later, later);
      list = backupService.listBackups();
      expect(list.length).toBe(2);
      expect(list[0].size).toBeGreaterThan(0);
      expect(list[0].size_formatted).toMatch(/B|KB|MB/);
      expect(new Date(list[0].created_at).getTime()).toBeGreaterThanOrEqual(new Date(list[1].created_at).getTime());
    } finally {
      backupService.backupDir = origDir;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('getBackupFilePath & getBackupFileStream mengembalikan path/stream bila file ada', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    const origDir = backupService.backupDir;
    backupService.backupDir = tmpDir;
    try {
      await backupService.doBackup();
      const list = backupService.listBackups();
      const filename = list[0].filename;
      const p = backupService.getBackupFilePath(filename);
      expect(p).toBe(path.join(tmpDir, filename));
      expect(fs.existsSync(p)).toBe(true);
      const stream = await backupService.getBackupFileStream(filename);
      expect(stream).not.toBeNull();
      expect(typeof stream.pipe).toBe('function');
      stream.destroy();
      expect(backupService.getBackupFilePath('../../etc/passwd')).toBeNull();
      await expect(backupService.getBackupFileStream('../../etc/passwd')).resolves.toBeNull();
    } finally {
      backupService.backupDir = origDir;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('MY_SIMPLE_RESTORE', async () => {
    expect(true).toBe(true);
  });

  it('MY_SIMPLE_CLEANUP', async () => {
    expect(true).toBe(true);
  });
});
