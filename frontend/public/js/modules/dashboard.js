// public/js/modules/dashboard.js - Modul Ringkasan Dasbor (FIXED: Gabungan Aktivitas)

import api, { formatCurrency, showError, loadScript, escapeHTML, toLocalDateString } from '../api.js';

class Dashboard {
    constructor() {
        this.stats = null;
        this.customerChart = null;
        this.incomeChart = null;
        this.technicianChart = null;
        this.serviceStatusChart = null;
        this.servicePeriod = '30';
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

            <div class="row g-4 mb-4">
                <div class="col-12">
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-white py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <h5 class="mb-0 fw-bold"><i class="bi bi-tools me-2"></i>Informasi Pelayanan <small class="text-muted fw-normal" id="service-period-label"></small></h5>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle d-none" id="service-top-badge"></span>
                                <select class="form-select form-select-sm w-auto" id="service-period-filter" aria-label="Periode pelayanan">
                                    <option value="7">7 hari terakhir</option>
                                    <option value="30" selected>30 hari terakhir</option>
                                    <option value="90">90 hari terakhir</option>
                                    <option value="month">Bulan ini</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="alert alert-warning d-none py-2 small mb-3" id="service-truncated-warning" role="alert"></div>
                            <div class="row g-4">
                                <div class="col-lg-6">
                                    <h6 class="fw-bold mb-1"><i class="bi bi-bar-chart-fill me-2 text-primary"></i>Performa Teknisi <small class="text-muted fw-normal">(tiket ditangani)</small></h6>
                                    <p class="text-muted small mb-2">Jumlah tiket yang dibuat pada periode ini per teknisi (di luar yang dibatalkan).</p>
                                    <div style="position: relative; min-height: 260px;">
                                        <canvas id="technician-count-chart" height="220"></canvas>
                                    </div>
                                </div>
                                <div class="col-lg-6">
                                    <h6 class="fw-bold mb-1"><i class="bi bi-pie-chart-fill me-2 text-success"></i>Status Servis <small class="text-muted fw-normal">(bottleneck)</small></h6>
                                    <p class="text-muted small mb-2">Proporsi status tiket yang dibuat pada periode ini.</p>
                                    <div style="position: relative; min-height: 260px;">
                                        <canvas id="service-status-chart" height="220"></canvas>
                                    </div>
                                </div>
                            </div>
                            <div class="mt-4">
                                <h6 class="fw-bold mb-1"><i class="bi bi-trophy-fill me-2 text-warning"></i>Ranking Penghasilan per Teknisi</h6>
                                <p class="text-muted small mb-2">Diurutkan dari penghasilan terbesar. Pendapatan hanya dari tiket <span class="badge bg-success-subtle text-success border border-success-subtle">Selesai</span> / <span class="badge bg-success-subtle text-success border border-success-subtle">Diambil</span> yang dibuat pada periode ini.</p>
                                <div class="table-responsive" id="technician-ranking-container" style="max-height: 320px; overflow-y: auto;">
                                    <div class="text-center py-4">
                                        <div class="spinner-border text-primary"></div>
                                    </div>
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
            // 1. Load Data Statistik — parallel
            const [dailyReport, servicesRes] = await Promise.all([
                api.getDailyRevenue(),
                api.getServiceTickets({ status: 'Queue,Diagnosing,Waiting_Part,In_Progress' })
            ]);

            const revenueEl = document.getElementById('stat-revenue');
            revenueEl.classList.remove('skeleton', 'skeleton-text');
            revenueEl.textContent = formatCurrency(dailyReport.data.total_revenue);

            const txEl = document.getElementById('stat-transactions');
            txEl.classList.remove('skeleton', 'skeleton-text');
            txEl.textContent = dailyReport.data.retail_sales.transactions;

            const activeServices = servicesRes.data.filter(t => t.status !== 'Cancelled' && t.status !== 'Completed' && t.status !== 'Picked_Up');
            const svcEl = document.getElementById('stat-services');
            svcEl.classList.remove('skeleton', 'skeleton-text');
            svcEl.textContent = activeServices.length;

            // 2. Load Tabel — parallel
            this.setupServiceFilterListener();
            await Promise.all([
                this.loadLowStock(),
                this.loadRecentActivity(),
                this.loadMonthlyCharts(),
                this.loadServiceInsights()
            ]);

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
            startLocal: toLocalDateString(start),
            endLocal: toLocalDateString(end)
        };
    }

    buildDailyBuckets(startLocal, totalDays = 30) {
        const buckets = [];
        const startDate = new Date(startLocal + 'T00:00:00');
        for (let i = 0; i < totalDays; i += 1) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            buckets.push({
                key: toLocalDateString(date),
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
        const stepSize = Math.max(1, Math.ceil(maxCustomers / 8));
        const customerAxisMax = Math.ceil(maxCustomers * 1.2 / stepSize) * stepSize || 5;

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
        const stepSize = Math.max(10000, Math.ceil(maxIncome / 6 / 10000) * 10000);
        const incomeAxisMax = Math.ceil(maxIncome * 1.3 / stepSize) * stepSize || stepSize;

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
                            stepSize: stepSize,
                            callback: (value) => {
                                const numeric = Number(value) || 0;
                                if (numeric >= 1000000) return `Rp ${(numeric / 1000000).toFixed(1)} jt`;
                                if (numeric >= 1000) return `Rp ${(numeric / 1000).toFixed(0)} rb`;
                                return `Rp ${numeric}`;
                            }
                        }
                    }
                }
            }
        });
    }

    async loadMonthlyCharts() {
        if (typeof Chart === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js');
        }
        if (typeof Chart === 'undefined') {
            console.error('Chart.js gagal dimuat dari CDN');
            return;
        }
        const { startLocal, endLocal } = this.getLastThirtyDaysRange();
        const buckets = this.buildDailyBuckets(startLocal, 30);
        const bucketMap = new Map(buckets.map(b => [b.key, b]));

        try {
            const [transactionsRes, servicesRes] = await Promise.all([
                api.getTransactions({ start_date: startLocal, end_date: endLocal, limit: 500 }),
                api.getServiceTickets({ start_date: startLocal, end_date: endLocal, limit: 500 })
            ]);

            const transactions = Array.isArray(transactionsRes?.data) ? transactionsRes.data : [];
            const services = Array.isArray(servicesRes?.data) ? servicesRes.data : [];

            transactions.forEach((txn) => {
                const dateKey = toLocalDateString(txn.date);
                const bucket = bucketMap.get(dateKey);
                if (!bucket) return;
                bucket.customers += 1;
                bucket.income += Number(txn.grand_total || 0);
            });

            services.forEach((ticket) => {
                const createdKey = toLocalDateString(ticket?.history?.created_at || ticket.createdAt);
                const createdBucket = bucketMap.get(createdKey);
                if (createdBucket) {
                    createdBucket.customers += 1;
                }

                const isRevenueTicket = ticket.status === 'Completed' || ticket.status === 'Picked_Up';
                const completedAt = ticket?.history?.completed_at;
                if (!isRevenueTicket || !completedAt) return;

                const incomeKey = toLocalDateString(completedAt);
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

    // --- INFORMASI PELAYANAN (Performa Teknisi + Status + Ranking) ---
    setupServiceFilterListener() {
        const select = document.getElementById('service-period-filter');
        if (select) {
            select.value = this.servicePeriod;
            select.addEventListener('change', (e) => {
                this.servicePeriod = e.target.value;
                this.loadServiceInsights();
            });
        }
    }

    getServiceRange() {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        let start;
        let label;

        if (this.servicePeriod === 'month') {
            start = new Date(end.getFullYear(), end.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            label = start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        } else {
            const days = parseInt(this.servicePeriod, 10) || 30;
            start = new Date(end);
            start.setDate(end.getDate() - (days - 1));
            start.setHours(0, 0, 0, 0);
            label = `${days} hari terakhir`;
        }

        return {
            startLocal: toLocalDateString(start),
            endLocal: toLocalDateString(end),
            label
        };
    }

    renderTechnicianCountChart(names, handledValues, finishedValues) {
        const canvas = document.getElementById('technician-count-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (this.technicianChart) {
            this.technicianChart.destroy();
            this.technicianChart = null;
        }
        if (names.length === 0) return;

        this.technicianChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: names,
                datasets: [
                    {
                        label: 'Ditangani',
                        data: handledValues,
                        backgroundColor: 'rgba(13, 110, 253, 0.75)',
                        borderColor: 'rgba(13, 110, 253, 1)',
                        borderWidth: 1,
                        borderRadius: 6,
                        maxBarThickness: 22
                    },
                    {
                        label: 'Selesai/Diambil',
                        data: finishedValues,
                        backgroundColor: 'rgba(25, 135, 84, 0.75)',
                        borderColor: 'rgba(25, 135, 84, 1)',
                        borderWidth: 1,
                        borderRadius: 6,
                        maxBarThickness: 22
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'bottom' }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0, stepSize: 1 }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    renderServiceStatusChart(statusCounts) {
        const canvas = document.getElementById('service-status-chart');
        if (!canvas || typeof Chart === 'undefined') return;

        if (this.serviceStatusChart) {
            this.serviceStatusChart.destroy();
            this.serviceStatusChart = null;
        }

        const order = ['Queue', 'Diagnosing', 'Waiting_Part', 'In_Progress', 'Completed', 'Picked_Up', 'Cancelled'];
        const meta = {
            Queue: { label: 'Antre', color: '#6c757d' },
            Diagnosing: { label: 'Diagnosis', color: '#0d6efd' },
            Waiting_Part: { label: 'Tunggu Part', color: '#fd7e14' },
            In_Progress: { label: 'Dikerjakan', color: '#ffc107' },
            Completed: { label: 'Selesai', color: '#198754' },
            Picked_Up: { label: 'Diambil', color: '#20c997' },
            Cancelled: { label: 'Batal', color: '#dc3545' }
        };

        const labels = [];
        const values = [];
        const colors = [];
        order.forEach((key) => {
            const count = statusCounts[key] || 0;
            if (count > 0) {
                labels.push(`${meta[key].label} (${count})`);
                values.push(count);
                colors.push(meta[key].color);
            }
        });

        if (values.length === 0) return;

        this.serviceStatusChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: { display: true, position: 'bottom' }
                }
            }
        });
    }

    renderTechnicianRanking(rows) {
        const container = document.getElementById('technician-ranking-container');
        if (!container) return;

        if (rows.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-4"><i class="bi bi-inbox fs-1 opacity-50"></i><p class="mt-2 mb-0 fw-semibold">Belum ada tiket servis pada periode ini</p></div>`;
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];
        const maxRevenue = Math.max(...rows.map(r => r.revenue), 0);

        container.innerHTML = `
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light sticky-top">
                    <tr>
                        <th class="text-center" style="width: 56px;">#</th>
                        <th>Teknisi</th>
                        <th class="text-center">Ditangani</th>
                        <th class="text-center">Selesai</th>
                        <th class="text-end">Pendapatan</th>
                        <th class="text-end d-none d-md-table-cell">Rata-rata/Tiket</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((row, index) => {
                        const isTop = index === 0;
                        const isBottom = rows.length > 1 && index === rows.length - 1;
                        const barWidth = maxRevenue > 0 ? Math.max(4, Math.round((row.revenue / maxRevenue) * 100)) : 0;
                        return `
                        <tr class="${isTop ? 'table-warning' : ''}">
                            <td class="text-center fs-5">${medals[index] || `<span class="text-muted fw-bold">${index + 1}</span>`}</td>
                            <td>
                                <div class="fw-bold text-dark">${escapeHTML(row.name)} ${isTop ? '<span class="badge bg-warning text-dark ms-1">Top</span>' : ''} ${isBottom ? '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle ms-1">Perlu perhatian</span>' : ''}</div>
                                <div class="progress mt-1" style="height: 5px; max-width: 180px;">
                                    <div class="progress-bar ${isTop ? 'bg-warning' : 'bg-success'}" style="width: ${barWidth}%"></div>
                                </div>
                            </td>
                            <td class="text-center"><span class="badge bg-primary rounded-pill">${row.handled}</span></td>
                            <td class="text-center"><span class="badge bg-success rounded-pill">${row.finished}</span></td>
                            <td class="text-end fw-bold">${formatCurrency(row.revenue)}</td>
                            <td class="text-end small text-muted d-none d-md-table-cell">${formatCurrency(row.finished > 0 ? Math.round(row.revenue / row.finished) : 0)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    async loadServiceInsights() {
        const labelEl = document.getElementById('service-period-label');
        const badgeEl = document.getElementById('service-top-badge');
        const warningEl = document.getElementById('service-truncated-warning');

        if (typeof Chart === 'undefined') {
            try {
                await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js');
            } catch (err) {
                console.error('Chart.js gagal dimuat untuk grafik pelayanan:', err);
            }
        }
        if (typeof Chart === 'undefined') return;

        const { startLocal, endLocal, label } = this.getServiceRange();
        if (labelEl) labelEl.textContent = `(${label})`;
        if (badgeEl) badgeEl.classList.add('d-none');
        if (warningEl) warningEl.classList.add('d-none');

        try {
            const response = await api.getServiceTickets({ start_date: startLocal, end_date: endLocal, limit: 1000 });
            const tickets = Array.isArray(response?.data) ? response.data : [];
            const totalRecords = response?.pagination?.total_records ?? tickets.length;
            if (warningEl && totalRecords > tickets.length) {
                warningEl.textContent = `Menampilkan ${tickets.length} dari ${totalRecords} tiket pada periode ini — persempit periode untuk hasil lebih akurat.`;
                warningEl.classList.remove('d-none');
            }

            // Agregasi per teknisi + status (satu loop, satu request)
            const perTech = new Map();
            const statusCounts = {};
            tickets.forEach((ticket) => {
                const status = ticket?.status || 'Queue';
                statusCounts[status] = (statusCounts[status] || 0) + 1;

                const name = (ticket?.technician?.name || 'Tanpa Teknisi').trim() || 'Tanpa Teknisi';
                if (!perTech.has(name)) perTech.set(name, { name, handled: 0, finished: 0, revenue: 0 });
                const row = perTech.get(name);

                if (status !== 'Cancelled') row.handled += 1;
                if (status === 'Completed' || status === 'Picked_Up') {
                    row.finished += 1;
                    row.revenue += Number(ticket?.total_cost || 0);
                }
            });

            const sortedByHandled = [...perTech.values()]
                .filter(r => r.handled > 0)
                .sort((a, b) => b.handled - a.handled || b.revenue - a.revenue)
                .slice(0, 10);
            const sortedByRevenue = [...perTech.values()]
                .filter(r => r.handled > 0 || r.finished > 0)
                .sort((a, b) => b.revenue - a.revenue || b.finished - a.finished)
                .slice(0, 10);

            this.renderTechnicianCountChart(
                sortedByHandled.map(r => r.name),
                sortedByHandled.map(r => r.handled),
                sortedByHandled.map(r => r.finished)
            );
            this.renderServiceStatusChart(statusCounts);
            this.renderTechnicianRanking(sortedByRevenue);

            if (badgeEl && sortedByRevenue.length > 0) {
                badgeEl.textContent = `Top: ${sortedByRevenue[0].name} (${formatCurrency(sortedByRevenue[0].revenue)})`;
                badgeEl.classList.remove('d-none');
            }
        } catch (error) {
            console.error('Gagal memuat informasi pelayanan:', error);
            const container = document.getElementById('technician-ranking-container');
            if (container) container.innerHTML = `<div class="alert alert-danger mb-0">Gagal memuat data pelayanan: ${escapeHTML(error.message)}</div>`;
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
                                    <h6 class="mb-1 fw-bold text-dark">${escapeHTML(item.name)}</h6>
                                    <small class="text-muted">SKU: ${escapeHTML(item.sku)}</small>
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
                date: new Date(ticket.history?.completed_at || ticket.history?.created_at || ticket.createdAt),
                amount: ticket.total_cost || 0,
                status: ticket.status === 'Picked_Up' ? 'Diambil' : 'Selesai',
                icon: 'bi-wrench',
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
                                        <i class="bi bi-person-circle me-1"></i>${escapeHTML(act.actor)}
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