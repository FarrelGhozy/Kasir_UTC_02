// tests/services/backupService.test.js — fungsi murni (tanpa DB)
const backupService = require('../../services/backupService');

describe('backupService.formatSize', () => {
  it('byte', () => {
    expect(backupService.formatSize(500)).toBe('500 B');
  });

  it('kilobyte 2 desimal', () => {
    expect(backupService.formatSize(2048)).toBe('2.00 KB');
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
    const list = backupService.listBackups();
    expect(Array.isArray(list)).toBe(true);
  });
});

describe('backupService.restoreFromFile validasi', () => {
  it('throw bila file tidak ada', async () => {
    await expect(backupService.restoreFromFile('tidak-ada.json.gz')).rejects.toThrow('File backup tidak ditemukan');
  });
});
