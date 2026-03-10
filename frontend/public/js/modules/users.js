// public/js/modules/users.js - Modul Manajemen Pengguna (Admin Only)

import api from '../api.js';
import { showToast, formatDate, confirmDialog } from '../api.js';

class Users {
    constructor() {
        this.users = [];
        this.editingUserId = null;
    }

    async render() {
        const content = document.getElementById('app-content');
        content.innerHTML = `
            <div class="fade-in">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h5 class="mb-1 fw-bold">Kelola Pengguna</h5>
                        <small class="text-muted">Tambah, edit, dan kelola akun pengguna sistem</small>
                    </div>
                    <button class="btn btn-primary" id="btn-add-user">
                        <i class="bi bi-person-plus me-2"></i>Tambah Pengguna
                    </button>
                </div>

                <div class="card">
                    <div class="card-body p-0">
                        <div id="users-table-container">
                            <div class="text-center py-5">
                                <div class="spinner-border text-primary" role="status"></div>
                                <p class="mt-3 text-muted">Memuat data pengguna...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Tambah/Edit Pengguna -->
            <div class="modal fade" id="userModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="userModalTitle">
                                <i class="bi bi-person-plus me-2"></i>Tambah Pengguna
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="user-form">
                                <div class="mb-3">
                                    <label class="form-label">Nama Lengkap</label>
                                    <input type="text" class="form-control" id="user-name" placeholder="Masukkan nama lengkap" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Username</label>
                                    <input type="text" class="form-control" id="user-username" placeholder="Masukkan username" required minlength="3">
                                </div>
                                <div class="mb-3" id="password-field">
                                    <label class="form-label">Password</label>
                                    <input type="password" class="form-control" id="user-password" placeholder="Minimal 6 karakter" minlength="6" autocomplete="new-password">
                                    <div class="form-text" id="password-hint"></div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Peran (Role)</label>
                                    <select class="form-select" id="user-role" required>
                                        <option value="">Pilih peran...</option>
                                        <option value="admin">Administrator</option>
                                        <option value="kasir">Kasir</option>
                                        <option value="teknisi">Teknisi</option>
                                    </select>
                                </div>
                                <div class="mb-3" id="status-field" style="display:none;">
                                    <label class="form-label">Status Akun</label>
                                    <select class="form-select" id="user-status">
                                        <option value="true">Aktif</option>
                                        <option value="false">Nonaktif</option>
                                    </select>
                                </div>
                                <div id="user-form-error" class="alert alert-danger d-none"></div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" id="user-submit-btn">
                                <i class="bi bi-check-lg me-1"></i>Simpan
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadUsers();
        this.setupEventListeners();
    }

    async loadUsers() {
        try {
            const response = await api.getAllUsers();
            this.users = response.data || [];
            this.renderTable();
        } catch (error) {
            document.getElementById('users-table-container').innerHTML = `
                <div class="alert alert-danger m-3">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Gagal memuat data pengguna: ${error.message}
                </div>
            `;
        }
    }

    renderTable() {
        const container = document.getElementById('users-table-container');
        if (!this.users.length) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-people" style="font-size: 3rem;"></i>
                    <p class="mt-3">Belum ada pengguna terdaftar</p>
                </div>
            `;
            return;
        }

        const roleLabels = { admin: 'Administrator', kasir: 'Kasir', teknisi: 'Teknisi' };
        const roleBadges = { admin: 'bg-danger', kasir: 'bg-primary', teknisi: 'bg-success' };

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead>
                        <tr>
                            <th>Nama</th>
                            <th>Username</th>
                            <th>Peran</th>
                            <th>Status</th>
                            <th>Terdaftar</th>
                            <th class="text-end">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.users.map(user => `
                            <tr>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <div class="bg-secondary rounded-circle d-flex align-items-center justify-content-center me-2"
                                            style="width:35px;height:35px;min-width:35px;">
                                            <i class="bi bi-person-fill text-white"></i>
                                        </div>
                                        <span class="fw-semibold">${this.escapeHtml(user.name)}</span>
                                    </div>
                                </td>
                                <td class="text-muted">@${this.escapeHtml(user.username)}</td>
                                <td>
                                    <span class="badge ${roleBadges[user.role] || 'bg-secondary'}">
                                        ${roleLabels[user.role] || user.role}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge ${user.isActive ? 'bg-success' : 'bg-secondary'}">
                                        ${user.isActive ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                </td>
                                <td class="text-muted small">${formatDate(user.createdAt || user.created_at)}</td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="window.usersModule.openEditModal('${user._id}')">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-sm ${user.isActive ? 'btn-outline-warning' : 'btn-outline-success'}" 
                                        onclick="window.usersModule.toggleUserStatus('${user._id}', ${user.isActive})">
                                        <i class="bi bi-${user.isActive ? 'person-slash' : 'person-check'}"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    setupEventListeners() {
        // Tombol tambah pengguna
        const btnAdd = document.getElementById('btn-add-user');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => this.openAddModal());
        }

        // Tombol submit form
        const submitBtn = document.getElementById('user-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.handleSubmit());
        }

        // Expose module globally for inline onclick handlers
        window.usersModule = this;
    }

    openAddModal() {
        this.editingUserId = null;
        document.getElementById('userModalTitle').innerHTML = '<i class="bi bi-person-plus me-2"></i>Tambah Pengguna';
        document.getElementById('user-form').reset();
        document.getElementById('user-form-error').classList.add('d-none');
        document.getElementById('user-username').disabled = false;
        document.getElementById('user-password').required = true;
        document.getElementById('password-hint').textContent = '';
        document.getElementById('status-field').style.display = 'none';
        new bootstrap.Modal(document.getElementById('userModal')).show();
    }

    openEditModal(userId) {
        const user = this.users.find(u => u._id === userId);
        if (!user) return;

        this.editingUserId = userId;
        document.getElementById('userModalTitle').innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Pengguna';
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-username').value = user.username;
        document.getElementById('user-username').disabled = true;
        document.getElementById('user-password').value = '';
        document.getElementById('user-password').required = false;
        document.getElementById('password-hint').textContent = 'Kosongkan jika tidak ingin mengubah password';
        document.getElementById('user-role').value = user.role;
        document.getElementById('user-status').value = String(user.isActive);
        document.getElementById('status-field').style.display = 'block';
        document.getElementById('user-form-error').classList.add('d-none');
        new bootstrap.Modal(document.getElementById('userModal')).show();
    }

    async handleSubmit() {
        const submitBtn = document.getElementById('user-submit-btn');
        const errorDiv = document.getElementById('user-form-error');
        errorDiv.classList.add('d-none');

        const name = document.getElementById('user-name').value.trim();
        const username = document.getElementById('user-username').value.trim();
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        const isActive = document.getElementById('user-status').value === 'true';

        if (!name || !role) {
            errorDiv.textContent = 'Nama dan peran wajib diisi';
            errorDiv.classList.remove('d-none');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Menyimpan...';

        try {
            if (this.editingUserId) {
                // Edit pengguna
                const updateData = { name, role, isActive };
                await api.updateUser(this.editingUserId, updateData);
                showToast('Data pengguna berhasil diperbarui', 'success');
            } else {
                // Tambah pengguna baru
                if (!username || !password) {
                    errorDiv.textContent = 'Username dan password wajib diisi';
                    errorDiv.classList.remove('d-none');
                    return;
                }
                await api.createUser({ name, username, password, role });
                showToast('Pengguna baru berhasil ditambahkan', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
            await this.loadUsers();
        } catch (error) {
            errorDiv.textContent = error.message || 'Gagal menyimpan data pengguna';
            errorDiv.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Simpan';
        }
    }

    async toggleUserStatus(userId, currentStatus) {
        const action = currentStatus ? 'menonaktifkan' : 'mengaktifkan';
        if (!confirmDialog(`Apakah Anda yakin ingin ${action} pengguna ini?`)) return;

        try {
            await api.updateUser(userId, { isActive: !currentStatus });
            showToast(`Pengguna berhasil di${action.replace('me', '')}`, 'success');
            await this.loadUsers();
        } catch (error) {
            showToast(`Gagal ${action} pengguna: ${error.message}`, 'error');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }
}

export default Users;
