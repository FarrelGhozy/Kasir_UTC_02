// public/js/api.js - Global API Handler dengan Fetch Wrapper


const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = isLocalHost
    ? `${window.location.protocol}//${window.location.hostname}:5000/api`
    : 'https://api-kasir.utc.web.id/api';


class API {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    /**
     * Ambil token JWT dari localStorage
     */
    getToken() {
        return localStorage.getItem('token');
    }

    /**
     * Ambil headers dengan atau tanpa autentikasi
     */
    getHeaders(authenticated = true) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (authenticated) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    /**
     * Tangani respons API
     */
    async handleResponse(response) {
        // Cek tipe konten
        const contentType = response.headers.get('content-type');
        
        // Jika respons bukan JSON (mungkin halaman error HTML dari server)
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            
            // Backend mungkin mati atau mengembalikan HTML
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                throw new Error('Server tidak merespons. Pastikan backend sedang berjalan.');
            }
            
            throw new Error('Server mengembalikan format respons yang tidak valid');
        }

        const data = await response.json();

        if (!response.ok) {
            // Tangani error autentikasi
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.reload();
            }

            throw new Error(data.message || `Kesalahan HTTP: ${response.status}`);
        }

        return data;
    }

    /**
     * Penangan request generik
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const authenticated = options.authenticated !== false;

        const config = {
            method: options.method || 'GET',
            headers: this.getHeaders(authenticated),
        };

        // Jika body adalah FormData, jangan set Content-Type JSON
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
            config.body = options.body;
        } else if (options.body) {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Kesalahan Permintaan API:', error);
            throw error;
        }
    }

    /**
     * Request GET
     */
    async get(endpoint, authenticated = true) {
        return this.request(endpoint, { method: 'GET', authenticated });
    }

    /**
     * Request POST
     */
    async post(endpoint, body, authenticated = true) {
        return this.request(endpoint, { method: 'POST', body, authenticated });
    }

    /**
     * Request PUT
     */
    async put(endpoint, body, authenticated = true) {
        return this.request(endpoint, { method: 'PUT', body, authenticated });
    }

    /**
     * Request PATCH
     */
    async patch(endpoint, body, authenticated = true) {
        return this.request(endpoint, { method: 'PATCH', body, authenticated });
    }

    /**
     * Request DELETE
     */
    async delete(endpoint, authenticated = true) {
        return this.request(endpoint, { method: 'DELETE', authenticated });
    }

    // ==================== ENDPOINT OTENTIKASI ====================

    async login(username, password) {
        return this.post('/auth/login', { username, password }, false);
    }

    async getMe() {
        return this.get('/auth/me');
    }

    async getTechnicians() {
        return this.get('/auth/technicians');
    }

    async getAllUsers() {
        return this.get('/auth/users');
    }

    // ==================== ENDPOINT GUDANG (INVENTORY) ====================

    async getInventory(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/inventory${queryString ? '?' + queryString : ''}`);
    }

    async getItemById(id) {
        return this.get(`/inventory/${id}`);
    }

    async createItem(data) {
        return this.post('/inventory', data);
    }

    async updateItem(id, data) {
        return this.put(`/inventory/${id}`, data);
    }

    async deleteItem(id) {
        return this.delete(`/inventory/${id}`);
    }

    async getLowStockItems() {
        return this.get('/inventory/alerts/low-stock');
    }

    async getInventoryValue() {
        return this.get('/inventory/summary/value');
    }

    async getItemsByCategory() {
        return this.get('/inventory/summary/by-category');
    }

    // ==================== ENDPOINT TRANSAKSI ====================

    async createTransaction(data) {
        return this.post('/transactions', data);
    }

    async getTransactions(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/transactions${queryString ? '?' + queryString : ''}`);
    }

    async getTransactionById(id) {
        return this.get(`/transactions/${id}`);
    }

    async getTodaySummary() {
        return this.get('/transactions/summary/today');
    }

    // ==================== ENDPOINT TIKET SERVIS ====================

    async createServiceTicket(data) {
        if (data instanceof FormData) {
            return this.request('/services', { method: 'POST', body: data });
        }
        return this.post('/services', data);
    }

    async getServiceTickets(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/services${queryString ? '?' + queryString : ''}`);
    }

    async getServiceTicketById(id) {
        return this.get(`/services/${id}`);
    }

    async updateTicketStatus(id, status) {
        return this.patch(`/services/${id}/status`, { status });
    }

    async addPartToService(ticketId, itemId, quantity) {
        return this.post(`/services/${ticketId}/parts`, { 
            item_id: itemId, 
            quantity 
        });
    }

    async updateServiceFee(id, serviceFee) {
        return this.patch(`/services/${id}/service-fee`, { service_fee: serviceFee });
    }

    async updateTicketDetails(id, data) {
        if (data instanceof FormData) {
            return this.request(`/services/${id}`, { method: 'PUT', body: data });
        }
        return this.put(`/services/${id}`, data);
    }

    async validateWA(phone) {
        return this.post('/services/validate-wa', { phone });
    }

    async resendWA(id) {
        return this.post(`/services/${id}/resend-wa`, {});
    }

    async claimWarranty(id) {
        return this.post(`/services/${id}/claim-warranty`, {});
    }

    async getSystemLogs() {
        return this.get('/services/logs');
    }

    async deleteServiceTicket(id) {
        return this.delete(`/services/${id}`);
    }


    // ==================== ENDPOINT PEMESANAN BARANG ====================

    async createSpecialOrder(data) {
        return this.post('/orders', data);
    }

    async getSpecialOrders(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/orders${queryString ? '?' + queryString : ''}`);
    }

    async getSpecialOrderById(id) {
        return this.get(`/orders/${id}`);
    }

    async updateSpecialOrderStatus(id, status) {
        return this.patch(`/orders/${id}/status`, { status });
    }

    async updateSpecialOrderDetails(id, data) {
        return this.put(`/orders/${id}`, data);
    }

    async deleteSpecialOrder(id) {
        return this.delete(`/orders/${id}`);
    }

    // ==================== ENDPOINT LAPORAN ====================

    async getDailyRevenue(date) {
        const params = date ? `?date=${date}` : '';
        return this.get(`/reports/revenue/daily${params}`);
    }

    async getMonthlyRevenue(year, month) {
        return this.get(`/reports/revenue/monthly?year=${year}&month=${month}`);
    }

    async getRevenueByRange(startDate, endDate) {
        return this.get(`/reports/revenue/range?start_date=${startDate}&end_date=${endDate}`);
    }

    async getTopItems(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/reports/top-items${queryString ? '?' + queryString : ''}`);
    }

    async getCashierPerformance(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/reports/cashier-performance${queryString ? '?' + queryString : ''}`);
    }

    async getTechnicianPerformance(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.get(`/reports/technician-performance${queryString ? '?' + queryString : ''}`);
    }
    }

// Ekspor instance singleton
const api = new API(API_BASE_URL);
export default api;

// ==================== FUNGSI UTILITAS ====================

/**
 * Format mata uang ke Rupiah Indonesia
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

/**
 * Format tanggal ke lokal Indonesia
 */
export function formatDate(date) {
    return new Date(date).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format tanggal dan waktu ke lokal Indonesia
 */
export function formatDateTime(date) {
    return new Date(date).toLocaleString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Tampilkan notifikasi toast
 */
export function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toastId = 'toast-' + Date.now();
    
    const bgClass = type === 'success' ? 'bg-success' : 
                    type === 'error' ? 'bg-danger' : 
                    type === 'warning' ? 'bg-warning' : 'bg-info';
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'x-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-${icon} me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();
    
    // Hapus dari DOM setelah tersembunyi
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

/**
 * Tampilkan indikator loading
 */
export function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Memuat...</span>
                </div>
                <p class="mt-3 text-muted">Sedang memuat data...</p>
            </div>
        `;
    }
}

/**
 * Tampilkan pesan error
 */
export function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Kesalahan:</strong> ${message}
            </div>
        `;
    }
}

/**
 * Dialog konfirmasi
 */
export function confirmDialog(message) {
    return confirm(message);
}

/**
 * Helpers for Currency Input Formatting (Thousand Separators)
 */
export function formatInputCurrency(value) {
    if (!value) return '';
    // Remove everything except numbers
    const number = value.toString().replace(/\D/g, '');
    if (!number) return '';
    // Format with dots
    return new Intl.NumberFormat('id-ID').format(number);
}

export function parseCurrencyValue(formattedValue) {
    if (!formattedValue) return 0;
    // Remove dots to get raw number
    return parseInt(formattedValue.toString().replace(/\./g, ''), 10) || 0;
}

export function setupCurrencyInput(inputElement) {
    if (!inputElement) return;
    
    // Initial format if has value
    if (inputElement.value) {
        inputElement.value = formatInputCurrency(inputElement.value);
    }

    inputElement.addEventListener('input', (e) => {
        const cursorP = e.target.selectionStart;
        const oldLen = e.target.value.length;
        
        const rawValue = e.target.value;
        const formatted = formatInputCurrency(rawValue);
        e.target.value = formatted;
        
        // Adjust cursor position
        const newLen = formatted.length;
        const newCursorP = cursorP + (newLen - oldLen);
        e.target.setSelectionRange(newCursorP, newCursorP);
    });
}

/**
 * Hitung selisih waktu dalam format yang mudah dibaca (Hari, Jam, Menit)
 */
export function calculateElapsedTime(startTime, endTime = new Date()) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    
    if (diffMs < 0) return 'Baru saja';
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
        return `${diffDays} hari ${diffHours % 24} jam`;
    } else if (diffHours > 0) {
        return `${diffHours} jam ${diffMins % 60} menit`;
    } else {
        return `${diffMins} menit`;
    }
}