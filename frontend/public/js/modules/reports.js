// public/js/modules/reports.js - Reports & Analytics Module

import api, { formatCurrency, formatDate } from '../api.js';

class Reports {
    constructor() {
        this.currentReport = 'daily';
    }

    async render() {
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4">
                <!-- Report Type Selection -->
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <div class="btn-group w-100" role="group">
                                <button type="button" class="btn btn-outline-primary active" data-report="daily">
                                    <i class="bi bi-calendar-day me-2"></i>Daily Revenue
                                </button>
                                <button type="button" class="btn btn-outline-primary" data-report="monthly">
                                    <i class="bi bi-calendar-month me-2"></i>Monthly Revenue
                                </button>
                                <button type="button" class="btn btn-outline-primary" data-report="top-items">
                                    <i class="bi bi-trophy me-2"></i>Top Items
                                </button>
                                <button type="button" class="btn btn-outline-primary" data-report="performance">
                                    <i class="bi bi-bar-chart me-2"></i>Performance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Report Content -->
                <div class="col-12">
                    <div id="report-content">
                        <!-- Dynamic content loaded here -->
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
                document.querySelectorAll('[data-report]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const reportType = e.target.getAttribute('data-report');
                this.loadReport(reportType);
            });
        });
    }

    async loadReport(type) {
        this.currentReport = type;
        const container = document.getElementById('report-content');
        
        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

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
            const today = new Date().toISOString().split('T')[0];
            const response = await api.getDailyRevenue(today);
            const data = response.data;

            container.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Daily Revenue Report</h5>
                            <input type="date" class="form-control w-auto" id="daily-date" value="${today}">
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row g-4">
                            <div class="col-md-4">
                                <div class="card bg-primary bg-opacity-10 border-0">
                                    <div class="card-body text-center">
                                        <i class="bi bi-cash-stack fs-1 text-primary"></i>
                                        <h3 class="mt-3 text-primary">${formatCurrency(data.total_revenue)}</h3>
                                        <p class="text-muted mb-0">Total Revenue</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-success bg-opacity-10 border-0">
                                    <div class="card-body text-center">
                                        <i class="bi bi-cart3 fs-1 text-success"></i>
                                        <h3 class="mt-3 text-success">${formatCurrency(data.retail_sales.revenue)}</h3>
                                        <p class="text-muted mb-0">Retail Sales</p>
                                        <small>${data.retail_sales.transactions} transactions</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-warning bg-opacity-10 border-0">
                                    <div class="card-body text-center">
                                        <i class="bi bi-wrench fs-1 text-warning"></i>
                                        <h3 class="mt-3 text-warning">${formatCurrency(data.service_revenue.revenue)}</h3>
                                        <p class="text-muted mb-0">Service Revenue</p>
                                        <small>${data.service_revenue.tickets} tickets</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4">
                            <h6 class="border-bottom pb-2">Summary</h6>
                            <table class="table">
                                <tbody>
                                    <tr>
                                        <td><strong>Date</strong></td>
                                        <td>${formatDate(response.date)}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Total Transactions</strong></td>
                                        <td>${data.total_transactions}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Retail Transactions</strong></td>
                                        <td>${data.retail_sales.transactions}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>Service Tickets Completed</strong></td>
                                        <td>${data.service_revenue.tickets}</td>
                                    </tr>
                                    <tr class="table-primary">
                                        <td><strong>Total Revenue</strong></td>
                                        <td><strong>${formatCurrency(data.total_revenue)}</strong></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Setup date change listener
            document.getElementById('daily-date').addEventListener('change', (e) => {
                this.renderDailyReport(container);
            });
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }

    async renderMonthlyReport(container) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;

            const response = await api.getMonthlyRevenue(year, month);
            const data = response.data;

            container.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Monthly Revenue Report</h5>
                            <div>
                                <select class="form-select d-inline-block w-auto me-2" id="month-select">
                                    ${Array.from({length: 12}, (_, i) => {
                                        const m = i + 1;
                                        const monthName = new Date(2000, i).toLocaleString('id-ID', { month: 'long' });
                                        return `<option value="${m}" ${m === month ? 'selected' : ''}>${monthName}</option>`;
                                    }).join('')}
                                </select>
                                <select class="form-select d-inline-block w-auto" id="year-select">
                                    ${[year - 1, year, year + 1].map(y => 
                                        `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="row g-4 mb-4">
                            <div class="col-md-4">
                                <div class="card bg-primary bg-opacity-10 border-0">
                                    <div class="card-body text-center">
                                        <h3 class="text-primary">${formatCurrency(data.total_revenue)}</h3>
                                        <p class="text-muted mb-0">Total Revenue</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-success bg-opacity-10 border-0">
                                    <div class="card-body text-center">
                                        <h3 class="text-success">${formatCurrency(data.retail_revenue)}</h3>
                                        <p class="text-muted mb-0">Retail Sales</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card bg-warning bg-opacity-10 border-0">
                                    <div class="card-body text-center">
                                        <h3 class="text-warning">${formatCurrency(data.service_revenue)}</h3>
                                        <p class="text-muted mb-0">Service Revenue</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h6 class="border-bottom pb-2 mb-3">Daily Breakdown</h6>
                        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                            <table class="table table-striped table-sm">
                                <thead class="sticky-top bg-light">
                                    <tr>
                                        <th>Day</th>
                                        <th>Retail</th>
                                        <th>Service</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(data.daily_breakdown || []).map(day => `
                                        <tr>
                                            <td>${day.day}</td>
                                            <td>${formatCurrency(day.retail_revenue)}</td>
                                            <td>${formatCurrency(day.service_revenue)}</td>
                                            <td><strong>${formatCurrency(day.total_revenue)}</strong></td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="4" class="text-center">No data</td></tr>'}
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
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }

    async renderTopItemsReport(container) {
        try {
            const response = await api.getTopItems({ limit: 10 });
            const items = response.data;

            container.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">Top Selling Items</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Item Name</th>
                                        <th>Quantity Sold</th>
                                        <th>Total Revenue</th>
                                        <th>Times Purchased</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map((item, index) => `
                                        <tr>
                                            <td><strong>${index + 1}</strong></td>
                                            <td>${item.item_name}</td>
                                            <td><span class="badge bg-primary">${item.total_qty_sold}</span></td>
                                            <td><strong>${formatCurrency(item.total_revenue)}</strong></td>
                                            <td>${item.times_purchased}</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="5" class="text-center">No data available</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
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
                        <div class="card">
                            <div class="card-header bg-success text-white">
                                <h5 class="mb-0"><i class="bi bi-person-badge me-2"></i>Cashier Performance</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Cashier</th>
                                                <th>Transactions</th>
                                                <th>Revenue</th>
                                                <th>Avg</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(cashierPerf.data || []).map(c => `
                                                <tr>
                                                    <td><strong>${c.cashier_name}</strong></td>
                                                    <td>${c.total_transactions}</td>
                                                    <td>${formatCurrency(c.total_revenue)}</td>
                                                    <td>${formatCurrency(c.avg_transaction_value)}</td>
                                                </tr>
                                            `).join('') || '<tr><td colspan="4" class="text-center">No data</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header bg-warning">
                                <h5 class="mb-0"><i class="bi bi-wrench me-2"></i>Technician Performance</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Technician</th>
                                                <th>Tickets</th>
                                                <th>Revenue</th>
                                                <th>Avg</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(techPerf.data || []).map(t => `
                                                <tr>
                                                    <td><strong>${t.technician_name}</strong></td>
                                                    <td>${t.total_tickets}</td>
                                                    <td>${formatCurrency(t.total_revenue)}</td>
                                                    <td>${formatCurrency(t.avg_ticket_value)}</td>
                                                </tr>
                                            `).join('') || '<tr><td colspan="4" class="text-center">No data</td></tr>'}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }
}

export default Reports;