// public/js/auth.js - Authentication & Token Management

import api, { showToast } from './api.js';

class Auth {
    constructor() {
        this.user = null;
        this.token = null;
        this.init();
    }

    init() {
        // Check if user is already logged in
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (token && user) {
            this.token = token;
            this.user = JSON.parse(user);
            this.showMainApp();
        } else {
            this.showLoginScreen();
        }

        // Setup login form
        this.setupLoginForm();
        
        // Setup logout button
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

            // Disable button and show loading
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
            loginError.classList.add('d-none');

            try {
                const response = await api.login(username, password);

                if (response.success) {
                    // Store token and user data
                    localStorage.setItem('token', response.data.token);
                    localStorage.setItem('user', JSON.stringify(response.data.user));

                    this.token = response.data.token;
                    this.user = response.data.user;

                    // Show main app
                    this.showMainApp();
                    showToast(`Welcome, ${this.user.name}!`, 'success');
                }
            } catch (error) {
                loginError.textContent = error.message || 'Login failed. Please check your credentials.';
                loginError.classList.remove('d-none');
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Login';
            }
        });
    }

    setupLogoutButton() {
        const logoutBtn = document.getElementById('logout-btn');
        
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
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

        // Update user info in sidebar
        if (this.user) {
            document.getElementById('user-name-display').textContent = this.user.name;
            document.getElementById('user-username-display').textContent = `@${this.user.username}`;
            document.getElementById('user-role-badge').textContent = this.getRoleName(this.user.role);

            // Show/hide nav items based on role
            this.updateNavigationByRole();
        }

        // Update clock
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);

        // Trigger app initialization (app.js will handle this)
        window.dispatchEvent(new Event('app-ready'));
    }

    updateNavigationByRole() {
        const role = this.user.role;

        // Hide/show navigation items based on role
        const navPos = document.getElementById('nav-pos');
        const navService = document.getElementById('nav-service');

        if (role === 'teknisi') {
            // Technician can only see service, inventory, and dashboard
            navPos.classList.add('d-none');
        } else if (role === 'kasir') {
            // Cashier can see POS, inventory, and dashboard
            navService.classList.add('d-none');
        }
        // Admin can see everything (no changes needed)
    }

    getRoleName(role) {
        const roleNames = {
            'admin': 'Administrator',
            'teknisi': 'Technician',
            'kasir': 'Cashier'
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
        // Clear stored data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        this.token = null;
        this.user = null;

        // Show login screen
        this.showLoginScreen();
        showToast('Logged out successfully', 'info');
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

// Initialize auth
const auth = new Auth();

// Export auth instance
export default auth;