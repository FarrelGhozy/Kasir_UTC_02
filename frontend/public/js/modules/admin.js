import api, { showToast, escapeHTML, confirmDialog } from '../api.js';
import Reports from './reports.js';

class Admin {
    constructor() {
        this.technicians = [];
        this.reportsModule = new Reports();
        this.scheduleMap = {};
    }

    async render() {
        window.adminModule = this;
        const content = document.getElementById('app-content');

        content.innerHTML = `
            <div class="card shadow-sm border-0">
                <div class="card-header bg-white border-0 pt-3 pb-0 px-3 px-md-4">
                    <div class="btn-group w-100 shadow-sm" role="group" aria-label="Pilih menu admin">
                        <button class="btn btn-outline-primary fw-bold py-2 active" id="reports-tab" data-page="reports">
                            <i class="bi bi-graph-up me-2"></i>Laporan & Analitik
                        </button>
                        <button class="btn btn-outline-primary fw-bold py-2" id="users-tab" data-page="users">
                            <i class="bi bi-people me-2"></i>Manajemen Pengguna
                        </button>
                        <button class="btn btn-outline-primary fw-bold py-2" id="backup-tab" data-page="backup">
                            <i class="bi bi-database-fill-gear me-2"></i>Backup & Restore
                        </button>
                    </div>
                </div>
                <div class="card-body p-3 p-md-4">
                    <div id="admin-panels">
                        <div id="reports-panel"></div>

                        <div id="users-panel" class="d-none">
                            <div class="row g-4">
                                <div class="col-lg-4">
                                    <div class="card border border-light-subtle bg-light bg-opacity-50">
                                        <div class="card-body">
                                            <h6 class="fw-bold mb-3 text-primary"><i class="bi bi-person-plus me-2"></i>Tambah Pengguna Baru</h6>
                                            <form id="tech-form">
                                                <div class="mb-3">
                                                    <label class="form-label small fw-bold">Nama Lengkap</label>
                                                    <input type="text" class="form-control form-control-sm" id="tech-name" required placeholder="Nama Lengkap">
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label small fw-bold">Username</label>
                                                    <input type="text" class="form-control form-control-sm" id="tech-username" required placeholder="username">
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label small fw-bold">Nomor WhatsApp</label>
                                                    <input type="tel" class="form-control form-control-sm" id="tech-phone" required placeholder="08xxxxxxxx">
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label small fw-bold">Password</label>
                                                    <input type="password" class="form-control form-control-sm" id="tech-password" required placeholder="Min. 6 Karakter">
                                                </div>
                                                <div class="mb-3">
                                                    <label class="form-label small fw-bold">Jabatan</label>
                                                    <select class="form-select form-select-sm" id="tech-jabatan">
                                                        <option value="">-- Pilih Jabatan --</option>
                                                        <option value="Equipment">Equipment</option>
                                                        <option value="Admin">Admin</option>
                                                        <option value="Chief">Chief</option>
                                                        <option value="Secretary">Secretary</option>
                                                        <option value="PDD">PDD</option>
                                                    </select>
                                                </div>
                                                <div class="mt-3 pt-3 border-top">
                                                    <h6 class="fw-bold mb-3 text-success small"><i class="bi bi-calendar-check me-2"></i>Jadwal Piket (Opsional)</h6>
                                                    <div class="mb-2">
                                                        <label class="form-label small fw-bold">Hari Piket</label>
                                                        <div class="d-flex flex-wrap gap-2">
                                                            <div class="form-check form-check-inline">
                                                                <input class="form-check-input" type="checkbox" value="senin" id="duty-senin">
                                                                <label class="form-check-label small" for="duty-senin">Senin</label>
                                                            </div>
                                                            <div class="form-check form-check-inline">
                                                                <input class="form-check-input" type="checkbox" value="selasa" id="duty-selasa">
                                                                <label class="form-check-label small" for="duty-selasa">Selasa</label>
                                                            </div>
                                                            <div class="form-check form-check-inline">
                                                                <input class="form-check-input" type="checkbox" value="rabu" id="duty-rabu">
                                                                <label class="form-check-label small" for="duty-rabu">Rabu</label>
                                                            </div>
                                                            <div class="form-check form-check-inline">
                                                                <input class="form-check-input" type="checkbox" value="kamis" id="duty-kamis">
                                                                <label class="form-check-label small" for="duty-kamis">Kamis</label>
                                                            </div>
                                                            <div class="form-check form-check-inline">
                                                                <input class="form-check-input" type="checkbox" value="jumat" id="duty-jumat">
                                                                <label class="form-check-label small" for="duty-jumat">Jumat</label>
                                                            </div>
                                                        </div>
                                                        <small class="text-muted">Pilih hari untuk jadwal piket (21:30 WIB)</small>
                                                    </div>
                                                </div>
                                                <div class="d-grid mt-3">
                                                    <button type="submit" class="btn btn-primary btn-sm fw-bold">
                                                        <i class="bi bi-person-check me-2"></i>Daftarkan Akun
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-lg-8">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <h6 class="fw-bold mb-0 text-secondary"><i class="bi bi-list-ul me-2"></i>Daftar Pengguna Sistem</h6>
                                        <button class="btn btn-sm btn-outline-primary" id="refresh-tech-btn">
                                            <i class="bi bi-arrow-clockwise"></i>
                                        </button>
                                    </div>
                                    <div class="table-responsive border rounded bg-white">
                                        <table class="table table-hover align-middle mb-0">
                                            <thead class="table-light">
                                                <tr>
                                                    <th class="ps-3">Nama</th>
                                                    <th>Username</th>
                                                    <th>WhatsApp</th>
                                                    <th>Jabatan</th>
                                                    <th>Jadwal Piket</th>
                                                    <th class="text-end pe-3">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody id="tech-list-content">
                                                <tr><td colspan="6" class="text-center py-4">Memuat data...</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="backup-panel" class="d-none">
                            <div class="row justify-content-center py-2 py-md-4">
                                <div class="col-md-10">
                                    <div class="row g-3 mb-4">
                                        <div class="col-sm-6">
                                            <div class="card border-0 shadow-sm bg-light h-100">
                                                <div class="card-body p-3 p-md-4 text-center">
                                                    <i class="bi bi-cloud-upload text-primary backup-icon" style="font-size: 2.5rem; font-size: clamp(2rem, 5vw, 4rem);"></i>
                                                    <h5 class="fw-bold mt-2 mt-md-3">Ekspor Data (Backup)</h5>
                                                    <p class="text-muted small">Unduh seluruh data database ke dalam file JSON untuk cadangan.</p>
                                                    <button class="btn btn-primary px-4 fw-bold btn-sm btn-md-normal" id="export-btn">
                                                        <i class="bi bi-download me-2"></i>Export Data Sekarang
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="col-sm-6">
                                            <div class="card border-0 shadow-sm bg-light h-100">
                                                <div class="card-body p-3 p-md-4 text-center d-flex flex-column">
                                                    <i class="bi bi-cloud-download text-danger backup-icon" style="font-size: 2.5rem; font-size: clamp(2rem, 5vw, 4rem);"></i>
                                                    <h5 class="fw-bold mt-2 mt-md-3">Impor Data (Restore)</h5>
                                                    <p class="text-muted small">Pulihkan database dari file backup sebelumnya.</p>
                                                    <div class="alert alert-warning small border-warning py-2 mb-3">
                                                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                                        <strong>PENTING:</strong> Import akan menimpa seluruh data saat ini.
                                                    </div>
                                                    <div class="input-group input-group-sm mb-2 mt-auto">
                                                        <input type="file" class="form-control" id="import-file" accept=".json">
                                                        <button class="btn btn-danger fw-bold" type="button" id="import-btn">
                                                            <i class="bi bi-upload me-2"></i>Import
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <hr class="my-4">

                                    <h6 class="fw-bold mb-2">
                                        <i class="bi bi-archive me-2"></i>Backup Tersimpan di Server
                                        <small class="text-muted fw-normal">(otomatis setiap tengah malam)</small>
                                    </h6>
                                    <p class="text-muted small mb-3">
                                        <i class="bi bi-info-circle me-1"></i>
                                        File backup disimpan di server selama 30 hari.
                                        Klik <i class="bi bi-download"></i> untuk mengunduh atau
                                        <i class="bi bi-arrow-counterclockwise"></i> untuk memulihkan data.
                                    </p>
                                    <div class="table-responsive border rounded bg-white">
                                        <table class="table table-hover align-middle mb-0">
                                            <thead class="table-light">
                                                <tr>
                                                    <th class="ps-3" style="width:50px">#</th>
                                                    <th>Nama File</th>
                                                    <th style="width:90px">Ukuran</th>
                                                    <th style="width:160px">Tanggal Backup</th>
                                                    <th class="text-end pe-3" style="width:100px">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody id="backup-files-content">
                                                <tr><td colspan="5" class="text-center py-4">Memuat daftar backup...</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="editTechModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">Edit Data Pengguna</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-tech-form">
                                <input type="hidden" id="edit-tech-id">
                                <div class="mb-3">
                                    <label class="form-label fw-bold small">Nama Lengkap</label>
                                    <input type="text" class="form-control" id="edit-tech-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold small">No. WhatsApp</label>
                                    <input type="tel" class="form-control" id="edit-tech-phone" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold small">Jabatan</label>
                                    <select class="form-select form-select-sm" id="edit-tech-jabatan">
                                        <option value="">-- Pilih Jabatan --</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Chief">Chief</option>
                                        <option value="Secretary">Secretary</option>
                                        <option value="PDD">PDD</option>
                                    </select>
                                </div>
                                <div class="alert alert-info py-2 small mb-0">
                                    <i class="bi bi-info-circle me-1"></i> Username dan Password tidak dapat diubah demi keamanan.
                                </div>
                                <div class="mt-4 pt-3 border-top">
                                    <h6 class="fw-bold mb-3 text-success small"><i class="bi bi-calendar-check me-2"></i>Jadwal Piket</h6>
                                    <div class="mb-2">
                                        <label class="form-label small fw-bold">Hari Piket</label>
                                        <div class="d-flex flex-wrap gap-2">
                                            <div class="form-check form-check-inline">
                                                <input class="form-check-input" type="checkbox" value="senin" id="edit-duty-senin">
                                                <label class="form-check-label small" for="edit-duty-senin">Senin</label>
                                            </div>
                                            <div class="form-check form-check-inline">
                                                <input class="form-check-input" type="checkbox" value="selasa" id="edit-duty-selasa">
                                                <label class="form-check-label small" for="edit-duty-selasa">Selasa</label>
                                            </div>
                                            <div class="form-check form-check-inline">
                                                <input class="form-check-input" type="checkbox" value="rabu" id="edit-duty-rabu">
                                                <label class="form-check-label small" for="edit-duty-rabu">Rabu</label>
                                            </div>
                                            <div class="form-check form-check-inline">
                                                <input class="form-check-input" type="checkbox" value="kamis" id="edit-duty-kamis">
                                                <label class="form-check-label small" for="edit-duty-kamis">Kamis</label>
                                            </div>
                                            <div class="form-check form-check-inline">
                                                <input class="form-check-input" type="checkbox" value="jumat" id="edit-duty-jumat">
                                                <label class="form-check-label small" for="edit-duty-jumat">Jumat</label>
                                            </div>
                                        </div>
                                        <small class="text-muted">Piket dilaksanakan jam 21:30 WIB</small>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary fw-bold" id="save-edit-tech-btn">Simpan Perubahan</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadTechnicians();
        this.setupEventListeners();
        this.reportsModule.render('reports-panel');
    }

    async loadTechnicians() {
        const tbody = document.getElementById('tech-list-content');
        if (!tbody) return;

        try {
            const [usersRes] = await Promise.all([
                api.get('/admin/technicians'),
                this._loadSchedules()
            ]);
            this.technicians = usersRes.data;

            if (this.technicians.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Belum ada akun terdaftar.</td></tr>';
                return;
            }

            tbody.innerHTML = this.technicians.map(t => `
                <tr>
                    <td class="ps-3 fw-bold">${escapeHTML(t.name)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHTML(t.username)}</span></td>
                    <td>
                        <a href="https://wa.me/${t.phone.replace(/\D/g, '')}" target="_blank" class="text-decoration-none text-success small">
                            <i class="bi bi-whatsapp me-1"></i>${escapeHTML(t.phone)}
                        </a>
                    </td>
                    <td>${t.jabatan ? `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">${escapeHTML(t.jabatan)}</span>` : '<span class="text-muted">—</span>'}</td>
                    <td>${this._getPiketDisplay(t._id)}</td>
                    <td class="text-end pe-3">
                        <button class="btn btn-sm btn-outline-warning border-0" onclick="adminModule.openEdit('${t._id}')" title="Edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="adminModule.deleteTech('${t._id}')" title="Hapus"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">${escapeHTML(e.message)}</td></tr>`;
        }
    }

    async _loadSchedules() {
        try {
            const res = await api.get('/duty-schedules');
            const schedules = res.data || [];
            this.scheduleMap = {};
            for (const s of schedules) {
                const uid = s.user?._id || s.user;
                if (!uid) continue;
                if (!this.scheduleMap[uid]) this.scheduleMap[uid] = [];
                this.scheduleMap[uid].push(s);
            }
        } catch (e) {
            this.scheduleMap = {};
        }
    }

    _getPiketDisplay(userId) {
        const entries = this.scheduleMap[userId];
        if (!entries || entries.length === 0) {
            return '<span class="text-muted">—</span>';
        }
        const dayLabels = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat' };
        const days = entries.map(e => dayLabels[e.day] || e.day).join(', ');
        return `<small class="text-muted">${escapeHTML(days)}</small>`;
    }

    _getCheckedDays(prefix) {
        const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
        return days.filter(day => {
            const el = document.getElementById(`${prefix}-${day}`);
            return el && el.checked;
        });
    }

    _setCheckedDays(prefix, days) {
        ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach(day => {
            const el = document.getElementById(`${prefix}-${day}`);
            if (el) el.checked = days.includes(day);
        });
    }

    async _saveDutySchedules(userId, days) {
        for (const day of days) {
            try {
                await api.post('/duty-schedules', { user: userId, day });
            } catch (e) {
                console.error(`Gagal simpan jadwal ${day} untuk ${userId}:`, e);
            }
        }
    }

    async _removeUserDutySchedules(userId) {
        const entries = this.scheduleMap[userId] || [];
        for (const s of entries) {
            try {
                await api.delete(`/duty-schedules/${s._id}`);
            } catch (e) {
                console.error(`Gagal hapus jadwal ${s._id}:`, e);
            }
        }
    }

    async deleteTech(id) {
        if (!await confirmDialog('Hapus akun ini secara permanen? Data tidak bisa dikembalikan.', 'Hapus Pengguna', 'Ya, Hapus')) return;
        try {
            await this._removeUserDutySchedules(id);
            await api.delete(`/admin/technicians/${id}`);
            showToast('Akun berhasil dihapus');
            this.loadTechnicians();
        } catch (e) { showToast(e.message, 'error'); }
    }

    openEdit(id) {
        const t = this.technicians.find(x => x._id === id);
        if (!t) return;
        document.getElementById('edit-tech-id').value = t._id;
        document.getElementById('edit-tech-name').value = t.name;
        document.getElementById('edit-tech-phone').value = t.phone;
        document.getElementById('edit-tech-jabatan').value = t.jabatan || '';

        const entries = this.scheduleMap[id] || [];
        const days = entries.map(e => e.day);
        this._setCheckedDays('edit-duty', days);
        new bootstrap.Modal(document.getElementById('editTechModal')).show();
    }

    async handleExport() {
        try {
            showToast('Menyiapkan backup data...', 'info');
            const res = await api.get('/admin/backup/export');

            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const downloadAnchorNode = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            downloadAnchorNode.setAttribute("href", url);
            downloadAnchorNode.setAttribute("download", `backup_utc_${timestamp}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            showToast('Backup berhasil diunduh', 'success');
        } catch (e) { showToast('Gagal melakukan backup: ' + e.message, 'error'); }
    }

    async handleImport() {
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];

        if (!file) {
            showToast('Silakan pilih file backup (.json) terlebih dahulu', 'warning');
            return;
        }

        if (!await confirmDialog(
            '⚠️ PERINGATAN KERAS!\n\nMelakukan import akan MENGHAPUS SEMUA DATA saat ini dan menimpanya dengan data dari file backup. Proses ini tidak dapat dibatalkan.',
            'Konfirmasi Import Data',
            'Ya, Import'
        )) return;

        try {
            showToast('Sedang memproses import...', 'info');

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    const res = await api.post('/admin/backup/import', { data: jsonData });
                    if (res.success) {
                        alert('Data berhasil dipulihkan! Aplikasi akan dimuat ulang.');
                        window.location.reload();
                    }
                } catch (err) {
                    showToast('File tidak valid: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        } catch (e) { showToast('Gagal melakukan import: ' + e.message, 'error'); }
    }

    async loadBackupFiles() {
        const tbody = document.getElementById('backup-files-content');
        if (!tbody) return;
        try {
            const res = await api.get('/admin/backup/files');
            this.renderBackupFiles(res.data || []);
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Gagal memuat: ${escapeHTML(e.message)}</td></tr>`;
        }
    }

    renderBackupFiles(files) {
        const tbody = document.getElementById('backup-files-content');
        if (!files.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Belum ada file backup tersimpan.</td></tr>';
            return;
        }
        tbody.innerHTML = files.map((f, i) => `
            <tr>
                <td class="ps-3 text-muted">${i + 1}</td>
                <td><small class="fw-medium">${escapeHTML(f.filename)}</small></td>
                <td><span class="badge bg-light text-dark border">${f.size_formatted || '—'}</span></td>
                <td><small class="text-muted">${this._formatDate(f.created_at)}</small></td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-outline-primary border-0" onclick="adminModule.downloadBackup('${escapeHTML(f.filename)}')" title="Download">
                        <i class="bi bi-download"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="adminModule.restoreBackup('${escapeHTML(f.filename)}')" title="Restore">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    _formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    async downloadBackup(filename) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/admin/backup/files/${encodeURIComponent(filename)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Gagal mengunduh file');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            showToast('File berhasil diunduh', 'success');
        } catch (e) {
            showToast('Gagal download: ' + e.message, 'error');
        }
    }

    async restoreBackup(filename) {
        if (!await confirmDialog(
            `Yakin ingin memulihkan data dari file "${filename}"?\n\nSeluruh data saat ini akan DIHAPUS dan diganti dengan data dari file backup. Proses ini tidak dapat dibatalkan.`,
            'Restore Data',
            'Ya, Restore'
        )) return;

        try {
            showToast('Sedang merestore data...', 'info');
            const res = await api.post(`/admin/backup/restore/${encodeURIComponent(filename)}`);
            if (res.success) {
                alert('Data berhasil dipulihkan! Aplikasi akan dimuat ulang.');
                window.location.reload();
            }
        } catch (e) {
            showToast('Gagal restore: ' + e.message, 'error');
        }
    }

    setupEventListeners() {
        const techForm = document.getElementById('tech-form');
        if (techForm) {
            techForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('tech-name').value;
                const username = document.getElementById('tech-username').value;
                const phone = document.getElementById('tech-phone').value;
                const password = document.getElementById('tech-password').value;
                const jabatan = document.getElementById('tech-jabatan').value;
                const days = this._getCheckedDays('duty');

                try {
                    const res = await api.post('/admin/technicians', { name, username, phone, password, jabatan: jabatan || undefined });
                    const newUserId = res.data?._id || res.data?.user?._id;
                    if (newUserId && days.length > 0) {
                        await this._saveDutySchedules(newUserId, days);
                    }
                    showToast('Akun Baru Berhasil Terdaftar');
                    e.target.reset();
                    this.loadTechnicians();
                } catch (e) { showToast(e.message, 'error'); }
            });
        }

        const saveEditBtn = document.getElementById('save-edit-tech-btn');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', async () => {
                const id = document.getElementById('edit-tech-id').value;
                const data = {
                    name: document.getElementById('edit-tech-name').value,
                    phone: document.getElementById('edit-tech-phone').value,
                    jabatan: document.getElementById('edit-tech-jabatan').value || undefined
                };
                const days = this._getCheckedDays('edit-duty');

                try {
                    await api.put(`/admin/technicians/${id}`, data);
                    await this._removeUserDutySchedules(id);
                    if (days.length > 0) {
                        await this._saveDutySchedules(id, days);
                    }
                    showToast('Data diperbarui');
                    bootstrap.Modal.getInstance(document.getElementById('editTechModal')).hide();
                    this.loadTechnicians();
                } catch (e) { showToast(e.message, 'error'); }
            });
        }

        const refreshBtn = document.getElementById('refresh-tech-btn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadTechnicians());

        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.handleExport());

        const importBtn = document.getElementById('import-btn');
        if (importBtn) importBtn.addEventListener('click', () => this.handleImport());

        const toggleBtns = document.querySelectorAll('#users-tab, #backup-tab, #reports-tab');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('users-panel').classList.toggle('d-none', page !== 'users');
                document.getElementById('backup-panel').classList.toggle('d-none', page !== 'backup');
                document.getElementById('reports-panel').classList.toggle('d-none', page !== 'reports');
                if (page === 'reports') {
                    this.reportsModule.render('reports-panel');
                }
                if (page === 'backup') {
                    this.loadBackupFiles();
                }
            });
        });
    }
}

export default Admin;
