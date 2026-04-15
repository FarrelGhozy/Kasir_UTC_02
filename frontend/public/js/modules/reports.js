// public/js/modules/reports.js - Modul Laporan & Analitik

import api, { formatCurrency, formatDate, formatDateTime } from '../api.js';
import auth from '../auth.js';

class Reports {
    constructor() {
        this.currentReport = 'daily';
    }

    async render() {
        const content = document.getElementById('app-content');
        const isAdmin = auth.hasRole('admin');
        
        content.innerHTML = `
            <div class="row g-4">
                <div class="col-12">
                    <div class="card shadow-sm border-0">
                        <div class="card-body">
                            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                                <div class="btn-group flex-grow-1" role="group">
                                    <button type="button" class="btn btn-outline-primary active" data-report="daily">
                                        <i class="bi bi-calendar-day me-2"></i>Pendapatan Harian
                                    </button>
                                    <button type="button" class="btn btn-outline-primary" data-report="monthly">
                                        <i class="bi bi-calendar-month me-2"></i>Pendapatan Bulanan
                                    </button>
                                    <button type="button" class="btn btn-outline-primary" data-report="top-items">
                                        <i class="bi bi-trophy me-2"></i>Barang Terlaris ${!isAdmin ? '<i class="bi bi-lock-fill ms-1 small opacity-50"></i>' : ''}
                                    </button>
                                    <button type="button" class="btn btn-outline-primary" data-report="performance">
                                        <i class="bi bi-bar-chart me-2"></i>Performa Karyawan ${!isAdmin ? '<i class="bi bi-lock-fill ms-1 small opacity-50"></i>' : ''}
                                    </button>
                                </div>
                                ${isAdmin ? `
                                <button type="button" class="btn btn-success shadow-sm" id="download-full-recap-btn">
                                    <i class="bi bi-file-earmark-pdf-fill me-2"></i>Unduh Rekap Lengkap
                                </button>
                                ` : ''}
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
                const targetBtn = e.target.closest('button');
                const reportType = targetBtn.getAttribute('data-report');
                
                if ((reportType === 'top-items' || reportType === 'performance') && !auth.hasRole('admin')) {
                    const container = document.getElementById('report-content');
                    container.innerHTML = `
                        <div class="card shadow-sm border-0 mt-4">
                            <div class="card-body text-center py-5">
                                <i class="bi bi-shield-lock text-warning display-1"></i>
                                <h3 class="mt-4 fw-bold">Akses Terbatas</h3>
                                <p class="text-muted">Maaf, laporan <strong>${targetBtn.textContent.trim()}</strong> hanya dapat diakses oleh Administrator.</p>
                                <button class="btn btn-primary mt-2" onclick="document.querySelector('[data-report=daily]').click()">
                                    <i class="bi bi-arrow-left me-2"></i>Kembali ke Laporan Umum
                                </button>
                            </div>
                        </div>
                    `;
                    document.querySelectorAll('[data-report]').forEach(b => b.classList.remove('active'));
                    targetBtn.classList.add('active');
                    return;
                }

                document.querySelectorAll('[data-report]').forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
                
                this.loadReport(reportType);
            });
        });

        const recapBtn = document.getElementById('download-full-recap-btn');
        if (recapBtn) {
            recapBtn.addEventListener('click', () => this.downloadFullRecap());
        }
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

            const dateInputEl = document.getElementById('daily-date');
            if (dateInputEl) {
                dateInputEl.addEventListener('change', (e) => {
                    this.renderDailyReport(container);
                });
            }
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat laporan: ${error.message}</div>`;
        }
    }

    async renderMonthlyReport(container) {
        try {
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

            const reloadMonthly = () => this.renderMonthlyReport(container);
            const monthSelectEl = document.getElementById('month-select');
            const yearSelectEl = document.getElementById('year-select');
            if (monthSelectEl) monthSelectEl.addEventListener('change', reloadMonthly);
            if (yearSelectEl) yearSelectEl.addEventListener('change', reloadMonthly);
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

    async downloadFullRecap() {
        const btn = document.getElementById('download-full-recap-btn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menyiapkan Rekap...';

        try {
            const response = await api.get('/reports/full-recap');
            const data = response.data;
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
            const fileName = `RekapanUTC_${dateStr}`;

            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            const doc = iframe.contentWindow.document;
            
            doc.open();
            doc.write(`
                <html>
                <head>
                    <title>${fileName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                        .section { margin-bottom: 30px; page-break-inside: avoid; }
                        .section-title { background: #f0f0f0; padding: 8px; font-weight: bold; border-left: 5px solid #007bff; margin-bottom: 10px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                        th { background-color: #f8f9fa; font-weight: bold; }
                        .text-right { text-align: right; }
                        .summary-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
                        .summary-item { border: 1px solid #ddd; padding: 10px; border-radius: 5px; flex: 1; min-width: 150px; text-align: center; }
                        .summary-item strong { display: block; font-size: 14px; margin-top: 5px; }
                        .badge { padding: 2px 5px; border-radius: 3px; font-size: 9px; font-weight: bold; }
                        .bg-success { background: #d4edda; color: #155724; }
                        .bg-primary { background: #cce5ff; color: #004085; }
                        .bg-warning { background: #fff3cd; color: #856404; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>REKAPITULASI BENGKEL UTC</h1>
                        <p>Laporan Backup Data Lengkap - Dicetak pada: ${formatDateTime(new Date())}</p>
                    </div>

                    <div class="section">
                        <div class="section-title">RINGKASAN WORKSHOP</div>
                        <div class="summary-grid">
                            <div class="summary-item">Items Inventaris<strong>${data.summary.inventory_items}</strong></div>
                            <div class="summary-item">Nilai Inventaris<strong>${formatCurrency(data.summary.total_inventory_value)}</strong></div>
                            <div class="summary-item">Total Servis<strong>${data.summary.total_service_tickets}</strong></div>
                            <div class="summary-item">Pendapatan Servis<strong>${formatCurrency(data.summary.total_service_revenue)}</strong></div>
                            <div class="summary-item">Transaksi Ritel<strong>${data.summary.total_retail_transactions}</strong></div>
                            <div class="summary-item">Pendapatan Ritel<strong>${formatCurrency(data.summary.total_retail_revenue)}</strong></div>
                            <div class="summary-item" style="border-color: #007bff; background: #e7f1ff;">
                                <strong>TOTAL PENDAPATAN</strong>
                                <strong style="font-size: 18px; color: #007bff;">${formatCurrency(data.summary.grand_total_revenue)}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">DATA INVENTARIS (STOK GUDANG)</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Nama Barang</th>
                                    <th>Kategori</th>
                                    <th>HPP</th>
                                    <th>Harga Jual</th>
                                    <th>Stok</th>
                                    <th>Nilai Stok (HPP)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.inventory.map(i => `
                                    <tr>
                                        <td>${i.sku}</td>
                                        <td>${i.name}</td>
                                        <td>${i.category}</td>
                                        <td>${formatCurrency(i.purchase_price)}</td>
                                        <td>${formatCurrency(i.selling_price)}</td>
                                        <td>${i.stock}</td>
                                        <td>${formatCurrency(i.stock * i.purchase_price)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="section">
                        <div class="section-title">DATA DETAIL SERVIS (PELANGGAN & WORKSHOP)</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Tiket</th>
                                    <th>Tgl Masuk</th>
                                    <th>Nama Pelanggan</th>
                                    <th>No. HP</th>
                                    <th>Perangkat</th>
                                    <th>Keluhan</th>
                                    <th>Teknisi</th>
                                    <th>Status</th>
                                    <th>Biaya Jasa</th>
                                    <th>Total Biaya</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.services.map(s => `
                                    <tr>
                                        <td>${s.ticket_number}</td>
                                        <td>${formatDateTime(s.timestamps.created_at)}</td>
                                        <td>${s.customer.name} (${s.customer.type})</td>
                                        <td>${s.customer.phone}</td>
                                        <td>${s.device.type} ${s.device.brand || ''} ${s.device.model || ''}</td>
                                        <td>${s.device.symptoms}</td>
                                        <td>${s.technician.name}</td>
                                        <td><span class="badge ${s.status === 'Completed' || s.status === 'Picked_Up' ? 'bg-success' : 'bg-warning'}">${s.status}</span></td>
                                        <td>${formatCurrency(s.service_fee)}</td>
                                        <td>${formatCurrency(s.total_cost)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="section">
                        <div class="section-title">DATA TRANSAKSI RITEL (POS)</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Invoice</th>
                                    <th>Tanggal</th>
                                    <th>Kasir</th>
                                    <th>Barang</th>
                                    <th>Metode</th>
                                    <th>Total Akhir</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.transactions.map(t => `
                                    <tr>
                                        <td>${t.invoice_no}</td>
                                        <td>${formatDateTime(t.date)}</td>
                                        <td>${t.cashier_name}</td>
                                        <td>${t.items.map(i => `${i.name} (x${i.qty})`).join(', ')}</td>
                                        <td>${t.payment_method}</td>
                                        <td class="text-right"><strong>${formatCurrency(t.grand_total)}</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 50px; text-align: right; font-style: italic; font-size: 10px;">
                        Dicetak otomatis oleh Sistem Kasir Bengkel UTC - Administrator Access
                    </div>
                </body>
                </html>
            `);
            doc.close();

            // Beri waktu browser memproses render HTML
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                
                // Bersihkan
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }, 1000);
            }, 500);

        } catch (error) {
            console.error('Recap download error:', error);
            alert('Gagal mengunduh rekap: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
}

export default Reports;