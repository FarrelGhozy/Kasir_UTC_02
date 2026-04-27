import api, { showToast } from '../api.js';

class Admin {
    constructor() {
        this.technicians = [];
    }

    async render() {
        window.adminModule = this;
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4">
                <div class="col-lg-4">
                    <div class="card shadow-sm border-0 sticky-top" style="top: 20px;">
                        <div class="card-header bg-primary text-white py-3">
                            <h5 class="mb-0"><i class="bi bi-person-plus me-2"></i>Tambah Teknisi Baru</h5>
                        </div>
                        <div class="card-body">
                            <form id="tech-form">
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nama Lengkap</label>
                                    <input type="text" class="form-control" id="tech-name" required placeholder="Nama Teknisi">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Username</label>
                                    <input type="text" class="form-control" id="tech-username" required placeholder="Contoh: teknisi_johan">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nomor WhatsApp</label>
                                    <input type="tel" class="form-control" id="tech-phone" required placeholder="08xxxxxxxx">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Password Default</label>
                                    <input type="password" class="form-control" id="tech-password" required placeholder="Min. 6 Karakter">
                                </div>
                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary fw-bold">
                                        <i class="bi bi-person-check me-2"></i>Daftarkan Teknisi
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="col-lg-8">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 fw-bold text-primary"><i class="bi bi-people me-2"></i>Daftar Teknisi Aktif</h5>
                            <button class="btn btn-sm btn-outline-primary" id="refresh-tech-btn">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
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
            </div>

            <!-- Edit Tech Modal -->
            <div class="modal fade" id="editTechModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Data Teknisi</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-tech-form">
                                <input type="hidden" id="edit-tech-id">
                                <div class="mb-3">
                                    <label class="form-label">Nama</label>
                                    <input type="text" class="form-control" id="edit-tech-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">No. WhatsApp</label>
                                    <input type="tel" class="form-control" id="edit-tech-phone" required>
                                </div>
                                <p class="text-muted small"><i class="bi bi-info-circle me-1"></i>Username dan Password tidak dapat diubah dari sini demi keamanan.</p>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" id="save-edit-tech-btn">Simpan Perubahan</button>
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
        try {
            const res = await api.get('/admin/technicians');
            this.technicians = res.data;
            
            if (this.technicians.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Belum ada teknisi terdaftar.</td></tr>';
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
                        <button class="btn btn-sm btn-outline-warning border-0" onclick="adminModule.openEdit('${t._id}')"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger border-0" onclick="adminModule.deleteTech('${t._id}')"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger">${e.message}</td></tr>`;
        }
    }

    async deleteTech(id) {
        if (!confirm('Hapus akun teknisi ini permanen?')) return;
        try {
            await api.delete(`/admin/technicians/${id}`);
            showToast('Teknisi berhasil dihapus');
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

    setupEventListeners() {
        document.getElementById('tech-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('tech-name').value,
                username: document.getElementById('tech-username').value,
                phone: document.getElementById('tech-phone').value,
                password: document.getElementById('tech-password').value
            };
            try {
                await api.post('/admin/technicians', data);
                showToast('Teknisi Baru Berhasil Terdaftar');
                e.target.reset();
                this.loadTechnicians();
            } catch (e) { showToast(e.message, 'error'); }
        });

        document.getElementById('save-edit-tech-btn').addEventListener('click', async () => {
            const id = document.getElementById('edit-tech-id').value;
            const data = {
                name: document.getElementById('edit-tech-name').value,
                phone: document.getElementById('edit-tech-phone').value
            };
            try {
                await api.put(`/admin/technicians/${id}`, data);
                showToast('Data teknisi diperbarui');
                bootstrap.Modal.getInstance(document.getElementById('editTechModal')).hide();
                this.loadTechnicians();
            } catch (e) { showToast(e.message, 'error'); }
        });

        document.getElementById('refresh-tech-btn').addEventListener('click', () => this.loadTechnicians());
    }
}

export default Admin;
