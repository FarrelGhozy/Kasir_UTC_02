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
            this.user = JSON.parse(user);
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
        
        logoutBtn.addEventListener('click', () => {
            if (confirm('Apakah Anda yakin ingin keluar?')) {
                this.logout();
            }
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

        // Update jam
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        // Pemicu inisialisasi aplikasi (app.js akan menanganinya)
        window.dispatchEvent(new Event('app-ready'));
    }

    updateNavigationByRole() {
        const role = this.user.role;

        // Sembunyikan/tampilkan item navigasi berdasarkan peran
        const navPos = document.getElementById('nav-pos');
        const navService = document.getElementById('nav-service');

        if (role === 'teknisi') {
            // Teknisi hanya bisa melihat servis, gudang, dan dasbor
            navPos.classList.add('d-none');
        } else if (role === 'kasir') {
            // Kasir bisa melihat POS, gudang, dan dasbor
            navService.classList.add('d-none');
        }
        // Admin bisa melihat semuanya (tidak ada perubahan diperlukan)
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
        
        const dateStr = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const timeStr = now.toLocaleTimeString('id-ID', {
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