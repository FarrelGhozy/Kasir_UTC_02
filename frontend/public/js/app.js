// public/js/app.js - Main Application Router & Navigation Logic

import auth from './auth.js';
import { showLoading } from './api.js';

// Import modules
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
            console.log('App telat loading, memaksa masuk dashboard secara manual...');
            this.setupNavigation();
            this.navigateTo('dashboard');
        }
    }

    setupNavigation() {
        // Get all navigation links
        const navLinks = document.querySelectorAll('#main-nav .nav-link');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const page = link.getAttribute('data-page');
                
                // Update active state
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Navigate to page
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        if (this.currentPage === page) return;

        this.currentPage = page;

        // Update page title
        const pageTitles = {
            dashboard: 'Dashboard',
            pos: 'Kasir (Point of Sale)',
            service: 'Servis (Workshop)',
            inventory: 'Gudang (Inventory)',
            reports: 'Laporan (Reports)'
        };

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = pageTitles[page] || 'Dashboard';
        }

        // Show loading
        showLoading('app-content');

        // Load module content
        if (this.modules[page]) {
            setTimeout(() => {
                this.modules[page].render();
            }, 300); // Small delay for smooth transition
        } else {
            this.show404();
        }
    }

    show404() {
        const content = document.getElementById('app-content');
        content.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-exclamation-triangle text-warning" style="font-size: 5rem;"></i>
                <h2 class="mt-4">Page Not Found</h2>
                <p class="text-muted">The page you're looking for doesn't exist.</p>
                <button class="btn btn-primary mt-3" onclick="app.navigateTo('dashboard')">
                    <i class="bi bi-house me-2"></i>Go to Dashboard
                </button>
            </div>
        `;
    }
}

// Initialize app
const app = new App();

// Make app globally accessible for debugging
window.app = app;

export default app;