// public/js/modules/dashboard.js - Dashboard Overview Module

import api, { formatCurrency, showError } from '../api.js';

class Dashboard {
    constructor() {
        this.stats = null;
    }

    async render() {
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4 mb-4">
                <!-- Stats Cards -->
                <div class="col-md-3">
                    <div class="card stat-card">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-cash-coin fs-1 text-primary me-3"></i>
                                <div>
                                    <div class="stat-label">Today's Revenue</div>
                                    <div class="stat-value" id="stat-revenue">Rp 0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="card stat-card">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-cart3 fs-1 text-success me-3"></i>
                                <div>
                                    <div class="stat-label">Transactions</div>
                                    <div class="stat-value text-success" id="stat-transactions">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="card stat-card">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-wrench fs-1 text-warning me-3"></i>
                                <div>
                                    <div class="stat-label">Active Services</div>
                                    <div class="stat-value text-warning" id="stat-services">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-3">
                    <div class="card stat-card">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <i class="bi bi-exclamation-triangle fs-1 text-danger me-3"></i>
                                <div>
                                    <div class="stat-label">Low Stock Items</div>
                                    <div class="stat-value text-danger" id="stat-low-stock">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <!-- Low Stock Alerts -->
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>Low Stock Alerts</h5>
                        </div>
                        <div class="card-body" id="low-stock-container" style="max-height: 400px; overflow-y: auto;">
                            <div class="text-center py-4">
                                <div class="spinner-border text-primary"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recent Transactions -->
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-clock-history me-2"></i>Recent Activity</h5>
                        </div>
                        <div class="card-body" id="recent-activity-container" style="max-height: 400px; overflow-y: auto;">
                            <div class="text-center py-4">
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
            // Load today's summary
            const todaySummary = await api.getTodaySummary();
            document.getElementById('stat-revenue').textContent = formatCurrency(todaySummary.data.total_revenue);
            document.getElementById('stat-transactions').textContent = todaySummary.data.total_transactions;

            // Load active service tickets
            const services = await api.getServiceTickets({ 
                status: 'Queue,Diagnosing,Waiting_Part,In_Progress' 
            });
            document.getElementById('stat-services').textContent = services.data.length;

            // Load low stock items
            await this.loadLowStock();

            // Load recent activity
            await this.loadRecentActivity();

        } catch (error) {
            console.error('Dashboard load error:', error);
        }
    }

    async loadLowStock() {
        const container = document.getElementById('low-stock-container');
        
        try {
            const response = await api.getLowStockItems();
            const items = response.data;

            document.getElementById('stat-low-stock').textContent = items.length;

            if (items.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-check-circle fs-1 text-success"></i>
                        <p class="mt-2">All items have sufficient stock</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="list-group list-group-flush">
                    ${items.map(item => `
                        <div class="list-group-item">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1">${item.name}</h6>
                                    <small class="text-muted">SKU: ${item.sku}</small>
                                </div>
                                <div class="text-end">
                                    <span class="badge bg-danger">${item.stock} units</span>
                                    <br>
                                    <small class="text-muted">Min: ${item.min_stock_alert}</small>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }

    async loadRecentActivity() {
        const container = document.getElementById('recent-activity-container');
        
        try {
            const transactions = await api.getTransactions({ limit: 5 });
            
            if (transactions.data.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1"></i>
                        <p class="mt-2">No recent activity</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="list-group list-group-flush">
                    ${transactions.data.map(txn => `
                        <div class="list-group-item">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 class="mb-1">${txn.invoice_no}</h6>
                                    <small class="text-muted">
                                        <i class="bi bi-person me-1"></i>${txn.cashier_name}
                                    </small>
                                    <br>
                                    <small class="text-muted">
                                        <i class="bi bi-calendar me-1"></i>${new Date(txn.date).toLocaleString('id-ID')}
                                    </small>
                                </div>
                                <div class="text-end">
                                    <strong class="text-primary">${formatCurrency(txn.grand_total)}</strong>
                                    <br>
                                    <span class="badge bg-info">${txn.payment_method}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }
}

export default Dashboard;