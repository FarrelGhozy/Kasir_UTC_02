// public/js/api.js - Global API Handler dengan Fetch Wrapper

const API_BASE_URL = window.API_BASE_URL || window.location.origin + '/api';

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
     * @param {Response} response - Respons fetch
     * @param {object} context - Konteks request { endpoint, authenticated }
     */
    async handleResponse(response, context = {}) {
        const { endpoint = '', authenticated = true } = context;

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
            // Tangani error autentikasi (sesi kedaluwarsa / token tidak valid).
            // JANGAN reload untuk percobaan login yang gagal — biarkan
            // form login menampilkan pesan error ke pengguna.
            const isLoginRequest = endpoint.includes('/auth/login');
            if (response.status === 401 && authenticated && !isLoginRequest && this.getToken()) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Hindari reload berulang kalau posisi sudah di layar login
                const loginScreen = document.getElementById('login-screen');
                if (!loginScreen || loginScreen.classList.contains('d-none')) {
                    window.location.reload();
                }
            }

            const err = new Error(data.message || `Kesalahan HTTP: ${response.status}`);
            err.statusCode = response.status;
            err.code = data.code;
            err.waStatus = data.waStatus;
            throw err;
        }

        return data;
    }

    /**
     * Penangan request generik
     */
    async request(endpoint, options = {}) {
        const method = options.method || 'GET';

        const url = `${this.baseURL}${endpoint}`;
        const authenticated = options.authenticated !== false;

        const config = {
            method,
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
            const data = await this.handleResponse(response, { endpoint, authenticated });
            return data;
        } catch (error) {
            console.error('Kesalahan Permintaan API:', error);
            throw error;
        }
    }

    /**
     * Request GET
     */
    async get(endpoint, params = {}, authenticated = true) {
        let url = endpoint;
        if (Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            url += (url.includes('?') ? '&' : '?') + queryString;
        }
        return this.request(url, { method: 'GET', authenticated });
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
        return this.get('/inventory', params);
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
        return this.get('/transactions', params);
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
        return this.get('/services', params);
    }

    async getServiceTicketById(id) {
        return this.get(`/services/${id}`);
    }

    async updateTicketStatus(id, data) {
        if (data instanceof FormData) {
            return this.request(`/services/${id}/status`, { method: 'PATCH', body: data });
        }
        const payload = typeof data === 'string' ? { status: data } : data;
        return this.patch(`/services/${id}/status`, payload);
    }

    async addPartToService(ticketId, itemId, quantity) {
        return this.post(`/services/${ticketId}/parts`, {
            item_id: itemId,
            quantity: parseInt(quantity)
        });
    }

    // DIHAPUS: updatePartQuantity — tidak ada rute PATCH /services/:id/parts/:part_id
    // di backend (hanya POST + DELETE parts). Method mati yang memanggil endpoint
    // fiktif; hapus agar tidak dipakai tidak sengaja.
    async removePartFromService(ticketId, partId) {
        return this.delete(`/services/${ticketId}/parts/${partId}`);
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

    async resendWA(id) {
        return this.post(`/services/${id}/resend-wa`, {});
    }

    async notifyTeknisi(id) {
        return this.post(`/services/${id}/notify-teknisi`, {});
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
        if (data instanceof FormData) {
            return this.request('/orders', { method: 'POST', body: data });
        }
        return this.post('/orders', data);
    }

    async getSpecialOrders(params = {}) {
        return this.get('/orders', params);
    }

    async getSpecialOrderById(id) {
        return this.get(`/orders/${id}`);
    }

    async getNotas() {
        return this.get('/notas');
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

    async updatePaymentStatus(id, payment_status) {
        return this.patch(`/orders/${id}/payment`, { payment_status });
    }

    // ==================== ENDPOINT LAPORAN ====================

    async getDailyRevenue(date) {
        return this.get('/reports/revenue/daily', date ? { date } : {});
    }

    async getMonthlyRevenue(year, month) {
        return this.get('/reports/revenue/monthly', { year, month });
    }

    async getRevenueByRange(startDate, endDate) {
        return this.get('/reports/revenue/range', { start_date: startDate, end_date: endDate });
    }

    async getTopItems(params = {}) {
        return this.get('/reports/top-items', params);
    }

    async getCashierPerformance(params = {}) {
        return this.get('/reports/cashier-performance', params);
    }

    async getTechnicianPerformance(params = {}) {
        return this.get('/reports/technician-performance', params);
    }

    // --- WhatsApp Helper ---
    async checkWA(phone) {
        return this.get('/check-wa', { phone });
    }

    async getWAHAStatus() {
        return this.get('/waha-status');
    }

    /**
     * Buat URL ter-autentikasi untuk <img src> / window.open yang tidak bisa kirim header.
     * Menambahkan ?token=JWT bila URL belum memiliki token, sehingga request GET
     * ke /api/uploads/:filename bisa melewati protect via query fallback.
     */
    getAuthUrl(url) {
        if (!url) return '';
        const token = this.getToken();
        if (!token) return url;
        try {
            const u = new URL(url, window.location.origin);
            if (u.searchParams.has('token')) return u.toString();
            u.searchParams.set('token', token);
            return u.toString();
        } catch {
            const sep = url.includes('?') ? '&' : '?';
            return `${url}${sep}token=${encodeURIComponent(token)}`;
        }
    }
}

/**
 * Helper standalone untuk modul yang tidak pakai instance api (parity dengan api.getAuthUrl)
 * @param {string} url
 * @returns {string}
 */
export function getAuthImageUrl(url) {
    if (!url) return '';
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) return url;
    try {
        const u = new URL(url, window.location.origin);
        if (u.searchParams.has('token')) return u.toString();
        u.searchParams.set('token', token);
        return u.toString();
    } catch {
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}token=${encodeURIComponent(token)}`;
    }
}

/**
 * WhatsApp Helper ---
 */
export function formatWhatsAppNumber(phone) {
    if (!phone) return '';
    let clean = phone.toString().replace(/\D/g, '');
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    }
    return clean;
}

/**
 * Ambang & cache validasi realtime WA (frontend).
 * - Hanya menembak API bila digit ternormalisasi >= 9 (tidak nyala terus saat baru mengetik).
 * - Hasil sukses di-cache 5 menit per nomor (selaras dengan backend).
 */
const WA_MIN_DIGITS = 9;
const WA_CACHE_TTL_MS = 5 * 60 * 1000;
const waRealtimeCache = new Map(); // nomor -> { state, at }
// Cache status koneksi WAHA di frontend (30 detik) — dipakai badge global form
let wahaConnCache = { at: 0, connected: null };

/**
 * Normalisasi + cek kelayakan nomor untuk dicek ke WAHA.
 * @param {string} phone
 * @returns {{ clean: string, plausible: boolean }}
 */
export function precheckPhoneNumber(phone) {
    const clean = formatWhatsAppNumber(phone);
    const plausible = clean.length >= WA_MIN_DIGITS && /^62\d{8,13}$/.test(clean);
    return { clean, plausible };
}

function getCachedWAState(clean) {
    const entry = waRealtimeCache.get(clean);
    if (entry && (Date.now() - entry.at) < WA_CACHE_TTL_MS) return entry.state;
    waRealtimeCache.delete(clean);
    return null;
}

function setCachedWAState(clean, state) {
    waRealtimeCache.set(clean, { state, at: Date.now() });
    if (waRealtimeCache.size > 200) {
        const oldest = waRealtimeCache.keys().next().value;
        waRealtimeCache.delete(oldest);
    }
}

/**
 * Reset cache realtime WA + status koneksi (dipakai unit test agar deterministik).
 */
export function clearWARealtimeCache() {
    waRealtimeCache.clear();
    wahaConnCache = { at: 0, connected: null };
}

/**
 * Render badge status validasi WA di bawah input.
 * State: 'idle' | 'checking' | 'valid' | 'invalid' | 'unknown'
 */
export function renderWAState(msgEl, state, extra = '') {
    if (!msgEl) return;
    const base = 'small mt-1 fw-bold';
    if (state === 'idle') {
        msgEl.innerHTML = '';
        msgEl.className = `${base} d-none`;
        return;
    }
    msgEl.classList.remove('d-none');
    if (state === 'checking') {
        msgEl.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Mengecek WhatsApp...';
        msgEl.className = `${base} text-muted`;
    } else if (state === 'valid') {
        msgEl.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Nomor WhatsApp Terverifikasi ✓';
        msgEl.className = `${base} text-success`;
    } else if (state === 'invalid') {
        msgEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>Nomor tidak terdaftar di WhatsApp. Periksa kembali atau gunakan "Tetap simpan" saat menyimpan.';
        msgEl.className = `${base} text-danger`;
    } else {
        // unknown: WAHA tidak terkoneksi / error — pengecekan tidak berlaku.
        // Pesan mencakup frasa "Pengecekan WA gagal" & "Server sibuk" agar konsisten
        // dengan penamaan lama sekaligus menjelaskan status koneksi.
        msgEl.innerHTML = `<i class="bi bi-wifi-off me-1"></i>WA tidak terkoneksi — Pengecekan WA gagal${extra ? `: ${extra}` : ''}. Server sibuk / WAHA mati, pastikan nomor benar secara manual.`;
        msgEl.className = `${base} text-warning`;
    }
}

/**
 * Global function to validate WhatsApp number with UI feedback
 * @param {string} phone Original phone input
 * @param {string} msgElementId ID of the message container
 * @param {string} submitBtnId ID of the submit button to disable/enable
 * @returns {Promise<boolean>}
 */
export async function validateWhatsApp(phone, msgElementId, submitBtnId) {
    const result = await checkWARealtime(phone, msgElementId);
    const submitBtn = submitBtnId ? document.getElementById(submitBtnId) : null;
    // Soft-block: tombol tetap aktif agar kasir bisa override via konfirmasi saat submit
    if (submitBtn) submitBtn.disabled = false;
    return true;
}

/**
 * Cek realtime satu nomor + render badge. Kembalikan { state, clean }.
 * Dipakai oleh helper setupPhoneRealtimeValidation dan pemanggilan langsung.
 */
export async function checkWARealtime(phone, msgElementId, { signal } = {}) {
    const msgEl = msgElementId ? document.getElementById(msgElementId) : null;
    const raw = (phone || '').trim();

    // Kosong / terlalu pendek -> idle, nol request
    if (!raw || raw.replace(/\D/g, '').length < 5) {
        renderWAState(msgEl, 'idle');
        return { state: 'idle', clean: '' };
    }

    const { clean, plausible } = precheckPhoneNumber(raw);
    if (!plausible) {
        // Digit belum cukup / pola belum ID -> hint format, tanpa request
        if (msgEl) {
            msgEl.classList.remove('d-none');
            msgEl.innerHTML = '<i class="bi bi-info-circle me-1"></i>Lengkapi nomor (contoh: 08xxxxxxxxxx) untuk cek otomatis.';
            msgEl.className = 'small mt-1 text-muted';
        }
        return { state: 'idle', clean };
    }

    const hit = getCachedWAState(clean);
    if (hit) {
        renderWAState(msgEl, hit);
        return { state: hit, clean };
    }

    renderWAState(msgEl, 'checking');
    try {
        const res = await api.checkWA(clean);
        // Backend baru: waStatus 'valid' | 'invalid' | 'unknown'.
        // Fallback backend lama: isValid / isError saja.
        let state = 'unknown';
        if (res.waStatus === 'valid' || res.waStatus === 'invalid' || res.waStatus === 'unknown') {
            state = res.waStatus;
        } else if (res.isError) {
            state = 'unknown';
        } else if (res.isValid) {
            state = 'valid';
        } else {
            state = 'invalid';
        }
        setCachedWAState(clean, state);
        renderWAState(msgEl, state);
        return { state, clean };
    } catch (error) {
        console.error('WA Validation error:', error);
        renderWAState(msgEl, 'unknown', error.message || '');
        return { state: 'unknown', clean };
    }
}

/**
 * Pasang validasi realtime pada input telepon:
 * - 'input' + debounce 700ms + AbortController-style guard (abaikan respons basi)
 * - hanya menembak API bila nomor sudah plausible (mulai diinput, bukan nyala terus)
 * - status tersimpan di input.dataset.waState untuk dibaca saat submit
 *
 * @param {HTMLInputElement} inputEl
 * @param {object} opts { msgId, debounceMs, onState }
 * @returns {function} cleanup
 */
export function setupPhoneRealtimeValidation(inputEl, opts = {}) {
    if (!inputEl) return () => {};
    const { msgId, debounceMs = 700, onState } = opts;
    let timer = null;
    let seq = 0;
    const msgEl = msgId ? document.getElementById(msgId) : null;

    // Status koneksi WAHA global (sekali per halaman, 30 dtk) agar form tahu
    // apakah pengecekan berlaku atau WA sedang tidak terkoneksi.
    checkWHAConnectionBadge(msgId);

    const run = async () => {
        const mySeq = ++seq;
        const { state, clean } = await checkWARealtime(inputEl.value, msgId);
        if (mySeq !== seq) return; // abaikan respons basi
        inputEl.dataset.waState = state;
        inputEl.dataset.waPhone = clean;
        if (typeof onState === 'function') onState(state, clean);
    };

    const onInput = () => {
        clearTimeout(timer);
        // Reset badge ke idle bila user menghapus hingga di bawah ambang
        const digits = (inputEl.value || '').replace(/\D/g, '');
        if (digits.length < 5) {
            renderWAState(msgEl, 'idle');
            inputEl.dataset.waState = 'idle';
            inputEl.dataset.waPhone = '';
            return;
        }
        timer = setTimeout(run, debounceMs);
    };
    const onBlur = () => { clearTimeout(timer); run(); };

    inputEl.addEventListener('input', onInput);
    inputEl.addEventListener('blur', onBlur);
    inputEl.dataset.waState = inputEl.dataset.waState || 'idle';
    return () => {
        clearTimeout(timer);
        inputEl.removeEventListener('input', onInput);
        inputEl.removeEventListener('blur', onBlur);
    };
}

// Status koneksi WAHA: dideklarasikan di atas bersama cache realtime
export async function getWAHAConnected() {
    if (Date.now() - wahaConnCache.at < 30000 && wahaConnCache.connected !== null) {
        return wahaConnCache.connected;
    }
    try {
        const res = await api.getWAHAStatus();
        wahaConnCache = { at: Date.now(), connected: res.status === 'CONNECTED' };
    } catch {
        wahaConnCache = { at: Date.now(), connected: false };
    }
    return wahaConnCache.connected;
}

/**
 * Tampilkan badge status koneksi WAHA di atas pesan validasi form.
 * Bila WA tidak terkoneksi: beri keterangan agar kasir tahu pengecekan tidak berlaku.
 */
export async function checkWHAConnectionBadge(msgId) {
    const msgEl = msgId ? document.getElementById(msgId) : null;
    if (!msgEl) return;
    const connected = await getWAHAConnected();
    if (connected) return;
    // Jangan timpa badge hasil cek nomor bila sudah ada hasil tegas
    const hasResult = /terverifikasi|tidak terdaftar/i.test(msgEl.innerHTML || '');
    if (hasResult) return;
    let badge = document.getElementById(`${msgId}-waha-conn`);
    if (!badge) {
        badge = document.createElement('div');
        badge.id = `${msgId}-waha-conn`;
        msgEl.parentNode.insertBefore(badge, msgEl);
    }
    badge.innerHTML = '<span class="badge bg-warning text-dark"><i class="bi bi-wifi-off me-1"></i>WA tidak terkoneksi — pengecekan nomor tidak aktif, pastikan nomor benar manual</span>';
    badge.className = 'mb-1';
}

// Ekspor instance singleton
const api = new API(API_BASE_URL);
export default api;

/**
 * Dynamic script loader — load script hanya saat dibutuhkan.
 * Menunggu event load asli bila tag sudah ada (aman dipanggil paralel),
 * dilengkapi timeout agar kegagalan CDN tidak menggantung selamanya.
 * @param {string} src - URL script
 * @param {number} timeoutMs - Batas waktu tunggu (default 15000ms)
 * @returns {Promise<void>}
 */
export function loadScript(src, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const fail = (msg) => reject(new Error(msg));
    const timer = setTimeout(() => fail(`Gagal memuat script (timeout ${timeoutMs}ms): ${src}`), timeoutMs);

    const onLoad = (s) => { clearTimeout(timer); s.dataset.loaded = 'true'; resolve(); };
    const onError = () => { clearTimeout(timer); fail(`Gagal memuat script: ${src}`); };

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      // Tag sudah ada tapi belum tentu selesai dimuat (race saat dipanggil paralel) —
      // tunggu event load aslinya, jangan langsung resolve.
      if (existing.dataset.loaded === 'true') { clearTimeout(timer); return resolve(); }
      existing.addEventListener('load', () => onLoad(existing), { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => onLoad(s);
    s.onerror = onError;
    document.head.appendChild(s);
  });
}

/**
 * Coba muat script dari daftar sumber berurutan (fallback CDN -> lokal).
 * Mengembalikan sumber yang berhasil, melempar error gabungan bila semua gagal.
 * @param {string[]} sources - Daftar URL script, dicoba satu per satu
 * @param {number} timeoutMs - Timeout per sumber
 * @returns {Promise<string>} URL sumber yang berhasil dimuat
 */
export async function loadScriptWithFallback(sources, timeoutMs = 15000) {
  const errors = [];
  for (const src of sources) {
    try {
      await loadScript(src, timeoutMs);
      return src;
    } catch (err) {
      errors.push(`${src} (${err.message})`);
    }
  }
  throw new Error(`Semua sumber script gagal dimuat:\n- ${errors.join('\n- ')}`);
}

// ==================== FUNGSI UTILITAS ====================

/**
 * Format mata uang ke Rupiah Indonesia
 */
export function formatCurrency(amount) {
    const num = Number(amount);
    if (!Number.isFinite(num)) return 'Rp\u00a00';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(num);
}

/**
 * Konversi Date ke string YYYY-MM-DD local (ISO local, bukan UTC)
 */
export function toLocalDateString(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format tanggal ke lokal Indonesia
 */
export function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format tanggal dan waktu ke lokal Indonesia
 */
export function formatDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Cek apakah error API adalah penolakan WA 422 (nomor tidak terdaftar).
 * Pakai statusCode numerik — jangan tebak via regex pesan (rapuh bila
 * redaksi backend berubah).
 */
export function isWARejection(error) {
    return !!error && (error.statusCode === 422 || error.status === 422);
}

/**
 * Escape HTML untuk cegah XSS
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

/**
 * Tampilkan notifikasi toast
 */
export function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toastId = 'toast-' + Date.now();
    
    const bgClass = type === 'success' ? 'bg-success' : 
                    type === 'error' ? 'bg-danger' : 
                    type === 'warning' ? 'bg-warning' : 'bg-info';
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'x-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    const safeMsg = escapeHTML(message);
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-${icon} me-2"></i>${safeMsg}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();
    
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
                <strong>Kesalahan:</strong> ${escapeHTML(message)}
            </div>
        `;
    }
}

/**
 * Dialog konfirmasi (Bootstrap modal)
 * @param {string} message - Pesan konfirmasi
 * @param {string} title - Judul modal (default: 'Konfirmasi')
 * @param {string} confirmText - Teks tombol konfirmasi (default: 'Hapus')
 * @param {object|string} options - Varian tampilan atau tipe string ('danger'|'warning'|'success'|'primary').
 *   Bentuk object: { type, icon, confirmClass, cancelText }
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, title = 'Konfirmasi', confirmText = 'Hapus', options = {}) {
    // Kompatibilitas: param ke-4 boleh string tipe saja, mis. confirmDialog(msg, title, text, 'warning')
    const opts = typeof options === 'string' ? { type: options } : (options || {});
    const type = ['danger', 'warning', 'success', 'primary'].includes(opts.type) ? opts.type : 'danger';
    const cancelText = opts.cancelText || 'Batal';

    // Ikon & warna tombol mengikuti tipe agar makna tiap aksi jelas:
    // danger = hapus (merah), warning = batalkan (kuning),
    // success = selesaikan/setuju (hijau), primary = ubah umum (biru)
    const presets = {
        danger: { icon: 'bi-trash', confirmClass: 'btn-danger' },
        warning: { icon: 'bi-exclamation-triangle', confirmClass: 'btn-warning' },
        success: { icon: 'bi-check-circle', confirmClass: 'btn-success' },
        primary: { icon: 'bi-question-circle', confirmClass: 'btn-primary' }
    };
    const icon = opts.icon || presets[type].icon;
    const confirmClass = opts.confirmClass || presets[type].confirmClass;

    return new Promise((resolve) => {
        const modalEl = document.getElementById('confirmModal');
        const iconWrap = document.getElementById('confirmModalIcon');
        const titleEl = document.getElementById('confirmModalTitle');
        const messageEl = document.getElementById('confirmModalMessage');
        const confirmBtn = document.getElementById('confirmModalConfirm');
        const cancelBtn = document.getElementById('confirmModalCancel');

        titleEl.textContent = title;
        messageEl.textContent = message;
        if (iconWrap) {
            iconWrap.className = `confirm-modal-icon ${type}`;
            iconWrap.innerHTML = `<i class="bi ${icon}"></i>`;
        }
        confirmBtn.className = `btn fw-bold px-4 ${confirmClass}`;
        confirmBtn.innerHTML = `<i class="bi ${icon} me-2"></i>${confirmText}`;
        cancelBtn.textContent = cancelText;

        const existing = bootstrap.Modal.getInstance(modalEl);
        if (existing) existing.dispose();
        const modal = new bootstrap.Modal(modalEl);

        let resolved = false;

        const onConfirm = () => {
            if (resolved) return;
            resolved = true;
            resolve(true);
            modal.hide();
        };

        const onCancel = () => {
            if (resolved) return;
            resolved = true;
            resolve(false);
            modal.hide();
        };

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (!resolved) {
                resolved = true;
                resolve(false);
            }
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        }, { once: true });

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);

        modal.show();
    });
}

/**
 * Helpers for Currency Input Formatting (Thousand Separators)
 */
export function formatInputCurrency(value) {
    if (value === null || value === undefined || value === '') return '';
    const number = value.toString().replace(/\D/g, '');
    if (!number) return '';
    return new Intl.NumberFormat('id-ID').format(number);
}

export function parseCurrencyValue(formattedValue) {
    if (!formattedValue) return 0;
    return parseInt(formattedValue.toString().replace(/\./g, ''), 10) || 0;
}

export function setupCurrencyInput(inputElement) {
    if (!inputElement) return;
    // Guard: modal yang sama dibuka-tutup berulang memakai elemen yang sama —
    // tanpa guard listener 'input' menumpuk (cursor jump memburuk).
    if (inputElement.dataset.currencyBound) {
        if (inputElement.value) {
            inputElement.value = formatInputCurrency(inputElement.value);
        }
        return;
    }
    inputElement.dataset.currencyBound = '1';

    if (inputElement.value) {
        inputElement.value = formatInputCurrency(inputElement.value);
    }

    inputElement.addEventListener('input', (e) => {
        const cursorP = e.target.selectionStart;
        const oldLen = e.target.value.length;
        
        const rawValue = e.target.value;
        const formatted = formatInputCurrency(rawValue);
        e.target.value = formatted;
        
        const newLen = formatted.length;
        const newCursorP = cursorP + (newLen - oldLen);
        e.target.setSelectionRange(newCursorP, newCursorP);
    });
}

/**
 * Hitung selisih waktu dalam format yang mudah dibaca
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
