// public/js/modules/inventory.js - Inventory Management Module

import api, { formatCurrency, showToast, confirmDialog } from '../api.js';

class Inventory {
    constructor() {
        this.items = [];
        this.searchTerm = '';
        this.categoryFilter = 'all';
    }

    async render() {
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0"><i class="bi bi-box-seam me-2"></i>Inventory Management</h5>
                        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#itemModal" onclick="inventory.openItemModal()">
                            <i class="bi bi-plus-circle me-2"></i>Add New Item
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <!-- Search & Filter -->
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <div class="search-bar">
                                <i class="bi bi-search"></i>
                                <input type="text" class="form-control" id="inventory-search" 
                                       placeholder="Search by name or SKU...">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="inventory-category-filter">
                                <option value="all">All Categories</option>
                                <option value="Sparepart">Sparepart</option>
                                <option value="Accessory">Accessory</option>
                                <option value="Software">Software</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-outline-primary w-100" id="refresh-inventory-btn">
                                <i class="bi bi-arrow-clockwise me-2"></i>Refresh
                            </button>
                        </div>
                    </div>

                    <!-- Inventory Table -->
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Item Name</th>
                                    <th>Category</th>
                                    <th>Purchase Price</th>
                                    <th>Selling Price</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="inventory-table-body">
                                <tr>
                                    <td colspan="8" class="text-center py-4">
                                        <div class="spinner-border text-primary"></div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Add/Edit Item Modal -->
            <div class="modal fade" id="itemModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="itemModalTitle">Add New Item</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="item-form">
                                <input type="hidden" id="item-id">
                                
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">SKU *</label>
                                        <input type="text" class="form-control" id="item-sku" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Category *</label>
                                        <select class="form-select" id="item-category" required>
                                            <option value="">Select Category</option>
                                            <option value="Sparepart">Sparepart</option>
                                            <option value="Accessory">Accessory</option>
                                            <option value="Software">Software</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Item Name *</label>
                                        <input type="text" class="form-control" id="item-name" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Purchase Price (HPP) *</label>
                                        <input type="number" class="form-control" id="item-purchase-price" 
                                               min="0" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Selling Price *</label>
                                        <input type="number" class="form-control" id="item-selling-price" 
                                               min="0" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Initial Stock *</label>
                                        <input type="number" class="form-control" id="item-stock" 
                                               min="0" value="0" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Min Stock Alert *</label>
                                        <input type="number" class="form-control" id="item-min-stock" 
                                               min="0" value="5" required>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Description</label>
                                        <textarea class="form-control" id="item-description" rows="3"></textarea>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="save-item-btn">
                                <i class="bi bi-save me-2"></i>Save Item
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stock Adjustment Modal -->
            <div class="modal fade" id="stockModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Adjust Stock</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="stock-item-id">
                            <div class="alert alert-info">
                                <strong id="stock-item-name"></strong><br>
                                Current Stock: <strong id="stock-current">0</strong>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Adjustment Type</label>
                                <select class="form-select" id="stock-type">
                                    <option value="add">Add Stock (Restock)</option>
                                    <option value="deduct">Deduct Stock (Correction)</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Quantity</label>
                                <input type="number" class="form-control" id="stock-quantity" 
                                       min="1" value="1" required>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="save-stock-btn">
                                <i class="bi bi-check-circle me-2"></i>Adjust Stock
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadItems();
        this.setupEventListeners();
    }

    async loadItems() {
        try {
            const params = { limit: 100 };
            if (this.categoryFilter !== 'all') {
                params.category = this.categoryFilter;
            }
            if (this.searchTerm) {
                params.search = this.searchTerm;
            }

            const response = await api.getInventory(params);
            this.items = response.data;
            this.renderTable();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    renderTable() {
        const tbody = document.getElementById('inventory-table-body');
        
        if (this.items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">No items found</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.items.map(item => {
            const stockBadge = item.stock <= item.min_stock_alert 
                ? '<span class="badge bg-danger">Low Stock</span>'
                : item.stock <= item.min_stock_alert * 2
                ? '<span class="badge bg-warning text-dark">Medium</span>'
                : '<span class="badge bg-success">Good</span>';

            return `
                <tr>
                    <td><code>${item.sku}</code></td>
                    <td><strong>${item.name}</strong></td>
                    <td><span class="badge bg-secondary">${item.category}</span></td>
                    <td>${formatCurrency(item.purchase_price)}</td>
                    <td>${formatCurrency(item.selling_price)}</td>
                    <td><strong>${item.stock}</strong></td>
                    <td>${stockBadge}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="inventory.openStockModal('${item._id}', '${item.name}', ${item.stock})" title="Adjust Stock">
                                <i class="bi bi-arrow-left-right"></i>
                            </button>
                            <button class="btn btn-outline-secondary" onclick="inventory.editItem('${item._id}')" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="inventory.deleteItem('${item._id}', '${item.name}')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    setupEventListeners() {
        // Search
        document.getElementById('inventory-search').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.loadItems();
        });

        // Category filter
        document.getElementById('inventory-category-filter').addEventListener('change', (e) => {
            this.categoryFilter = e.target.value;
            this.loadItems();
        });

        // Refresh button
        document.getElementById('refresh-inventory-btn').addEventListener('click', () => {
            this.loadItems();
        });

        // Save item
        document.getElementById('save-item-btn').addEventListener('click', () => {
            this.saveItem();
        });

        // Save stock adjustment
        document.getElementById('save-stock-btn').addEventListener('click', () => {
            this.adjustStock();
        });
    }

    openItemModal(itemId = null) {
        const modal = new bootstrap.Modal(document.getElementById('itemModal'));
        document.getElementById('item-form').reset();
        
        if (itemId) {
            document.getElementById('itemModalTitle').textContent = 'Edit Item';
            const item = this.items.find(i => i._id === itemId);
            if (item) {
                document.getElementById('item-id').value = item._id;
                document.getElementById('item-sku').value = item.sku;
                document.getElementById('item-name').value = item.name;
                document.getElementById('item-category').value = item.category;
                document.getElementById('item-purchase-price').value = item.purchase_price;
                document.getElementById('item-selling-price').value = item.selling_price;
                document.getElementById('item-stock').value = item.stock;
                document.getElementById('item-min-stock').value = item.min_stock_alert;
                document.getElementById('item-description').value = item.description || '';
            }
        } else {
            document.getElementById('itemModalTitle').textContent = 'Add New Item';
        }
        
        modal.show();
    }

    async saveItem() {
        const itemData = {
            sku: document.getElementById('item-sku').value,
            name: document.getElementById('item-name').value,
            category: document.getElementById('item-category').value,
            purchase_price: parseFloat(document.getElementById('item-purchase-price').value),
            selling_price: parseFloat(document.getElementById('item-selling-price').value),
            stock: parseInt(document.getElementById('item-stock').value),
            min_stock_alert: parseInt(document.getElementById('item-min-stock').value),
            description: document.getElementById('item-description').value
        };

        const itemId = document.getElementById('item-id').value;

        try {
            if (itemId) {
                await api.updateItem(itemId, itemData);
                showToast('Item updated successfully', 'success');
            } else {
                await api.createItem(itemData);
                showToast('Item created successfully', 'success');
            }

            bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
            await this.loadItems();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    editItem(itemId) {
        this.openItemModal(itemId);
    }

    async deleteItem(itemId, itemName) {
        if (!confirmDialog(`Are you sure you want to delete "${itemName}"?`)) return;

        try {
            await api.deleteItem(itemId);
            showToast('Item deleted successfully', 'success');
            await this.loadItems();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    openStockModal(itemId, itemName, currentStock) {
        document.getElementById('stock-item-id').value = itemId;
        document.getElementById('stock-item-name').textContent = itemName;
        document.getElementById('stock-current').textContent = currentStock;
        document.getElementById('stock-quantity').value = 1;
        
        const modal = new bootstrap.Modal(document.getElementById('stockModal'));
        modal.show();
    }

    async adjustStock() {
        const itemId = document.getElementById('stock-item-id').value;
        const type = document.getElementById('stock-type').value;
        const quantity = parseInt(document.getElementById('stock-quantity').value);

        if (!quantity || quantity < 1) {
            showToast('Please enter a valid quantity', 'error');
            return;
        }

        try {
            await api.patch(`/inventory/${itemId}/stock`, { quantity, type });
            showToast(`Stock ${type === 'add' ? 'added' : 'deducted'} successfully`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('stockModal')).hide();
            await this.loadItems();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}

// Make inventory globally accessible
window.inventory = new Inventory();

export default Inventory;