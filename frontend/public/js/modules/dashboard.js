// public/js/modules/dashboard.js - Modul Ringkasan Dasbor (FIXED: Gabungan Aktivitas)

import api, { formatCurrency, showError } from '../api.js';

class Dashboard {
    constructor() {
        this.stats = null;
    }

    async render() {
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4 mb-4">
                <div class="col-md-3">
                    <div class="card stat-card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="bg-primary bg-opacity-10 p-3 rounded me-3">
                                    <i class="bi bi-cash-coin fs-1 text-primary"></i>
                                </div>
                                <div>
                                    <div class="stat-label text-muted small text-uppercase fw-bold">Pendapatan Hari Ini</div>
                                    <div class="stat-value fs-4 fw-bold" id="stat-revenue">Rp 0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="card stat-card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="bg-success bg-opacity-10 p-3 rounded me-3">
                                    <i class="bi bi-cart3 fs-1 text-success"></i>
                                </div>
                                <div>
                                    <div class="stat-label text-muted small text-uppercase fw-bold">Penjualan Retail</div>
                                    <div class="stat-value fs-4 fw-bold text-success" id="stat-transactions">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="card stat-card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="bg-warning bg-opacity-10 p-3 rounded me-3">
                                    <i class="bi bi-wrench fs-1 text-warning"></i>
                                </div>
                                <div>
                                    <div class="stat-label text-muted small text-uppercase fw-bold">Servis Aktif</div>
                                    <div class="stat-value fs-4 fw-bold text-warning" id="stat-services">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="card stat-card border-0 shadow-sm h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="bg-danger bg-opacity-10 p-3 rounded me-3">
                                    <i class="bi bi-exclamation-triangle fs-1 text-danger"></i>
                                </div>
                                <div>
                                    <div class="stat-label text-muted small text-uppercase fw-bold">Stok Menipis</div>
                                    <div class="stat-value fs-4 fw-bold text-danger" id="stat-low-stock">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-header bg-white py-3">
                            <h5 class="mb-0 fw-bold"><i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>Peringatan Stok</h5>
                        </div>
                        <div class="card-body p-0" id="low-stock-container" style="max-height: 400px; overflow-y: auto;">
                            <div class="text-center py-5">
                                <div class="spinner-border text-primary"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-header bg-white py-3">
                            <h5 class="mb-0 fw-bold"><i class="bi bi-clock-history me-2"></i>Aktivitas Terkini</h5>
                        </div>
                        <div class="card-body p-0" id="recent-activity-container" style="max-height: 400px; overflow-y: auto;">
                            <div class="text-center py-5">
                                <div class="spinner-border text-primary"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadDashboardData();
    }

    async loadDashboardData() {
        try {
            // 1. Load Data Statistik
            const dailyReport = await api.getDailyRevenue();
            document.getElementById('stat-revenue').textContent = formatCurrency(dailyReport.data.total_revenue);
            document.getElementById('stat-transactions').textContent = dailyReport.data.retail_sales.transactions;

            const services = await api.getServiceTickets({ 
                status: 'Queue,Diagnosing,Waiting_Part,In_Progress' 
            });
            const activeServices = services.data.filter(t => t.status !== 'Cancelled' && t.status !== 'Completed' && t.status !== 'Picked_Up');
            document.getElementById('stat-services').textContent = activeServices.length;

            // 2. Load Tabel
            await this.loadLowStock();
            await this.loadRecentActivity(); // <--- INI FUNGSI YANG DIPERBAIKI

        } catch (error) {
            console.error('Gagal memuat data dasbor:', error);
            showError('app-content', 'Gagal memuat data dasbor. Pastikan server backend berjalan.');
        }
    }

    async loadLowStock() {
        const container = document.getElementById('low-stock-container');
        try {
            const response = await api.getLowStockItems();
            const items = response.data;

            document.getElementById('stat-low-stock').textContent = items.length;

            if (items.length === 0) {
                container.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-check-circle fs-1 text-success opacity-50"></i><p class="mt-3 fw-semibold">Semua stok barang aman</p></div>`;
                return;
            }

            container.innerHTML = `
                <div class="list-group list-group-flush">
                    ${items.map(item => `
                        <div class="list-group-item px-4 py-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1 fw-bold text-dark">${item.name}</h6>
                                    <small class="text-muted">SKU: ${item.sku}</small>
                                </div>
                                <div class="text-end">
                                    <span class="badge bg-danger rounded-pill">${item.stock} unit</span>
                                    <div class="small text-danger mt-1" style="font-size: 0.75rem;">Min: ${item.min_stock_alert}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="p-4 text-center text-danger">${error.message}</div>`;
        }
    }

    // --- FITUR GABUNGAN AKTIVITAS TERKINI (Retail + Service) ---
    async loadRecentActivity() {
        const container = document.getElementById('recent-activity-container');
        try {
            // Ambil Transaksi Retail
            const retailPromise = api.getTransactions({ limit: 10 });
            
            // Ambil Servis yang Sudah Selesai/Diambil (Pendapatan)
            const servicePromise = api.getServiceTickets({ 
                status: 'Completed,Picked_Up', 
                limit: 10 
            });

            const [retailRes, serviceRes] = await Promise.all([retailPromise, servicePromise]);

            // Normalisasi data Retail agar formatnya sama
            const retailActivities = retailRes.data.map(txn => ({
                type: 'retail',
                id: txn.invoice_no,
                actor: txn.cashier_name,
                date: new Date(txn.date),
                amount: txn.grand_total,
                status: txn.payment_method,
                icon: 'bi-cart-check',
                color: 'text-success',
                badge: 'bg-info bg-opacity-10 text-info border-info'
            }));

            // Normalisasi data Servis
            const serviceActivities = serviceRes.data.map(ticket => ({
                type: 'service',
                id: ticket.ticket_number,
                actor: ticket.technician.name, // Atau nama customer jika lebih relevan
                date: new Date(ticket.timestamps.completed_at || ticket.timestamps.created_at),
                amount: ticket.total_cost || 0,
                status: ticket.status === 'Picked_Up' ? 'Diambil' : 'Selesai',
                icon: 'bi-tools',
                color: 'text-warning', // Warna oranye untuk servis
                badge: 'bg-success text-white'
            }));

            // Gabungkan dan Sortir berdasarkan Tanggal Terbaru (Descending)
            const allActivities = [...retailActivities, ...serviceActivities]
                .sort((a, b) => b.date - a.date)
                .slice(0, 10); // Ambil 10 teratas setelah digabung

            if (allActivities.length === 0) {
                container.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-inbox fs-1 opacity-50"></i><p class="mt-3 fw-semibold">Belum ada aktivitas baru</p></div>`;
                return;
            }

            // Render Gabungan
            container.innerHTML = `
                <div class="list-group list-group-flush">
                    ${allActivities.map(act => `
                        <div class="list-group-item px-4 py-3">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 class="mb-1 fw-bold ${act.type === 'service' ? 'text-dark' : 'text-primary'}">
                                        <i class="bi ${act.icon} me-2 ${act.color}"></i>#${act.id}
                                    </h6>
                                    <small class="text-muted d-block">
                                        <i class="bi bi-person-circle me-1"></i>${act.actor}
                                    </small>
                                    <small class="text-muted">
                                        <i class="bi bi-clock me-1"></i>${act.date.toLocaleString('id-ID')}
                                    </small>
                                </div>
                                <div class="text-end">
                                    <strong class="text-dark fs-6">${formatCurrency(act.amount)}</strong>
                                    <br>
                                    <span class="badge ${act.badge} border border-opacity-25 mt-1">${act.status}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="p-4 text-center text-danger">Gagal memuat aktivitas</div>`;
        }
    }
}

export default Dashboard;