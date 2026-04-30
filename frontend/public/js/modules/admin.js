import api, { showToast } from '../api.js';

class Admin {
    constructor() {
        this.technicians = [];
        this.activeTab = 'users'; // 'users' or 'backup'
    }

    async render() {
        window.adminModule = this;
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="card shadow-sm border-0">
                <div class="card-header bg-white p-0">
                    <ul class="nav nav-tabs border-0" id="adminTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link px-4 py-3 fw-bold active" id="users-tab" data-bs-toggle="tab" data-bs-target="#users-panel" type="button" role="tab">
                                <i class="bi bi-people me-2"></i>Manajemen Pengguna
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link px-4 py-3 fw-bold text-secondary" id="backup-tab" data-bs-toggle="tab" data-bs-target="#backup-panel" type="button" role="tab">
                                <i class="bi bi-database-fill-gear me-2"></i>Backup & Restore Data
                            </button>
                        </li>
                    </ul>
                </div>
                <div class="card-body p-4">
                    <div class="tab-content" id="adminTabsContent">
                        <!-- TAB 1: MANAJEMEN PENGGUNA -->
                        <div class="tab-pane fade show active" id="users-panel" role="tabpanel">
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
                                                <div class="d-grid">
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
                                                    <th class="text-end pe-3">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody id="tech-list-content">
                                                <tr><td colspan="4" class="text-center py-4">Memuat data...</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB 2: BACKUP & RESTORE -->
                        <div class="tab-pane fade" id="backup-panel" role="tabpanel">
                            <div class="row justify-content-center py-4">
                                <div class="col-md-6">
                                    <div class="card border-0 shadow-sm bg-light">
                                        <div class="card-body p-4 text-center">
                                            <div class="mb-4">
                                                <i class="bi bi-cloud-download text-primary" style="font-size: 4rem;"></i>
                                                <h5 class="fw-bold mt-3">Ekspor Data (Backup)</h5>
                                                <p class="text-muted">Unduh seluruh data database ke dalam file JSON untuk cadangan.</p>
                                                <button class="btn btn-primary px-4 fw-bold" id="export-btn">
                                                    <i class="bi bi-download me-2"></i>Export Data Sekarang
                                                </button>
                                            </div>
                                            <hr class="my-5">
                                            <div class="mb-2">
                                                <i class="bi bi-cloud-upload text-danger" style="font-size: 4rem;"></i>
                                                <h5 class="fw-bold mt-3">Impor Data (Restore)</h5>
                                                <p class="text-muted">Pulihkan database dari file backup sebelumnya.</p>
                                                <div class="alert alert-warning small border-warning">
                                                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                                    <strong>PENTING:</strong> Melakukan import akan menimpa seluruh data saat ini.
                                                </div>
                                                <div class="input-group mb-3">
                                                    <input type="file" class="form-control" id="import-file" accept=".json">
                                                    <button class="btn btn-danger fw-bold" type="button" id="import-btn">
                                                        <i class="bi bi-upload me-2"></i>Import Data
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Edit Tech Modal -->
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
                                <div class="alert alert-info py-2 small mb-0">
                                    <i class="bi bi-info-circle me-1"></i> Username dan Password tidak dapat diubah demi keamanan.
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
    }

    async loadTechnicians() {
        const tbody = document.getElementById('tech-list-content');
        if (!tbody) return;

        try {
            const res = await api.get('/admin/technicians');
            this.technicians = res.data;
            
            if (this.technicians.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Belum ada akun terdaftar.</td></tr>';
                return;
            }

            tbody.innerHTML = this.technicians.map(t => `
                <tr>
                    <td class="ps-3 fw-bold">${t.name}</td>
                    <td><span class="badge bg-light text-dark border">${t.username}</span></td>
                    <td>
                        <a href="https://wa.me/${t.phone.replace(/\D/g, '')}" target="_blank" class="text-decoration-none text-success small">
                            <i class="bi bi-whatsapp me-1"></i>${t.phone}
                        </a>
                    </td>
                    <td class="text-end pe-3">
                        <button class="btn btn-sm btn-outline-warning border-0" onclick="adminModule.openEdit('${t._id}')" title="Edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="adminModule.deleteTech('${t._id}')" title="Hapus"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger">${e.message}</td></tr>`;
        }
    }

    async deleteTech(id) {
        if (!confirm('Hapus akun ini permanen?')) return;
        try {
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
        new bootstrap.Modal(document.getElementById('editTechModal')).show();
    }

    async handleExport() {
        try {
            showToast('Menyiapkan backup data...', 'info');
            const res = await api.get('/admin/backup/export');
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            downloadAnchorNode.setAttribute("href",     dataStr);
            downloadAnchorNode.setAttribute("download", `backup_utc_${timestamp}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
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

        // Peringatan Keamanan
        const confirmed = confirm("⚠️ PERINGATAN KERAS!\n\nMelakukan import akan MENGHAPUS SEMUA DATA saat ini dan menimpanya dengan data dari file backup.\n\nApakah Anda yakin ingin melanjutkan?");
        
        if (!confirmed) return;

        const finalConfirm = confirm("Konfirmasi Terakhir: Anda benar-benar yakin? Proses ini tidak dapat dibatalkan.");
        if (!finalConfirm) return;

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

    setupEventListeners() {
        // User form listener
        const techForm = document.getElementById('tech-form');
        if (techForm) {
            techForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = {
                    name: document.getElementById('tech-name').value,
                    username: document.getElementById('tech-username').value,
                    phone: document.getElementById('tech-phone').value,
                    password: document.getElementById('tech-password').value
                };
                try {
                    await api.post('/admin/technicians', data);
                    showToast('Akun Baru Berhasil Terdaftar');
                    e.target.reset();
                    this.loadTechnicians();
                } catch (e) { showToast(e.message, 'error'); }
            });
        }

        // Edit user button
        const saveEditBtn = document.getElementById('save-edit-tech-btn');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', async () => {
                const id = document.getElementById('edit-tech-id').value;
                const data = {
                    name: document.getElementById('edit-tech-name').value,
                    phone: document.getElementById('edit-tech-phone').value
                };
                try {
                    await api.put(`/admin/technicians/${id}`, data);
                    showToast('Data diperbarui');
                    bootstrap.Modal.getInstance(document.getElementById('editTechModal')).hide();
                    this.loadTechnicians();
                } catch (e) { showToast(e.message, 'error'); }
            });
        }

        const refreshBtn = document.getElementById('refresh-tech-btn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.loadTechnicians());

        // Backup & Export listeners
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.handleExport());

        const importBtn = document.getElementById('import-btn');
        if (importBtn) importBtn.addEventListener('click', () => this.handleImport());

        // Change Tab Text Color on switch
        const tabs = document.querySelectorAll('#adminTabs button');
        tabs.forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                tabs.forEach(t => t.classList.add('text-secondary'));
                e.target.classList.remove('text-secondary');
            });
        });
    }
}

export default Admin;
