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

            <!-- Modal Pilih Rentang Rekap -->
            <div class="modal fade" id="recapRangeModal" tabindex="-1">
                <div class="modal-dialog modal-sm modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">Pilih Rentang Data</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-4">
                            <div class="d-grid gap-3">
                                <button class="btn btn-outline-primary py-3 fw-bold" onclick="reportsModule.processFullRecap('30days')">
                                    <i class="bi bi-calendar3 me-2"></i>1 Bulan Terakhir
                                </button>
                                <button class="btn btn-outline-dark py-3 fw-bold" onclick="reportsModule.processFullRecap('all')">
                                    <i class="bi bi-infinity me-2"></i>Semua Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Hidden canvas for chart generation -->
            <div style="position: absolute; left: -9999px;">
                <canvas id="hiddenPieChart" width="400" height="400"></canvas>
                <canvas id="hiddenLineChart" width="800" height="400"></canvas>
            </div>
        `;

        window.reportsModule = this;
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

    downloadFullRecap() {
        const modal = new bootstrap.Modal(document.getElementById('recapRangeModal'));
        modal.show();
    }

    async processFullRecap(range) {
        const modalEl = document.getElementById('recapRangeModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        const btn = document.getElementById('download-full-recap-btn');
        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menghasilkan PDF...';

        try {
            const response = await api.get(`/reports/full-recap?range=${range}`);
            const data = response.data;
            const adminName = auth.getUser()?.name || 'Administrator';
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // 1. Header (KOP Laporan)
            doc.setFillColor(13, 110, 253); // Primary color
            doc.rect(0, 0, pageWidth, 40, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('BENGKEL UTC', 15, 18);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text('Sistem Manajemen Bengkel & Workshop Terpadu', 15, 25);
            doc.text('Jl. Raya Unida No. 1, Ponorogo, Jawa Timur', 15, 30);
            
            doc.setFontSize(14);
            const title = range === '30days' ? 'REKAPITULASI DATA (30 HARI TERAKHIR)' : 'REKAPITULASI SELURUH DATA';
            doc.text(title, pageWidth - 15, 20, { align: 'right' });
            
            doc.setFontSize(9);
            doc.text(`Dicetak oleh: ${adminName}`, pageWidth - 15, 28, { align: 'right' });
            doc.text(`Tanggal Cetak: ${formatDateTime(new Date())}`, pageWidth - 15, 33, { align: 'right' });

            // 2. Executive Summary (Cards)
            let y = 55;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('RINGKASAN EKSEKUTIF', 15, y);
            
            y += 8;
            const summaryItems = [
                { label: 'Item Inventaris', value: data.summary.inventory_items, color: [240, 240, 240] },
                { label: 'Nilai Stok (HPP)', value: formatCurrency(data.summary.total_inventory_value), color: [240, 240, 240] },
                { label: 'Total Servis', value: data.summary.total_service_tickets, color: [240, 240, 240] },
                { label: 'Pendapatan Servis', value: formatCurrency(data.summary.total_service_revenue), color: [255, 243, 205] },
                { label: 'Pendapatan Ritel', value: formatCurrency(data.summary.total_retail_revenue), color: [209, 231, 221] }
            ];

            let cardX = 15;
            const cardWidth = (pageWidth - 40) / 3;
            summaryItems.forEach((item, index) => {
                if (index === 3) { cardX = 15; y += 25; }
                
                doc.setFillColor(...item.color);
                doc.roundedRect(cardX, y, cardWidth, 20, 2, 2, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.roundedRect(cardX, y, cardWidth, 20, 2, 2, 'D');
                
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 100);
                doc.text(item.label, cardX + cardWidth/2, y + 7, { align: 'center' });
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text(String(item.value), cardX + cardWidth/2, y + 14, { align: 'center' });
                
                cardX += cardWidth + 5;
            });

            // Total Akhir Box
            y += 25;
            doc.setFillColor(13, 110, 253);
            doc.roundedRect(15, y, pageWidth - 30, 15, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.text('TOTAL PENDAPATAN BERSIH', 25, y + 9.5);
            doc.setFontSize(14);
            doc.text(formatCurrency(data.summary.grand_total_revenue), pageWidth - 25, y + 10, { align: 'right' });

            // 3. Grafik Visualisasi
            y += 30;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('VISUALISASI DATA', 15, y);
            
            // Pie Chart Image
            const pieChartData = {
                labels: ['Servis', 'Ritel'],
                datasets: [{
                    data: [data.summary.total_service_revenue, data.summary.total_retail_revenue],
                    backgroundColor: ['#ffc107', '#198754']
                }]
            };
            const pieImg = await this.generateChartImage('hiddenPieChart', 'pie', pieChartData);
            doc.addImage(pieImg, 'PNG', 15, y + 5, 60, 60);
            
            // Line Chart Image (Trend)
            const sortedDates = [...new Set([
                ...data.trends.services.map(t => t._id),
                ...data.trends.retail.map(t => t._id)
            ])].sort();
            
            const lineChartData = {
                labels: sortedDates.map(d => formatDate(d)),
                datasets: [
                    {
                        label: 'Servis',
                        data: sortedDates.map(d => data.trends.services.find(t => t._id === d)?.amount || 0),
                        borderColor: '#ffc107',
                        fill: false
                    },
                    {
                        label: 'Ritel',
                        data: sortedDates.map(d => data.trends.retail.find(t => t._id === d)?.amount || 0),
                        borderColor: '#198754',
                        fill: false
                    }
                ]
            };
            const lineImg = await this.generateChartImage('hiddenLineChart', 'line', lineChartData);
            doc.addImage(lineImg, 'PNG', 85, y + 10, 110, 50);
            
            doc.setFontSize(8);
            doc.text('Proporsi Pendapatan', 45, y + 70, { align: 'center' });
            doc.text('Tren Pendapatan Harian', 140, y + 70, { align: 'center' });

            // 4. Detailed Tables
            // Page 2: Inventory
            doc.addPage();
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('DATA INVENTARIS (STOK GUDANG)', 15, 20);
            
            doc.autoTable({
                startY: 25,
                head: [['SKU', 'Nama Barang', 'Kategori', 'Harga Jual', 'Stok', 'Nilai Stok']],
                body: data.inventory.map(i => [
                    i.sku,
                    i.name,
                    i.category,
                    formatCurrency(i.selling_price),
                    i.stock,
                    formatCurrency(i.stock * i.purchase_price)
                ]),
                headStyles: { fillColor: [50, 50, 50] },
                styles: { fontSize: 8 },
                columnStyles: {
                    3: { halign: 'right' },
                    4: { halign: 'center' },
                    5: { halign: 'right' }
                }
            });

            // Page 3: Services
            doc.addPage();
            doc.text('DATA DETAIL SERVIS (WORKSHOP)', 15, 20);
            doc.autoTable({
                startY: 25,
                head: [['Tiket', 'Tanggal', 'Pelanggan', 'Keluhan', 'Teknisi', 'Status', 'Total']],
                body: data.services.map(s => [
                    s.ticket_number,
                    formatDate(s.timestamps.picked_up_at),
                    s.customer.name,
                    s.device.symptoms,
                    s.technician.name,
                    s.status,
                    formatCurrency(s.total_cost)
                ]),
                headStyles: { fillColor: [255, 193, 7] },
                styles: { fontSize: 7 },
                columnStyles: { 6: { halign: 'right' } }
            });

            // Page 4: Transactions
            doc.addPage();
            doc.text('DATA TRANSAKSI RITEL (POS)', 15, 20);
            doc.autoTable({
                startY: 25,
                head: [['Invoice', 'Tanggal', 'Kasir', 'Barang Terjual', 'Metode', 'Total']],
                body: data.transactions.map(t => [
                    t.invoice_no,
                    formatDate(t.date),
                    t.cashier_name,
                    t.items.map(i => `${i.name} (x${i.qty})`).join(', '),
                    t.payment_method,
                    formatCurrency(t.grand_total)
                ]),
                headStyles: { fillColor: [25, 135, 84] },
                styles: { fontSize: 7 },
                columnStyles: { 5: { halign: 'right' } }
            });

            // Save PDF
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            doc.save(`Laporan_Rekap_UTC_${range}_${dateStr}.pdf`);
            showToast('PDF berhasil diunduh', 'success');

        } catch (error) {
            console.error('PDF Generation Error:', error);
            showToast('Gagal menghasilkan PDF: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }

    async generateChartImage(canvasId, type, data) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        
        // Clear previous chart
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();
        
        return new Promise((resolve) => {
            new Chart(ctx, {
                type: type,
                data: data,
                options: {
                    responsive: false,
                    animation: false,
                    plugins: {
                        legend: {
                            display: type === 'pie',
                            position: 'bottom',
                            labels: { font: { size: 14 } }
                        }
                    },
                    scales: type === 'line' ? {
                        y: { beginAtZero: true }
                    } : {}
                },
                plugins: [{
                    id: 'background-white',
                    beforeDraw: (chart) => {
                        const { ctx } = chart;
                        ctx.save();
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, chart.width, chart.height);
                        ctx.restore();
                    }
                }]
            });
            
            // Give it a tiny bit of time to ensure draw is complete
            setTimeout(() => {
                resolve(canvas.toDataURL('image/png', 1.0));
            }, 100);
        });
    }
}

export default Reports;