// public/js/modules/reports.js - Modul Laporan & Analitik

import api, { formatCurrency, formatDate, formatDateTime, loadScriptWithFallback, showToast, escapeHTML, toLocalDateString } from '../api.js';
import auth from '../auth.js';

// --- Pustaka PDF (dimuat dinamis + fallback agar imun terhadap blokir CDN/adblock) ---
const PDF_VENDOR_DIR = 'vendor/';
const PDF_SOURCES = {
    jspdf: [
        `${PDF_VENDOR_DIR}jspdf.umd.min.js`,
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ],
    autotable: [
        `${PDF_VENDOR_DIR}jspdf.plugin.autotable.min.js`,
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
        'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
    ],
    chart: [
        `${PDF_VENDOR_DIR}chart.umd.min.js`,
        'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
        'https://unpkg.com/chart.js@4.4.1/dist/chart.umd.min.js'
    ]
};

// Batas baris per tabel agar PDF puluhan ribu baris tidak membekukan tab browser.
const MAX_TABLE_ROWS = 2000;

/**
 * Pastikan jsPDF + plugin autotable tersedia dan terverifikasi.
 * Urutan SEQUENSIAL (jspdf dulu, baru autotable) — plugin butuh window.jspdf
 * sudah ada. Promise.all paralel adalah akar 'doc.autoTable is not a function'.
 */
export async function ensurePdfLibraries() {
    if (typeof window === 'undefined') throw new Error('Fungsi PDF hanya dapat dijalankan di browser.');
    if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
        await loadScriptWithFallback(PDF_SOURCES.jspdf);
    }
    if (!hasAutoTable()) {
        await loadScriptWithFallback(PDF_SOURCES.autotable);
    }
    assertPdfLibsReady();
    // Chart.js opsional: grafik dilewati bila gagal, tabel tetap dicetak.
    if (typeof Chart === 'undefined') {
        try {
            await loadScriptWithFallback(PDF_SOURCES.chart);
        } catch (err) {
            console.warn('Chart.js gagal dimuat, grafik dilewati:', err.message);
        }
    }
}

function hasAutoTable() {
    return !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API
        && typeof window.jspdf.jsPDF.API.autoTable === 'function');
}

/**
 * Validasi akhir sebelum generate: melempar pesan ramah bila plugin tabel hilang
 * (mis. diblokir adblock) agar tidak crash misterius di tengah jalan.
 */
export function assertPdfLibsReady() {
    if (typeof window === 'undefined' || !window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
        throw new Error('Pustaka jsPDF gagal dimuat. Periksa koneksi internet atau nonaktifkan pemblokir iklan lalu coba lagi.');
    }
    if (!hasAutoTable()) {
        throw new Error('Plugin tabel PDF gagal dimuat (kemungkinan diblokir pemblokir iklan). Nonaktifkan pemblokir iklan lalu coba lagi.');
    }
}

/**
 * Validasi payload rekap dari server sebelum digambar ke PDF.
 */
export function assertRecapPayload(data) {
    if (!data || typeof data !== 'object' || !data.summary) {
        throw new Error('Data rekap dari server tidak lengkap.');
    }
}

/**
 * Metadata kop laporan (nomor, periode, pencetak) — diekstrak agar bisa di-unit-test.
 */
export function buildRecapMeta(range, adminName) {
    const now = new Date();
    const is30 = range === '30days';
    const start = new Date(now);
    if (is30) start.setDate(start.getDate() - 30);
    return {
        rangeTitle: is30 ? 'REKAPITULASI DATA (30 HARI TERAKHIR)' : 'REKAPITULASI SELURUH DATA',
        periodText: is30 ? `${formatDate(start)} – ${formatDate(now)}` : 'Seluruh periode tercatat',
        reportNo: `RECAP/${is30 ? '30H' : 'ALL'}/${toLocalDateString(now).replace(/-/g, '')}`,
        adminName: adminName || 'Administrator',
        printedAt: formatDateTime(now)
    };
}

/**
 * Nama file PDF memakai tanggal lokal WIB (bukan UTC agar tidak off-by-one).
 * Range disanitasi agar aman dari filename-injection via console/global.
 */
export function buildRecapFilename(range, now = new Date()) {
    const safe = String(range ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 16) || 'all';
    const dateStr = toLocalDateString(now).replace(/-/g, '');
    return `Laporan_Rekap_UTC_${safe}_${dateStr}.pdf`;
}

/**
 * Baris tabel inventaris — null-safe (data legacy/import bisa berlubang).
 */
export function buildInventoryRows(inventory) {
    const list = Array.isArray(inventory) ? inventory : [];
    if (list.length === 0) {
        return [[{ content: 'Tidak ada data inventaris', colSpan: 6, styles: { halign: 'center' } }]];
    }
    return list.map((i) => {
        const stock = Number(i?.stock) || 0;
        const buy = Number(i?.purchase_price) || 0;
        return [
            i?.sku ?? '-',
            i?.name ?? '-',
            i?.category ?? '-',
            formatCurrency(i?.selling_price),
            stock,
            formatCurrency(stock * buy)
        ];
    });
}

/**
 * Baris tabel servis — null-safe untuk customer/device/technician yang hilang.
 */
export function buildServiceRows(services) {
    const list = Array.isArray(services) ? services : [];
    if (list.length === 0) {
        return [[{ content: 'Tidak ada data servis pada periode ini', colSpan: 7, styles: { halign: 'center' } }]];
    }
    return list.map((s) => ([
        s?.ticket_number ?? '-',
        formatDate(s?.history?.picked_up_at),
        s?.customer?.name ?? '-',
        s?.device?.symptoms ?? '-',
        s?.technician?.name ?? '-',
        s?.status ?? '-',
        formatCurrency(s?.total_cost)
    ]));
}

/**
 * Baris tabel transaksi ritel — null-safe untuk items yang hilang/kosong.
 */
export function buildTransactionRows(transactions) {
    const list = Array.isArray(transactions) ? transactions : [];
    if (list.length === 0) {
        return [[{ content: 'Tidak ada data transaksi pada periode ini', colSpan: 6, styles: { halign: 'center' } }]];
    }
    return list.map((t) => {
        const items = Array.isArray(t?.items) ? t.items : [];
        const desc = items.map((i) => `${i?.name ?? '?'} (x${i?.qty ?? 0})`).join(', ') || '-';
        return [
            t?.invoice_no ?? '-',
            formatDate(t?.date),
            t?.cashier_name ?? '-',
            desc,
            t?.payment_method ?? '-',
            formatCurrency(t?.grand_total)
        ];
    });
}

/**
 * Potong baris tabel agar PDF raksasa tidak OOM; sertakan catatan sisa baris.
 */
export function limitRecapRows(rows, total) {
    if (rows.length <= MAX_TABLE_ROWS) return { body: rows, note: '' };
    return {
        body: rows.slice(0, MAX_TABLE_ROWS),
        note: `Menampilkan ${MAX_TABLE_ROWS} dari ${total} baris — gunakan menu Backup untuk arsip data penuh.`
    };
}

class Reports {
    constructor() {
        this.currentReport = 'daily';
    }

    async render(containerId = 'app-content') {
        const content = document.getElementById(containerId);
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
                                        <i class="bi bi-star me-2"></i>Barang Terlaris ${!isAdmin ? '<i class="bi bi-lock-fill ms-1 small opacity-50"></i>' : ''}
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
            // WIB, bukan UTC: toISOString() off-by-one pada 00:00-06:59 WIB.
            const selectedDate = dateInput ? dateInput.value : toLocalDateString(new Date());
            
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
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat laporan: ${escapeHTML(error.message)}</div>`;
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
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat laporan bulanan: ${escapeHTML(error.message)}</div>`;
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
                                            <td class="fw-semibold text-primary">${escapeHTML(item.item_name)}</td>
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
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat data barang terlaris: ${escapeHTML(error.message)}</div>`;
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
                                                    <td class="fw-semibold">${escapeHTML(c.cashier_name)}</td>
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
                                                    <td class="fw-semibold">${escapeHTML(t.technician_name)}</td>
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
            container.innerHTML = `<div class="alert alert-danger">Gagal memuat data performa: ${escapeHTML(error.message)}</div>`;
        }
    }

    downloadFullRecap() {
        const modalEl = document.getElementById('recapRangeModal');
        if (!modalEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
            showToast('Komponen dialog gagal dimuat. Muat ulang halaman lalu coba lagi.', 'error');
            return;
        }
        const existingModal = bootstrap.Modal.getInstance(modalEl);
        if (existingModal) existingModal.dispose();
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    async processFullRecap(range) {
        const modalEl = document.getElementById('recapRangeModal');
        try {
            const modal = modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal
                ? bootstrap.Modal.getInstance(modalEl)
                : null;
            if (modal) modal.hide();
        } catch (_) { /* abaikan — modal tidak kritis untuk PDF */ }

        const btn = document.getElementById('download-full-recap-btn');
        const originalContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Menghasilkan PDF...';
        }

        try {
            // 1. Pastikan pustaka PDF siap (sekuensial + fallback; Chart.js opsional).
            await ensurePdfLibraries();

            // Whitelist di sisi klien (defense-in-depth; server juga menolak 400).
            if (!['all', '30days'].includes(range)) {
                throw new Error("Parameter 'range' tidak valid (gunakan 'all' atau '30days')");
            }

            // 2. Ambil data rekap dari server.
            const response = await api.get(`/reports/full-recap?range=${encodeURIComponent(range)}`);
            const data = response.data;
            assertRecapPayload(data);

            const adminName = auth.getUser()?.name || 'Administrator';
            const meta = buildRecapMeta(range, adminName);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            // 3. Susun halaman PDF per bagian (helper kecil agar mudah dites).
            this.drawRecapHeader(doc, meta);
            this.drawRecapSummary(doc, data.summary);
            await this.drawRecapCharts(doc, data);
            this.drawRecapTable(doc, 'DATA INVENTARIS (STOK GUDANG)', 'inventaris', buildInventoryRows(data.inventory), data.inventory?.length ?? 0);
            this.drawRecapTable(doc, 'DATA DETAIL SERVIS (WORKSHOP)', 'servis', buildServiceRows(data.services), data.services?.length ?? 0);
            this.drawRecapTable(doc, 'DATA TRANSAKSI RITEL (POS)', 'transaksi', buildTransactionRows(data.transactions), data.transactions?.length ?? 0);
            this.drawRecapFooter(doc, meta);

            // 4. Simpan PDF — nama file tanggal WIB.
            doc.save(buildRecapFilename(range));
            showToast('PDF berhasil diunduh', 'success');
        } catch (error) {
            console.error('PDF Generation Error:', error);
            showToast('Gagal menghasilkan PDF: ' + error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
        }
    }

    drawRecapHeader(doc, meta) {
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setFillColor(13, 110, 253);
        doc.rect(0, 0, pageWidth, 44, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('BENGKEL UTC', 15, 17);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Sistem Manajemen Bengkel & Workshop Terpadu', 15, 24);
        doc.text('Jl. Raya Unida No. 1, Ponorogo, Jawa Timur', 15, 29);
        doc.text(`No. Laporan: ${meta.reportNo}`, 15, 34);
        doc.text(`Periode: ${meta.periodText}`, 15, 39);

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(meta.rangeTitle, pageWidth - 15, 18, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Dicetak oleh: ${meta.adminName}`, pageWidth - 15, 27, { align: 'right' });
        doc.text(`Tanggal Cetak: ${meta.printedAt}`, pageWidth - 15, 32, { align: 'right' });
        doc.text('Unida Technology Centre', pageWidth - 15, 37, { align: 'right' });
    }

    drawRecapSummary(doc, summary) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const s = summary || {};
        let y = 58;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('RINGKASAN EKSEKUTIF', 15, y);

        y += 8;
        const summaryItems = [
            { label: 'Item Inventaris', value: String(s.inventory_items ?? 0), color: [240, 240, 240] },
            { label: 'Nilai Stok (HPP)', value: formatCurrency(s.total_inventory_value), color: [240, 240, 240] },
            { label: `Tiket Servis (${s.total_service_tickets ?? 0})`, value: formatCurrency(s.total_service_revenue), color: [255, 243, 205] },
            { label: `Transaksi Ritel (${s.total_retail_transactions ?? 0})`, value: formatCurrency(s.total_retail_revenue), color: [209, 231, 221] }
        ];

        let cardX = 15;
        const cardWidth = (pageWidth - 40) / 2;
        summaryItems.forEach((item, index) => {
            if (index === 2) { cardX = 15; y += 25; }

            doc.setFillColor(...item.color);
            doc.roundedRect(cardX, y, cardWidth, 20, 2, 2, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(cardX, y, cardWidth, 20, 2, 2, 'D');

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(item.label, cardX + cardWidth / 2, y + 7, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(String(item.value), cardX + cardWidth / 2, y + 14, { align: 'center' });

            cardX += cardWidth + 10;
        });

        y += 25;
        doc.setFillColor(13, 110, 253);
        doc.roundedRect(15, y, pageWidth - 30, 15, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL PENDAPATAN BERSIH', 25, y + 9.5);
        doc.setFontSize(14);
        doc.text(formatCurrency(s.grand_total_revenue), pageWidth - 25, y + 10, { align: 'right' });
    }

    async drawRecapCharts(doc, data) {
        const svcRevenue = Number(data.summary?.total_service_revenue) || 0;
        const retailRevenue = Number(data.summary?.total_retail_revenue) || 0;
        let y = 143;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('VISUALISASI DATA', 15, y);

        if (typeof Chart === 'undefined' || (svcRevenue === 0 && retailRevenue === 0)) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text('Grafik tidak tersedia (pustaka grafik gagal dimuat atau belum ada pendapatan).', 15, y + 8);
            return;
        }

        const trends = data.trends || {};
        const svcTrend = Array.isArray(trends.services) ? trends.services : [];
        const retailTrend = Array.isArray(trends.retail) ? trends.retail : [];

        const pieImg = await this.generateChartImage('hiddenPieChart', 'pie', {
            labels: ['Servis', 'Ritel'],
            datasets: [{
                data: [svcRevenue, retailRevenue],
                backgroundColor: ['#ffc107', '#198754']
            }]
        });
        if (pieImg) doc.addImage(pieImg, 'PNG', 15, y + 5, 60, 60);

        const sortedDates = [...new Set([
            ...svcTrend.map((t) => t?._id).filter(Boolean),
            ...retailTrend.map((t) => t?._id).filter(Boolean)
        ])].sort();

        if (sortedDates.length > 0) {
            const lineImg = await this.generateChartImage('hiddenLineChart', 'line', {
                labels: sortedDates.map((d) => formatDate(d)),
                datasets: [
                    {
                        label: 'Servis',
                        data: sortedDates.map((d) => svcTrend.find((t) => t?._id === d)?.amount || 0),
                        borderColor: '#ffc107',
                        fill: false
                    },
                    {
                        label: 'Ritel',
                        data: sortedDates.map((d) => retailTrend.find((t) => t?._id === d)?.amount || 0),
                        borderColor: '#198754',
                        fill: false
                    }
                ]
            });
            if (lineImg) doc.addImage(lineImg, 'PNG', 85, y + 10, 110, 50);
        }

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Proporsi Pendapatan', 45, y + 70, { align: 'center' });
        doc.text('Tren Pendapatan Harian', 140, y + 70, { align: 'center' });
    }

    drawRecapTable(doc, title, kind, rows, total) {
        const configs = {
            inventaris: {
                head: [['SKU', 'Nama Barang', 'Kategori', 'Harga Jual', 'Stok', 'Nilai Stok']],
                fill: [50, 50, 50],
                styles: { fontSize: 8 },
                columns: { 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' } }
            },
            servis: {
                head: [['Tiket', 'Tanggal', 'Pelanggan', 'Keluhan', 'Teknisi', 'Status', 'Total']],
                fill: [180, 130, 0],
                styles: { fontSize: 7 },
                columns: { 6: { halign: 'right' } }
            },
            transaksi: {
                head: [['Invoice', 'Tanggal', 'Kasir', 'Barang Terjual', 'Metode', 'Total']],
                fill: [25, 135, 84],
                styles: { fontSize: 7 },
                columns: { 5: { halign: 'right' } }
            }
        };
        const cfg = configs[kind] || configs.inventaris;
        const { body, note } = limitRecapRows(rows, total);

        doc.addPage();
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 15, 20);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Jumlah data: ${total} baris`, 15, 26);

        doc.autoTable({
            startY: 30,
            head: cfg.head,
            body,
            headStyles: { fillColor: cfg.fill },
            styles: { ...cfg.styles, cellPadding: 2, overflow: 'linebreak' },
            columnStyles: cfg.columns
        });

        if (note) {
            doc.setFontSize(8);
            doc.setTextColor(150, 80, 0);
            doc.text(note, 15, doc.lastAutoTable.finalY + 8);
        }
    }

    drawRecapFooter(doc, meta) {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const w = doc.internal.pageSize.getWidth();
            const h = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 120, 120);
            doc.text(`${meta.reportNo} — Halaman ${i} dari ${pageCount}`, 15, h - 10);
            doc.text('Dokumen internal Bengkel UTC', w - 15, h - 10, { align: 'right' });
        }
        doc.setPage(pageCount);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const h = doc.internal.pageSize.getHeight();
        doc.text('Ponorogo, ____________________', 130, h - 45);
        doc.text(`(${meta.adminName})`, 130, h - 25);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Penanggung jawab laporan', 130, h - 20);
    }

    async generateChartImage(canvasId, type, data) {
        try {
            if (typeof Chart === 'undefined') return null;
            const canvas = document.getElementById(canvasId);
            if (!canvas || typeof canvas.getContext !== 'function') return null;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const existingChart = typeof Chart.getChart === 'function' ? Chart.getChart(canvas) : null;
            if (existingChart) existingChart.destroy();

            return await new Promise((resolve) => {
                try {
                    new Chart(ctx, {
                        type,
                        data,
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
                                const { ctx: c } = chart;
                                c.save();
                                c.fillStyle = 'white';
                                c.fillRect(0, 0, chart.width, chart.height);
                                c.restore();
                            }
                        }]
                    });
                } catch (err) {
                    console.warn('Gagal membuat grafik, dilewati:', err.message);
                    resolve(null);
                    return;
                }

                setTimeout(() => {
                    try {
                        resolve(canvas.toDataURL('image/png', 1.0));
                    } catch (err) {
                        console.warn('Gagal membaca grafik, dilewati:', err.message);
                        resolve(null);
                    }
                }, 100);
            });
        } catch (err) {
            console.warn('Grafik dilewati:', err.message);
            return null;
        }
    }
}

export default Reports;