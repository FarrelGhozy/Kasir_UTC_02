// public/js/api.js - Global API Handler with Fetch Wrapper

const API_BASE_URL = 'http://localhost:5000/api';

class API {
    constructor(baseURL) {
        this.baseURL = baseURL;
    }

    /**
     * Get JWT token from localStorage
     */
    getToken() {
        return localStorage.getItem('token');
    }

    /**
     * Get headers with or without authentication
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
     * Handle API response
     */
    async handleResponse(response) {
    // Check content type
    const contentType = response.headers.get('content-type');
    
    // If response is not JSON (might be HTML error page)
    if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        
        // Backend might be down or returning HTML
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error('Server is not responding correctly. Please ensure the backend API is running on http://localhost:5000');
        }
        
        throw new Error('Server returned invalid response format');
    }

    const data = await response.json();

    if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.reload();
        }

        throw new Error(data.message || `HTTP Error: ${response.status}`);
    }

    return data;
}

    /**
     * Generic request handler
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const authenticated = options.authenticated !== false;

        const config = {
            method: options.method || 'GET',
            headers: this.getHeaders(authenticated),
            ...options
        };

        // Add body if present
        if (options.body) {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            return await this.handleResponse(response);
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint, authenticated = true) {
        return this.request(endpoint, { method: 'GET', authenticated });
    }

    /**
     * POST request
     */
    async post(endpoint, body, authenticated = true) {
        return this.request(endpoint, { method: 'POST', body, authenticated });
    }

    /**
     * PUT request
     */
    async put(endpoint, body, authenticated = true) {
        return this.request(endpoint, { method: 'PUT', body, authenticated });
    }

    /**
     * PATCH request
     */
    async patch(endpoint, body, authenticated = true) {
        return this.request(endpoint, { method: 'PATCH', body, authenticated });
    }

    /**
     * DELETE request
     */
    async delete(endpoint, authenticated = true) {
        return this.request(endpoint, { method: 'DELETE', authenticated });
    }

    // ==================== AUTH ENDPOINTS ====================

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

    // ==================== INVENTORY ENDPOINTS ====================

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

    // ==================== TRANSACTION ENDPOINTS ====================

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

    // ==================== SERVICE TICKET ENDPOINTS ====================

    async createServiceTicket(data) {
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

    // ==================== REPORT ENDPOINTS ====================

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

// Export singleton instance
const api = new API(API_BASE_URL);
export default api;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format currency in Indonesian Rupiah
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

/**
 * Format date in Indonesian locale
 */
export function formatDate(date) {
    return new Date(date).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format datetime in Indonesian locale
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
 * Show toast notification
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
    
    // Remove from DOM after hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

/**
 * Show loading indicator
 */
export function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3 text-muted">Loading data...</p>
            </div>
        `;
    }
}

/**
 * Show error message
 */
export function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Error:</strong> ${message}
            </div>
        `;
    }
}

/**
 * Confirm dialog
 */
export function confirmDialog(message) {
    return confirm(message);
}