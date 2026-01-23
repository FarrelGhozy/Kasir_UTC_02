// public/js/modules/pos.js - Point of Sale Module (Fixed Layout)

import api, { formatCurrency, showToast, showError } from '../api.js';
import auth from '../auth.js';

class POS {
    constructor() {
        this.items = [];
        this.cart = [];
        this.searchTerm = '';
        this.selectedCategory = 'all';
    }

    async render() {
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4 h-100">
                <div class="col-lg-7 d-flex flex-column">
                    <div class="card flex-grow-1 shadow-sm">
                        <div class="card-header bg-white py-3">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="mb-0 fw-bold"><i class="bi bi-grid me-2 text-primary"></i>Products</h5>
                                <span class="badge bg-primary rounded-pill" id="total-products-badge">0 Items</span>
                            </div>
                            
                            <div class="row g-2">
                                <div class="col-md-8">
                                    <div class="input-group">
                                        <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
                                        <input type="text" class="form-control border-start-0 bg-light" id="product-search" 
                                               placeholder="Scan SKU or search name...">
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <select class="form-select bg-light" id="category-filter">
                                        <option value="all">All Categories</option>
                                        <option value="Sparepart">Sparepart</option>
                                        <option value="Accessory">Accessory</option>
                                        <option value="Software">Software</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="card-body p-3 bg-light" style="overflow-y: auto; height: 600px;">
                            <div id="product-grid" class="row g-3"></div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-5 d-flex flex-column">
                    <div class="card flex-grow-1 shadow-sm border-0">
                        <div class="card-header bg-primary text-white py-3">
                            <h5 class="mb-0"><i class="bi bi-cart3 me-2"></i>Current Transaction</h5>
                        </div>
                        <div class="card-body d-flex flex-column p-0">
                            <div class="cart-container flex-grow-1 p-3" style="overflow-y: auto; max-height: 400px;">
                                <table class="table table-hover align-middle mb-0">
                                    <thead class="table-light sticky-top">
                                        <tr>
                                            <th>Item</th>
                                            <th width="100" class="text-center">Qty</th>
                                            <th class="text-end">Subtotal</th>
                                            <th width="40"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="cart-items">
                                        <tr>
                                            <td colspan="4" class="text-center text-muted py-5">
                                                <i class="bi bi-cart-x display-1 d-block mb-3 text-secondary opacity-25"></i>
                                                <p>Select products to add</p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div class="border-top p-4 bg-light">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="text-muted">Items:</span>
                                    <strong id="cart-count">0</strong>
                                </div>
                                <div class="d-flex justify-content-between align-items-center mb-4">
                                    <h5 class="mb-0">Grand Total:</h5>
                                    <h3 class="cart-total mb-0 text-primary fw-bold" id="cart-total">Rp 0</h3>
                                </div>

                                <div class="row g-2 mb-3">
                                    <div class="col-6">
                                        <label class="form-label small text-muted">Method</label>
                                        <select class="form-select" id="payment-method">
                                            <option value="Cash">Cash (Tunai)</option>
                                            <option value="Transfer">Transfer</option>
                                            <option value="QRIS">QRIS</option>
                                            <option value="Card">Debit/Credit</option>
                                        </select>
                                    </div>
                                    <div class="col-6" id="amount-paid-container">
                                        <label class="form-label small text-muted">Cash Received</label>
                                        <input type="number" class="form-control" id="amount-paid" 
                                               placeholder="0" min="0">
                                    </div>
                                </div>

                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <span class="text-muted">Change:</span>
                                    <strong id="change-display" class="fs-5">Rp 0</strong>
                                </div>

                                <div class="d-grid gap-2 d-md-flex">
                                    <button class="btn btn-outline-danger flex-grow-1" id="clear-cart-btn">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                    <button class="btn btn-primary flex-grow-1 w-100 py-2 fw-bold" id="pay-btn" disabled>
                                        <i class="bi bi-check-circle me-2"></i>COMPLETE PAYMENT
                                    </button>
                                </div>
                            </div>
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
            const response = await api.getInventory({ limit: 100 });
            this.items = response.data.filter(item => item.stock > 0);
            
            const badge = document.getElementById('total-products-badge');
            if(badge) badge.textContent = `${this.items.length} Items`;

            this.renderProductGrid();
        } catch (error) {
            showError('product-grid', error.message);
        }
    }

    renderProductGrid() {
        const grid = document.getElementById('product-grid');
        if (!grid) return;
        
        let filtered = this.items;

        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(term) ||
                item.sku.toLowerCase().includes(term)
            );
        }

        if (this.selectedCategory !== 'all') {
            filtered = filtered.filter(item => item.category === this.selectedCategory);
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <p>No products found</p>
                </div>`;
            return;
        }

        // GRID LAYOUT FIXED: Wrap in col-* classes
        grid.innerHTML = filtered.map(item => `
            <div class="col-6 col-md-4 col-lg-4">
                <div class="card product-card h-100 border-0 shadow-sm cursor-pointer position-relative" 
                     data-item-id="${item._id}" 
                     style="cursor: pointer; transition: transform 0.2s;">
                    <div class="card-body text-center p-3 d-flex flex-column">
                        <div class="mb-3 text-primary opacity-75">
                            <i class="bi bi-box-seam" style="font-size: 2.5rem;"></i>
                        </div>
                        <h6 class="card-title text-truncate mb-1 fw-bold" title="${item.name}">${item.name}</h6>
                        <div class="mt-auto">
                            <h5 class="text-primary fw-bold mb-2">${formatCurrency(item.selling_price)}</h5>
                            <span class="badge ${this.getStockBadgeClass(item.stock, item.min_stock_alert)} rounded-pill">
                                Stock: ${item.stock}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemId = card.getAttribute('data-item-id');
                // Simple animation
                card.style.transform = 'scale(0.95)';
                setTimeout(() => card.style.transform = 'scale(1)', 100);
                this.addToCart(itemId);
            });
        });
    }

    getStockBadgeClass(stock, minStock) {
        if (stock <= minStock) return 'bg-danger';
        if (stock <= minStock * 2) return 'bg-warning text-dark';
        return 'bg-success bg-opacity-75';
    }

    addToCart(itemId) {
        const item = this.items.find(i => i._id === itemId);
        if (!item) return;

        const existingItem = this.cart.find(c => c.item_id === itemId);

        if (existingItem) {
            if (existingItem.qty >= item.stock) {
                showToast(`Max stock reached for ${item.name}`, 'warning');
                return;
            }
            existingItem.qty++;
        } else {
            this.cart.push({
                item_id: itemId,
                name: item.name,
                price: item.selling_price,
                qty: 1,
                max_stock: item.stock
            });
        }

        this.renderCart();
    }

    renderCart() {
        const cartItemsContainer = document.getElementById('cart-items');
        const cartCount = document.getElementById('cart-count');
        const cartTotal = document.getElementById('cart-total');
        const payBtn = document.getElementById('pay-btn');

        if (this.cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-5">
                        <i class="bi bi-cart-x display-6 d-block mb-3"></i>
                        <p class="small">Cart is empty</p>
                    </td>
                </tr>
            `;
            cartCount.textContent = '0';
            cartTotal.textContent = 'Rp 0';
            payBtn.disabled = true;
            this.updateChange();
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const itemCount = this.cart.reduce((sum, item) => sum + item.qty, 0);

        cartItemsContainer.innerHTML = this.cart.map((item, index) => `
            <tr>
                <td>
                    <div class="fw-bold text-truncate" style="max-width: 150px;">${item.name}</div>
                    <small class="text-muted">${formatCurrency(item.price)}</small>
                </td>
                <td>
                    <div class="input-group input-group-sm">
                        <button class="btn btn-outline-secondary" type="button" data-action="decrease" data-index="${index}">-</button>
                        <input type="text" class="form-control text-center bg-white px-1" readonly value="${item.qty}" style="max-width: 40px;">
                        <button class="btn btn-outline-secondary" type="button" data-action="increase" data-index="${index}">+</button>
                    </div>
                </td>
                <td class="text-end fw-bold">
                    ${formatCurrency(item.price * item.qty)}
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-link text-danger p-0" data-action="remove" data-index="${index}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        cartCount.textContent = itemCount;
        cartTotal.textContent = formatCurrency(total);
        payBtn.disabled = false;

        this.setupCartEventListeners();
        this.updateChange();
    }

    setupCartEventListeners() {
        document.querySelectorAll('[data-action="increase"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.getAttribute('data-index'));
                if (this.cart[index].qty < this.cart[index].max_stock) {
                    this.cart[index].qty++;
                    this.renderCart();
                } else {
                    showToast('Max stock reached', 'warning');
                }
            });
        });

        document.querySelectorAll('[data-action="decrease"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.getAttribute('data-index'));
                if (this.cart[index].qty > 1) {
                    this.cart[index].qty--;
                    this.renderCart();
                }
            });
        });

        document.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.getAttribute('data-index'));
                this.cart.splice(index, 1);
                this.renderCart();
            });
        });
    }

    setupEventListeners() {
        const searchInput = document.getElementById('product-search');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.renderProductGrid();
            });
        }

        const categoryFilter = document.getElementById('category-filter');
        if(categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.selectedCategory = e.target.value;
                this.renderProductGrid();
            });
        }

        const paymentMethod = document.getElementById('payment-method');
        if(paymentMethod) {
            paymentMethod.addEventListener('change', (e) => {
                const amountInput = document.getElementById('amount-paid');
                if (e.target.value === 'Cash') {
                    amountInput.disabled = false;
                    amountInput.value = '';
                    amountInput.focus();
                } else {
                    amountInput.disabled = true;
                    amountInput.value = '';
                }
                this.updateChange();
            });
        }

        const amountPaid = document.getElementById('amount-paid');
        if(amountPaid) {
            amountPaid.addEventListener('input', () => {
                this.updateChange();
            });
        }

        const clearBtn = document.getElementById('clear-cart-btn');
        if(clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.cart.length > 0 && confirm('Empty the cart?')) {
                    this.cart = [];
                    this.renderCart();
                }
            });
        }

        const payBtn = document.getElementById('pay-btn');
        if(payBtn) {
            payBtn.addEventListener('click', () => {
                this.processPayment();
            });
        }
    }

    updateChange() {
        const paymentMethod = document.getElementById('payment-method').value;
        const changeDisplay = document.getElementById('change-display');
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        if (paymentMethod !== 'Cash') {
            changeDisplay.textContent = 'Rp 0';
            changeDisplay.className = 'fs-5 text-muted';
            return;
        }

        const amountPaidInput = document.getElementById('amount-paid').value;
        const amountPaid = parseFloat(amountPaidInput) || 0;
        const change = amountPaid - total;

        if (change < 0) {
            changeDisplay.textContent = `Insufficient: ${formatCurrency(Math.abs(change))}`;
            changeDisplay.className = 'fs-5 text-danger fw-bold';
        } else {
            changeDisplay.textContent = formatCurrency(change);
            changeDisplay.className = 'fs-5 text-success fw-bold';
        }
    }

    async processPayment() {
        if (this.cart.length === 0) return;

        const paymentMethod = document.getElementById('payment-method').value;
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        let amountPaid = total;
        
        if (paymentMethod === 'Cash') {
            const inputVal = document.getElementById('amount-paid').value;
            amountPaid = parseFloat(inputVal);
            
            if (isNaN(amountPaid) || amountPaid < total) {
                showToast('Payment amount is insufficient!', 'error');
                return;
            }
        }

        if (!confirm(`Process payment of ${formatCurrency(total)}?`)) return;

        const payBtn = document.getElementById('pay-btn');
        const originalText = payBtn.innerHTML;
        payBtn.disabled = true;
        payBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

        try {
            const transactionData = {
                items: this.cart.map(item => ({
                    item_id: item.item_id,
                    qty: item.qty
                })),
                payment_method: paymentMethod,
                amount_paid: amountPaid
            };

            const response = await api.createTransaction(transactionData);

            if (response.success) {
                showToast('Transaction success!', 'success');
                this.showReceipt(response.data);

                // Clear and Reload
                this.cart = [];
                this.renderCart();
                document.getElementById('amount-paid').value = '';
                document.getElementById('change-display').textContent = 'Rp 0';
                
                await this.loadItems(); // Update stock visuals
            }
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Transaction failed', 'error');
        } finally {
            if(payBtn) {
                payBtn.disabled = false;
                payBtn.innerHTML = originalText;
            }
        }
    }

    showReceipt(transaction) {
        alert(
`TRANSACTION SUCCESS!
================================
Invoice: ${transaction.invoice_no}
Date: ${new Date(transaction.date).toLocaleString()}
Total: ${formatCurrency(transaction.grand_total)}
Paid: ${formatCurrency(transaction.amount_paid)}
Change: ${formatCurrency(transaction.change || 0)}
================================`
        );
    }
}

export default POS;