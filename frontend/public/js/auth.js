// public/js/auth.js - Autentikasi & Manajemen Token

import api, { showToast } from './api.js';

class Auth {
    constructor() {
        this.user = null;
        this.token = null;
        this.init();
    }

    init() {
        // Cek apakah user sudah login sebelumnya
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (token && user) {
            this.token = token;
            try {
                this.user = JSON.parse(user);
            } catch (e) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                this.showLoginScreen();
                return;
            }
            this.showMainApp();
        } else {
            this.showLoginScreen();
        }

        // Setup form login
        this.setupLoginForm();
        
        // Setup tombol logout
        this.setupLogoutButton();
    }

    setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        const loginBtn = document.getElementById('login-btn');
        const loginError = document.getElementById('login-error');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            // Nonaktifkan tombol dan tampilkan loading
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sedang masuk...';
            loginError.classList.add('d-none');

            try {
                const response = await api.login(username, password);

                if (response.success) {
                    // Simpan token dan data user
                    localStorage.setItem('token', response.data.token);
                    localStorage.setItem('user', JSON.stringify(response.data.user));

                    this.token = response.data.token;
                    this.user = response.data.user;

                    // Tampilkan aplikasi utama
                    this.showMainApp();
                    showToast(`Selamat datang, ${this.user.name}!`, 'success');
                }
            } catch (error) {
                loginError.textContent = error.message || 'Login gagal. Silakan periksa kredensial Anda.';
                loginError.classList.remove('d-none');
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Masuk';
            }
        });
    }

    setupLogoutButton() {
        const logoutBtn = document.getElementById('logout-btn');
        const logoutTopBtn = document.getElementById('logout-btn-top');
        const logoutConfirmBtn = document.getElementById('logout-confirm-btn');
        const modal = new bootstrap.Modal(document.getElementById('logoutConfirmModal'));

        const showModal = () => modal.show();

        logoutBtn.addEventListener('click', showModal);
        if (logoutTopBtn) logoutTopBtn.addEventListener('click', showModal);

        logoutConfirmBtn.addEventListener('click', () => {
            modal.hide();
            this.logout();
        });
    }

    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('d-none');
        document.getElementById('main-app').classList.add('d-none');
    }

    showMainApp() {
        document.getElementById('login-screen').classList.add('d-none');
        document.getElementById('main-app').classList.remove('d-none');

        // Update info user di sidebar
        if (this.user) {
            document.getElementById('user-name-display').textContent = this.user.name;
            document.getElementById('user-username-display').textContent = `@${this.user.username}`;
            document.getElementById('user-role-badge').textContent = this.getRoleName(this.user.role);

            // Tampilkan/sembunyikan navigasi berdasarkan peran
            this.updateNavigationByRole();
        }

        // Update jam (bersihkan interval lama jika ada)
        if (this._clockInterval) clearInterval(this._clockInterval);
        this.updateClock();
        this._clockInterval = setInterval(() => this.updateClock(), 1000);

        // Cek status WAHA secara global
        this.checkWAHAStatus();

        // Pemicu inisialisasi aplikasi (app.js akan menanganinya)
        window.dispatchEvent(new Event('app-ready'));
    }

    async checkWAHAStatus() {
        try {
            const res = await api.getWAHAStatus();
            if (res.status !== 'CONNECTED') {
                this.showWAHAAlert(res.status, res.error || null);
            }
        } catch (error) {
            console.error('WAHA Status Check failed:', error);
            this.showWAHAAlert('ERROR', error.message);
        }
    }

    showWAHAAlert(status, errorDetail = null) {
        let modalEl = document.getElementById('waha-alert-modal');
        
        let title, iconColor, desc, extraAlert;
        if (status === 'UNREACHABLE') {
            title = 'Server WhatsApp Tidak Terjangkau';
            iconColor = 'text-secondary';
            desc = `Backend tidak bisa terhubung ke server WAHA (Status: <strong>${status}</strong>).`;
            extraAlert = 'Periksa apakah container WAHA berjalan dan dapat dijangkau dari backend. Coba jalankan: <code>docker compose logs backend | grep WAHA</code>';
        } else if (status === 'STARTING') {
            title = 'WhatsApp Belum Siap';
            iconColor = 'text-warning';
            desc = `Session WhatsApp sedang dalam proses koneksi (Status: <strong>${status}</strong>).`;
            extraAlert = 'Buka dashboard WAHA di http://localhost:8000 dan scan QR code jika muncul.';
        } else {
            title = 'Layanan WhatsApp Terputus';
            iconColor = 'text-danger';
            desc = `Layanan Bot WhatsApp (WAHA) saat ini tidak merespon/terputus (Status: <strong>${status}</strong>).`;
            extraAlert = 'Fitur notifikasi otomatis pelanggan sedang lumpuh. Harap hubungi Administrator atau cek koneksi server.';
        }

        if (!modalEl) {
            const modalHTML = `
                <div class="modal fade" id="waha-alert-modal" tabindex="-1" data-bs-backdrop="static">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content border-4 border-warning">
                            <div class="modal-header bg-warning text-dark">
                                <h5 class="modal-title fw-bold"><i class="bi bi-exclamation-triangle-fill me-2"></i>Peringatan Sistem</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body text-center p-4">
                                <i class="bi bi-whatsapp ${iconColor} mb-3" style="font-size: 4rem;"></i>
                                <h4 class="fw-bold">${title}</h4>
                                <p class="text-muted">${desc}</p>
                                ${errorDetail ? `<p class="small text-danger">Detail: ${errorDetail}</p>` : ''}
                                <div class="alert alert-warning small text-start">${extraAlert}</div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary w-100" data-bs-dismiss="modal">Saya Mengerti</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modalEl = document.getElementById('waha-alert-modal');
        } else {
            // Update konten modal yang sudah ada
            const icon = modalEl.querySelector('.bi-whatsapp');
            if (icon) icon.className = `bi bi-whatsapp ${iconColor} mb-3`;
            const titleEl = modalEl.querySelector('h4');
            if (titleEl) titleEl.textContent = title;
            const descEl = modalEl.querySelector('.text-muted');
            if (descEl) descEl.innerHTML = desc;
        }
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    updateNavigationByRole() {
        const role = this.user.role;
        const isAdmin = role === 'admin';

        // Sembunyikan/munculkan item navigasi berdasarkan role
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.toggle('d-none', !isAdmin);
        });
        document.querySelectorAll('.teknisi-only').forEach(el => {
            el.classList.toggle('d-none', role !== 'teknisi');
        });
        document.querySelectorAll('.kasir-only').forEach(el => {
            el.classList.toggle('d-none', role !== 'kasir');
        });
        document.querySelectorAll('.non-admin').forEach(el => {
            el.classList.toggle('d-none', isAdmin);
        });
    }

    getRoleName(role) {
        const roleNames = {
            'admin': 'Administrator',
            'teknisi': 'Teknisi',
            'kasir': 'Kasir'
        };
        return roleNames[role] || role;
    }

    updateClock() {
        const now = new Date();
        const tz = 'Asia/Jakarta';
        
        const dateStr = now.toLocaleDateString('id-ID', {
            timeZone: tz,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const timeStr = now.toLocaleTimeString('id-ID', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const dateElement = document.getElementById('current-date');
        const timeElement = document.getElementById('current-time');

        if (dateElement) dateElement.textContent = dateStr;
        if (timeElement) timeElement.textContent = timeStr;
    }

    logout() {
        // Hapus data yang tersimpan
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        this.token = null;
        this.user = null;

        // Tampilkan layar login
        this.showLoginScreen();
        showToast('Berhasil keluar', 'info');
    }

    getUser() {
        return this.user;
    }

    getToken() {
        return this.token;
    }

    isAuthenticated() {
        return !!this.token;
    }

    hasRole(...roles) {
        return this.user && roles.includes(this.user.role);
    }
}

// Inisialisasi auth
const auth = new Auth();

// Ekspor instance auth
export default auth;