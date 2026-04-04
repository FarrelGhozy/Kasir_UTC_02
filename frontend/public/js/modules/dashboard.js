// public/js/modules/dashboard.js - Modul Ringkasan Dasbor (FIXED: Gabungan Aktivitas)

import api, { formatCurrency, showError } from '../api.js';

class Dashboard {
    constructor() {
        this.stats = null;
        this.customerChart = null;
        this.incomeChart = null;
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
                                    <div class="stat-value fs-4 fw-bold skeleton skeleton-text" id="stat-revenue" style="min-width:120px;">&nbsp;</div>
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
                                    <div class="stat-value fs-4 fw-bold text-success skeleton skeleton-text" id="stat-transactions" style="min-width:60px;">&nbsp;</div>
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
                                    <div class="stat-value fs-4 fw-bold text-warning skeleton skeleton-text" id="stat-services" style="min-width:60px;">&nbsp;</div>
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
                                    <div class="stat-value fs-4 fw-bold text-danger skeleton skeleton-text" id="stat-low-stock" style="min-width:60px;">&nbsp;</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-4 mb-4">
                <div class="col-lg-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 fw-bold"><i class="bi bi-people me-2"></i>Pelanggan Masuk (30 Hari)</h5>
                            <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle" id="monthly-customer-trend">Menghitung...</span>
                        </div>
                        <div class="card-body">
                            <canvas id="customer-monthly-chart" height="180"></canvas>
                        </div>
                    </div>
                </div>

                <div class="col-lg-6">
                    <div class="card border-0 shadow-sm h-100">
                        <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 fw-bold"><i class="bi bi-graph-up-arrow me-2"></i>Penghasilan 1 Bulan</h5>
                            <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle" id="monthly-income-trend">Menghitung...</span>
                        </div>
                        <div class="card-body">
                            <canvas id="income-monthly-chart" height="180"></canvas>
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
            const revenueEl = document.getElementById('stat-revenue');
            revenueEl.classList.remove('skeleton', 'skeleton-text');
            revenueEl.textContent = formatCurrency(dailyReport.data.total_revenue);

            const txEl = document.getElementById('stat-transactions');
            txEl.classList.remove('skeleton', 'skeleton-text');
            txEl.textContent = dailyReport.data.retail_sales.transactions;

            const services = await api.getServiceTickets({ 
                status: 'Queue,Diagnosing,Waiting_Part,In_Progress' 
            });
            const activeServices = services.data.filter(t => t.status !== 'Cancelled' && t.status !== 'Completed' && t.status !== 'Picked_Up');
            const svcEl = document.getElementById('stat-services');
            svcEl.classList.remove('skeleton', 'skeleton-text');
            svcEl.textContent = activeServices.length;

            // 2. Load Tabel
            await this.loadLowStock();
            await this.loadRecentActivity();
            await this.loadMonthlyCharts();

        } catch (error) {
            console.error('Gagal memuat data dasbor:', error);
            // Remove skeleton classes on error
            ['stat-revenue', 'stat-transactions', 'stat-services', 'stat-low-stock'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.classList.remove('skeleton', 'skeleton-text'); el.textContent = '-'; }
            });
            showError('app-content', 'Gagal memuat data dasbor. Pastikan server backend berjalan.');
        }
    }

    getLastThirtyDaysRange() {
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const start = new Date();
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);

        return {
            start,
            end,
            startISO: start.toISOString().split('T')[0],
            endISO: end.toISOString().split('T')[0]
        };
    }

    buildDailyBuckets(startDate, totalDays = 30) {
        const buckets = [];
        for (let i = 0; i < totalDays; i += 1) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            buckets.push({
                key: date.toISOString().slice(0, 10),
                label: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
                customers: 0,
                income: 0
            });
        }
        return buckets;
    }

    calculateTrendBadge(elementId, currentSevenDays, previousSevenDays, label) {
        const trendEl = document.getElementById(elementId);
        if (!trendEl) return;

        if (previousSevenDays <= 0 && currentSevenDays <= 0) {
            trendEl.className = 'badge bg-secondary-subtle text-secondary border border-secondary-subtle';
            trendEl.textContent = `${label}: Stabil`;
            return;
        }

        if (previousSevenDays <= 0 && currentSevenDays > 0) {
            trendEl.className = 'badge bg-success-subtle text-success border border-success-subtle';
            trendEl.textContent = `${label}: ↑ Naik`;
            return;
        }

        const diff = currentSevenDays - previousSevenDays;
        const percent = Math.abs((diff / previousSevenDays) * 100).toFixed(1);

        if (diff > 0) {
            trendEl.className = 'badge bg-success-subtle text-success border border-success-subtle';
            trendEl.textContent = `${label}: ↑ ${percent}%`;
        } else if (diff < 0) {
            trendEl.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
            trendEl.textContent = `${label}: ↓ ${percent}%`;
        } else {
            trendEl.className = 'badge bg-secondary-subtle text-secondary border border-secondary-subtle';
            trendEl.textContent = `${label}: → Stabil`;
        }
    }

    renderMonthlyCustomerChart(labels, values) {
        const canvas = document.getElementById('customer-monthly-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        const maxCustomers = Math.max(...values, 0);
        const customerAxisMax = Math.max(5, maxCustomers + 1);

        if (this.customerChart) {
            this.customerChart.destroy();
        }

        this.customerChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Jumlah Pelanggan',
                    data: values,
                    backgroundColor: 'rgba(13, 110, 253, 0.25)',
                    borderColor: 'rgba(13, 110, 253, 1)',
                    borderWidth: 1.2,
                    borderRadius: 6,
                    maxBarThickness: 14
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8 }
                    },
                    y: {
                        beginAtZero: true,
                        max: customerAxisMax,
                        ticks: {
                            precision: 0,
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderMonthlyIncomeChart(labels, values) {
        const canvas = document.getElementById('income-monthly-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        const maxIncome = Math.max(...values, 0);
        const incomeAxisMax = Math.max(2000000, Math.ceil(maxIncome / 500000) * 500000);

        if (this.incomeChart) {
            this.incomeChart.destroy();
        }

        this.incomeChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Penghasilan',
                    data: values,
                    borderColor: 'rgba(25, 135, 84, 1)',
                    backgroundColor: 'rgba(25, 135, 84, 0.15)',
                    fill: true,
                    pointRadius: 2.5,
                    pointHoverRadius: 4,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => formatCurrency(ctx.raw || 0)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8 }
                    },
                    y: {
                        beginAtZero: true,
                        max: incomeAxisMax,
                        ticks: {
                            stepSize: 500000,
                            callback: (value) => {
                                const numeric = Number(value) || 0;
                                if (numeric >= 1000000) return `Rp ${(numeric / 1000000).toFixed(1)} jt`;
                                return `Rp ${(numeric / 1000).toFixed(0)} rb`;
                            }
                        }
                    }
                }
            }
        });
    }

    async loadMonthlyCharts() {
        const { start, startISO, endISO } = this.getLastThirtyDaysRange();
        const buckets = this.buildDailyBuckets(start, 30);
        const bucketMap = new Map(buckets.map(b => [b.key, b]));

        try {
            const [transactionsRes, servicesRes] = await Promise.all([
                api.getTransactions({ start_date: startISO, end_date: endISO, limit: 500 }),
                api.getServiceTickets({ start_date: startISO, end_date: endISO, limit: 500 })
            ]);

            const transactions = Array.isArray(transactionsRes?.data) ? transactionsRes.data : [];
            const services = Array.isArray(servicesRes?.data) ? servicesRes.data : [];

            transactions.forEach((txn) => {
                const dateKey = new Date(txn.date).toISOString().slice(0, 10);
                const bucket = bucketMap.get(dateKey);
                if (!bucket) return;
                bucket.customers += 1;
                bucket.income += Number(txn.grand_total || 0);
            });

            services.forEach((ticket) => {
                const createdKey = new Date(ticket?.timestamps?.created_at).toISOString().slice(0, 10);
                const createdBucket = bucketMap.get(createdKey);
                if (createdBucket) {
                    createdBucket.customers += 1;
                }

                const isRevenueTicket = ticket.status === 'Completed' || ticket.status === 'Picked_Up';
                const completedAt = ticket?.timestamps?.completed_at;
                if (!isRevenueTicket || !completedAt) return;

                const incomeKey = new Date(completedAt).toISOString().slice(0, 10);
                const incomeBucket = bucketMap.get(incomeKey);
                if (!incomeBucket) return;
                incomeBucket.income += Number(ticket.total_cost || 0);
            });

            const labels = buckets.map(b => b.label);
            const customerValues = buckets.map(b => b.customers);
            const incomeValues = buckets.map(b => b.income);

            const currentCustomerSevenDays = customerValues.slice(-7).reduce((sum, val) => sum + val, 0);
            const previousCustomerSevenDays = customerValues.slice(-14, -7).reduce((sum, val) => sum + val, 0);
            const currentSevenDays = incomeValues.slice(-7).reduce((sum, val) => sum + val, 0);
            const previousSevenDays = incomeValues.slice(-14, -7).reduce((sum, val) => sum + val, 0);

            this.calculateTrendBadge('monthly-customer-trend', currentCustomerSevenDays, previousCustomerSevenDays, 'Pelanggan');
            this.calculateTrendBadge('monthly-income-trend', currentSevenDays, previousSevenDays, 'Penghasilan');
            this.renderMonthlyCustomerChart(labels, customerValues);
            this.renderMonthlyIncomeChart(labels, incomeValues);
        } catch (error) {
            const trendEl = document.getElementById('monthly-income-trend');
            if (trendEl) {
                trendEl.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
                trendEl.textContent = 'Data gagal dimuat';
            }

            const customerTrendEl = document.getElementById('monthly-customer-trend');
            if (customerTrendEl) {
                customerTrendEl.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
                customerTrendEl.textContent = 'Data gagal dimuat';
            }

            console.error('Gagal memuat grafik bulanan:', error);
        }
    }

    async loadLowStock() {
        const container = document.getElementById('low-stock-container');
        try {
            const response = await api.getLowStockItems();
            const items = response.data;

            const lowStockEl = document.getElementById('stat-low-stock');
            lowStockEl.classList.remove('skeleton', 'skeleton-text');
            lowStockEl.textContent = items.length;

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