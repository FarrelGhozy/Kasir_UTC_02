// public/js/modules/reports.js - Modul Laporan & Analitik

import api, { formatCurrency, formatDate } from '../api.js';

class Reports {
    constructor() {
        this.currentReport = 'daily';
    }

    async render() {
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4">
                <div class="col-12">
                    <div class="card shadow-sm border-0">
                        <div class="card-body">
                            <div class="btn-group w-100" role="group">
                                <button type="button" class="btn btn-outline-primary active" data-report="daily">
                                    <i class="bi bi-calendar-day me-2"></i>Pendapatan Harian
                                </button>
                                <button type="button" class="btn btn-outline-primary" data-report="monthly">
                                    <i class="bi bi-calendar-month me-2"></i>Pendapatan Bulanan
                                </button>
                                <button type="button" class="btn btn-outline-primary" data-report="top-items">
                                    <i class="bi bi-trophy me-2"></i>Barang Terlaris
                                </button>
                                <button type="button" class="btn btn-outline-primary" data-report="performance">
                                    <i class="bi bi-bar-chart me-2"></i>Performa Karyawan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-12">
                    <div id="report-content">
                        </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.loadReport('daily');
    }

    setupEventListeners() {
        document.querySelectorAll('[data-report]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Handle klik pada icon di dalam tombol
                const targetBtn = e.target.closest('button');
                
                document.querySelectorAll('[data-report]').forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
                
                const reportType = targetBtn.getAttribute('data-report');
                this.loadReport(reportType);
            });
        });
    }

    async loadReport(type) {
        this.currentReport = type;
        const container = document.getElementById('report-content');
        
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2 text-muted">Memuat laporan...</p>
            </div>
        `;

        switch(type) {
            case 'daily':
                await this.renderDailyReport(container);
                break;
            case 'monthly':
                await this.renderMonthlyReport(container);
                break;
            case 'top-items':
                await this.renderTopItemsReport(container);
                break;
            case 'performance':
                await this.renderPerformanceReport(container);
                break;
        }
    }

    async renderDailyReport(container) {
        try {
            // Ambil tanggal dari input atau default ke hari ini
            const dateInput = document.getElementById('daily-date');
            const selectedDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
            
            const response = await api.getDailyRevenue(selectedDate);
            const data = response.data;

            container.innerHTML = `
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-white py-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0 fw-bold">Laporan Pendapatan Harian</h5>
                            <input type="date" class="form-control w-auto" id="daily-date" value="${selectedDate}">
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row g-4">
                            <div class="col-md-4">
                                <div class="card bg-primary bg-opacity-10 border-0 h-100">
                                    <div class="card-body text-center">
                                        <div class="mb-2 text-primary"><i class="bi bi-cash-stack fs-1"></i></div>
                                        <h3 class="mt-2 text-primary fw-bold">${formatCurrency(data.total_revenue)}</h3>
                                        <p class="text-muted mb-0 fw-semibold">Total Pendapatan</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-success bg-opacity-10 border-0 h-100">
                                    <div class="card-body text-center">
                                        <div class="mb-2 text-success"><i class="bi bi-cart3 fs-1"></i></div>
                                        <h3 class="mt-2 text-success fw-bold">${formatCurrency(data.retail_sales.revenue)}</h3>
                                        <p class="text-muted mb-0 fw-semibold">Penjualan Ritel</p>
                                        <small class="text-success">${data.retail_sales.transactions} transaksi</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-warning bg-opacity-10 border-0 h-100">
                                    <div class="card-body text-center">
                                        <div class="mb-2 text-warning"><i class="bi bi-wrench fs-1"></i></div>
                                        <h3 class="mt-2 text-warning fw-bold">${formatCurrency(data.service_revenue.revenue)}</h3>
                                        <p class="text-muted mb-0 fw-semibold">Pendapatan Servis</p>
                                        <small class="text-warning">${data.service_revenue.tickets} tiket</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-5">
                            <h6 class="border-bottom pb-3 mb-3 fw-bold">Ringkasan Detail</h6>
                            <table class="table table-hover">
                                <tbody>
                                    <tr>
                                        <td class="text-muted">Tanggal</td>
                                        <td class="fw-bold text-end">${formatDate(response.date)}</td>
                                    </tr>
                                    <tr>
                                        <td class="text-muted">Total Transaksi</td>
                                        <td class="fw-bold text-end">${data.total_transactions}</td>
                                    </tr>
                                    <tr>
                                        <td class="text-muted">Transaksi Ritel</td>
                                        <td class="fw-bold text-end">${data.retail_sales.transactions}</td>
                                    </tr>
                                    <tr>
                                        <td class="text-muted">Tiket Servis Selesai</td>
                                        <td class="fw-bold text-end">${data.service_revenue.tickets}</td>
                                    </tr>
                                    <tr class="table-primary">
                                        <td class="fw-bold">Total Pendapatan Bersih</td>
                                        <td class="fw-bold text-end fs-5">${formatCurrency(data.total_revenue)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Setup listener perubahan tanggal
            document.getElementById('daily-date').addEventListener('change', (e) => {
                // Kita panggil render ulang, tapi pastikan nilai input terjaga
                // Namun, metode renderDailyReport mengambil nilai dari DOM 'daily-date'
                // Jadi kita cukup memanggil ulang fungsi ini
                this.renderDailyReport(container);
            });
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat laporan: ${error.message}</div>`;
        }
    }

    async renderMonthlyReport(container) {
        try {
            // Ambil nilai dari select jika ada, atau gunakan default
            const monthSelect = document.getElementById('month-select');
            const yearSelect = document.getElementById('year-select');

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;

            const year = yearSelect ? parseInt(yearSelect.value) : currentYear;
            const month = monthSelect ? parseInt(monthSelect.value) : currentMonth;

            const response = await api.getMonthlyRevenue(year, month);
            const data = response.data;

            container.innerHTML = `
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-white py-3">
                        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <h5 class="mb-0 fw-bold">Laporan Pendapatan Bulanan</h5>
                            <div>
                                <select class="form-select d-inline-block w-auto me-2" id="month-select">
                                    ${Array.from({length: 12}, (_, i) => {
                                        const m = i + 1;
                                        const monthName = new Date(2000, i).toLocaleString('id-ID', { month: 'long' });
                                        return `<option value="${m}" ${m === month ? 'selected' : ''}>${monthName}</option>`;
                                    }).join('')}
                                </select>
                                <select class="form-select d-inline-block w-auto" id="year-select">
                                    ${[currentYear - 1, currentYear, currentYear + 1].map(y => 
                                        `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row g-4 mb-4">
                            <div class="col-md-4">
                                <div class="card bg-primary bg-opacity-10 border-0 h-100">
                                    <div class="card-body text-center">
                                        <h3 class="text-primary fw-bold">${formatCurrency(data.total_revenue)}</h3>
                                        <p class="text-muted mb-0 fw-semibold">Total Pendapatan</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-success bg-opacity-10 border-0 h-100">
                                    <div class="card-body text-center">
                                        <h3 class="text-success fw-bold">${formatCurrency(data.retail_revenue)}</h3>
                                        <p class="text-muted mb-0 fw-semibold">Penjualan Ritel</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-warning bg-opacity-10 border-0 h-100">
                                    <div class="card-body text-center">
                                        <h3 class="text-warning fw-bold">${formatCurrency(data.service_revenue)}</h3>
                                        <p class="text-muted mb-0 fw-semibold">Pendapatan Servis</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h6 class="border-bottom pb-3 mb-3 fw-bold">Rincian Harian</h6>
                        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                            <table class="table table-striped table-hover table-sm">
                                <thead class="sticky-top bg-light">
                                    <tr>
                                        <th>Tanggal</th>
                                        <th class="text-end">Ritel</th>
                                        <th class="text-end">Servis</th>
                                        <th class="text-end">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(data.daily_breakdown || []).map(day => `
                                        <tr>
                                            <td>${day.day}</td>
                                            <td class="text-end">${formatCurrency(day.retail_revenue)}</td>
                                            <td class="text-end">${formatCurrency(day.service_revenue)}</td>
                                            <td class="text-end fw-bold text-primary">${formatCurrency(day.total_revenue)}</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Tidak ada data transaksi bulan ini</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Setup listeners
            const reloadMonthly = () => this.renderMonthlyReport(container);
            document.getElementById('month-select').addEventListener('change', reloadMonthly);
            document.getElementById('year-select').addEventListener('change', reloadMonthly);
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat laporan bulanan: ${error.message}</div>`;
        }
    }

    async renderTopItemsReport(container) {
        try {
            const response = await api.getTopItems({ limit: 10 });
            const items = response.data;

            container.innerHTML = `
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-white py-3">
                        <h5 class="mb-0 fw-bold">10 Barang Terlaris</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th class="text-center" width="50">#</th>
                                        <th>Nama Barang</th>
                                        <th class="text-center">Terjual (Unit)</th>
                                        <th class="text-end">Total Pendapatan</th>
                                        <th class="text-center">Frekuensi Transaksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map((item, index) => `
                                        <tr>
                                            <td class="text-center"><strong>${index + 1}</strong></td>
                                            <td class="fw-semibold text-primary">${item.item_name}</td>
                                            <td class="text-center"><span class="badge bg-primary rounded-pill">${item.total_qty_sold}</span></td>
                                            <td class="text-end fw-bold">${formatCurrency(item.total_revenue)}</td>
                                            <td class="text-center">${item.times_purchased} kali</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="5" class="text-center py-4 text-muted">Data tidak tersedia</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat data barang terlaris: ${error.message}</div>`;
        }
    }

    async renderPerformanceReport(container) {
        try {
            const [cashierPerf, techPerf] = await Promise.all([
                api.getCashierPerformance(),
                api.getTechnicianPerformance()
            ]);

            container.innerHTML = `
                <div class="row g-4">
                    <div class="col-lg-6">
                        <div class="card shadow-sm border-0 h-100">
                            <div class="card-header bg-success text-white py-3">
                                <h5 class="mb-0"><i class="bi bi-person-badge me-2"></i>Performa Kasir</h5>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-hover mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Nama Kasir</th>
                                                <th class="text-center">Trx</th>
                                                <th class="text-end">Pendapatan</th>
                                                <th class="text-end">Rata-rata/Trx</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(cashierPerf.data || []).map(c => `
                                                <tr>
                                                    <td class="fw-semibold">${c.cashier_name}</td>
                                                    <td class="text-center">${c.total_transactions}</td>
                                                    <td class="text-end">${formatCurrency(c.total_revenue)}</td>
                                                    <td class="text-end small text-muted">${formatCurrency(c.avg_transaction_value)}</td>
                                                </tr>
                                            `).join('') || '<tr><td colspan="4" class="text-center py-3 text-muted">Tidak ada data</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-6">
                        <div class="card shadow-sm border-0 h-100">
                            <div class="card-header bg-warning text-dark py-3">
                                <h5 class="mb-0"><i class="bi bi-wrench me-2"></i>Performa Teknisi</h5>
                            </div>
                            <div class="card-body p-0">
                                <div class="table-responsive">
                                    <table class="table table-hover mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Nama Teknisi</th>
                                                <th class="text-center">Tiket</th>
                                                <th class="text-end">Pendapatan</th>
                                                <th class="text-end">Rata-rata/Tiket</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(techPerf.data || []).map(t => `
                                                <tr>
                                                    <td class="fw-semibold">${t.technician_name}</td>
                                                    <td class="text-center">${t.total_tickets}</td>
                                                    <td class="text-end">${formatCurrency(t.total_revenue)}</td>
                                                    <td class="text-end small text-muted">${formatCurrency(t.avg_ticket_value)}</td>
                                                </tr>
                                            `).join('') || '<tr><td colspan="4" class="text-center py-3 text-muted">Tidak ada data</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat data performa: ${error.message}</div>`;
        }
    }
}

export default Reports;