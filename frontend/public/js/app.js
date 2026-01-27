// public/js/app.js - Router Aplikasi Utama & Logika Navigasi

import auth from './auth.js';
import { showLoading } from './api.js';

// Import modul-modul
import Dashboard from './modules/dashboard.js';
import POS from './modules/pos.js';
import Service from './modules/service.js';
import Inventory from './modules/inventory.js';
import Reports from './modules/reports.js';

class App {
    constructor() {
        this.currentPage = null;
        this.modules = {
            dashboard: new Dashboard(),
            pos: new POS(),
            service: new Service(),
            inventory: new Inventory(),
            reports: new Reports()
        };

        this.init();
    }

    init() {
        // 1. Listener Normal: Menunggu sinyal login dari auth.js
        window.addEventListener('app-ready', () => {
            console.log('Event app-ready diterima, memuat dashboard...');
            this.setupNavigation();
            this.navigateTo('dashboard');
        });

        // 2. PERBAIKAN RACE CONDITION (Anti-Macet):
        // Jika auth.js sudah selesai duluan sebelum app.js siap,
        // kita cek manual status loginnya. Jika sudah login, paksa masuk dashboard.
        if (auth.isAuthenticated()) {
            console.log('App telat memuat, memaksa masuk dashboard secara manual...');
            this.setupNavigation();
            this.navigateTo('dashboard');
        }
    }

    setupNavigation() {
        // Ambil semua link navigasi
        const navLinks = document.querySelectorAll('#main-nav .nav-link');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                const page = link.getAttribute('data-page');

                // Update status aktif (highlight menu)
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Navigasi ke halaman
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        if (this.currentPage === page) return;

        this.currentPage = page;

        // Update judul halaman
        const pageTitles = {
            dashboard: 'Dashboard',
            pos: 'Kasir (POS)',
            service: 'Servis (Workshop)',
            inventory: 'Gudang (Inventaris)',
            reports: 'Laporan'
        };

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = pageTitles[page] || 'Dashboard';
        }

        // Tampilkan loading
        showLoading('app-content');

        // Muat konten modul
        if (this.modules[page]) {
            setTimeout(() => {
                this.modules[page].render();
            }, 300); // Penundaan kecil untuk transisi yang halus
        } else {
            this.show404();
        }
    }

    show404() {
        const content = document.getElementById('app-content');
        content.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-exclamation-triangle text-warning" style="font-size: 5rem;"></i>
                <h2 class="mt-4">Halaman Tidak Ditemukan</h2>
                <p class="text-muted">Halaman yang Anda cari tidak tersedia.</p>
                <button class="btn btn-primary mt-3" onclick="app.navigateTo('dashboard')">
                    <i class="bi bi-house me-2"></i>Kembali ke Dashboard
                </button>
            </div>
        `;
    }
}

// Inisialisasi aplikasi
const app = new App();

// Membuat app dapat diakses secara global untuk keperluan debugging/onclick
window.app = app;

export default app;