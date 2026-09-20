// tests/utils/notaStorage.test.js — saveNota sanitasi nama file
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('notaStorage.saveNota', () => {
  let tmpDir;
  let saveNota;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nota-test-'));
    jest.doMock('fs', () => {
      const actual = jest.requireActual('fs');
      return { ...actual, promises: actual.promises };
    });
    saveNota = require('../../utils/notaStorage').saveNota;
  });

  afterEach(async () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('menyimpan buffer dan mengembalikan filename/url terstruktur', async () => {
    const { filename, filePath, fileUrl } = await saveNota(Buffer.from('%PDF-test'), 'SVC', 'SRV-2026-0001', 'Budi Santoso', { kind: 'ENTRY', isPaid: false });
    expect(filename).toMatch(/^NOTA-SVC-SRV-2026-0001-ENTRY-ENTRY_Budi_Santoso_\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{12}\.pdf$/);
    expect(fileUrl).toBe(`/uploads/notas/${filename}`);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath);
    expect(content.toString()).toBe('%PDF-test');
  });

  it('PAYMENT + lunas memakai tag LUNAS', async () => {
    const { filename } = await saveNota(Buffer.from('x'), 'ORD', 'ORD-2026-0002', 'Siti', { kind: 'PAYMENT', paymentStatus: 'Lunas' });
    expect(filename).toContain('-PAYMENT-LUNAS_');
  });

  it('PAYMENT belum lunas memakai tag BELUM', async () => {
    const { filename } = await saveNota(Buffer.from('x'), 'SVC', 'SRV-1', 'A', {});
    expect(filename).toContain('-PAYMENT-BELUM_');
  });

  it('nama pelanggan disanitasi (tanpa karakter berbahaya/path)', async () => {
    const { filename } = await saveNota(Buffer.from('x'), 'SVC', 'SRV-1', '../../etc/passwd', {});
    expect(filename).not.toContain('/');
    expect(filename).not.toContain('..');
  });

  it('nama file unik tiap panggilan (sufiks acak)', async () => {
    const a = await saveNota(Buffer.from('x'), 'SVC', 'SRV-1', 'A', {});
    const b = await saveNota(Buffer.from('x'), 'SVC', 'SRV-1', 'A', {});
    expect(a.filename).not.toBe(b.filename);
  });
});
