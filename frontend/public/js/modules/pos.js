// public/js/modules/pos.js - Point of Sale Module

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
            <div class="row g-4">
                <!-- Left Column: Product Grid -->
                <div class="col-lg-7">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-grid me-2"></i>Products</h5>
                        </div>
                        <div class="card-body">
                            <!-- Search & Filter -->
                            <div class="row g-2 mb-3">
                                <div class="col-md-8">
                                    <div class="search-bar">
                                        <i class="bi bi-search"></i>
                                        <input type="text" class="form-control" id="product-search" 
                                               placeholder="Search products...">
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <select class="form-select" id="category-filter">
                                        <option value="all">All Categories</option>
                                        <option value="Sparepart">Sparepart</option>
                                        <option value="Accessory">Accessory</option>
                                        <option value="Software">Software</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Product Grid -->
                            <div id="product-grid" class="product-grid"></div>
                        </div>
                    </div>
                </div>

                <!-- Right Column: Shopping Cart -->
                <div class="col-lg-5">
                    <div class="card h-100">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-cart3 me-2"></i>Shopping Cart</h5>
                        </div>
                        <div class="card-body d-flex flex-column">
                            <!-- Cart Items -->
                            <div class="cart-container flex-grow-1 mb-3">
                                <table class="table cart-table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th width="80">Qty</th>
                                            <th width="120">Price</th>
                                            <th width="40"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="cart-items">
                                        <tr>
                                            <td colspan="4" class="text-center text-muted py-4">
                                                <i class="bi bi-cart-x fs-1 d-block mb-2"></i>
                                                Cart is empty
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Cart Total -->
                            <div class="border-top pt-3 mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="text-muted">Items:</span>
                                    <span id="cart-count">0</span>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <h5 class="mb-0">Total:</h5>
                                    <h4 class="cart-total mb-0" id="cart-total">Rp 0</h4>
                                </div>
                            </div>

                            <!-- Payment Method -->
                            <div class="mb-3">
                                <label class="form-label">Payment Method</label>
                                <select class="form-select" id="payment-method">
                                    <option value="Cash">Cash</option>
                                    <option value="Transfer">Transfer</option>
                                    <option value="QRIS">QRIS</option>
                                    <option value="Card">Card</option>
                                </select>
                            </div>

                            <!-- Amount Paid (for Cash) -->
                            <div class="mb-3" id="amount-paid-container">
                                <label class="form-label">Amount Paid</label>
                                <input type="number" class="form-control" id="amount-paid" 
                                       placeholder="Enter amount" min="0">
                                <div class="mt-2">
                                    <small class="text-muted">Change: </small>
                                    <strong id="change-display">Rp 0</strong>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="d-grid gap-2">
                                <button class="btn btn-primary btn-lg" id="pay-btn" disabled>
                                    <i class="bi bi-credit-card me-2"></i>Process Payment
                                </button>
                                <button class="btn btn-outline-danger" id="clear-cart-btn">
                                    <i class="bi bi-trash me-2"></i>Clear Cart
                                </button>
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
            this.renderProductGrid();
        } catch (error) {
            showError('product-grid', error.message);
        }
    }

    renderProductGrid() {
        const grid = document.getElementById('product-grid');
        
        // Filter items
        let filtered = this.items;

        if (this.searchTerm) {
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                item.sku.toLowerCase().includes(this.searchTerm.toLowerCase())
            );
        }

        if (this.selectedCategory !== 'all') {
            filtered = filtered.filter(item => item.category === this.selectedCategory);
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="text-center text-muted py-5">No products found</div>';
            return;
        }

        grid.innerHTML = filtered.map(item => `
            <div class="card product-card" data-item-id="${item._id}">
                <div class="card-body text-center p-3">
                    <i class="bi bi-box-seam text-primary fs-2 mb-2"></i>
                    <div class="product-name mb-2">${item.name}</div>
                    <div class="product-price mb-1">${formatCurrency(item.selling_price)}</div>
                    <div class="product-stock">
                        <span class="badge ${this.getStockBadgeClass(item.stock, item.min_stock_alert)}">
                            Stock: ${item.stock}
                        </span>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click handlers
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemId = card.getAttribute('data-item-id');
                this.addToCart(itemId);
            });
        });
    }

    getStockBadgeClass(stock, minStock) {
        if (stock <= minStock) return 'stock-low';
        if (stock <= minStock * 2) return 'stock-medium';
        return 'stock-high';
    }

    addToCart(itemId) {
        const item = this.items.find(i => i._id === itemId);
        if (!item) return;

        // Check if item already in cart
        const existingItem = this.cart.find(c => c.item_id === itemId);

        if (existingItem) {
            // Check if we can add more
            if (existingItem.qty >= item.stock) {
                showToast(`Cannot add more. Only ${item.stock} units available.`, 'warning');
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
        showToast(`${item.name} added to cart`, 'success');
    }

    renderCart() {
        const cartItemsContainer = document.getElementById('cart-items');
        const cartCount = document.getElementById('cart-count');
        const cartTotal = document.getElementById('cart-total');
        const payBtn = document.getElementById('pay-btn');

        if (this.cart.length === 0) {
            cartItemsContainer.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-4">
                        <i class="bi bi-cart-x fs-1 d-block mb-2"></i>
                        Cart is empty
                    </td>
                </tr>
            `;
            cartCount.textContent = '0';
            cartTotal.textContent = 'Rp 0';
            payBtn.disabled = true;
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const itemCount = this.cart.reduce((sum, item) => sum + item.qty, 0);

        cartItemsContainer.innerHTML = this.cart.map((item, index) => `
            <tr>
                <td>
                    <strong>${item.name}</strong><br>
                    <small class="text-muted">${formatCurrency(item.price)}</small>
                </td>
                <td>
                    <div class="input-group input-group-sm">
                        <button class="btn btn-outline-secondary" type="button" data-action="decrease" data-index="${index}">-</button>
                        <input type="number" class="form-control text-center" value="${item.qty}" 
                               min="1" max="${item.max_stock}" data-index="${index}" style="max-width: 50px;">
                        <button class="btn btn-outline-secondary" type="button" data-action="increase" data-index="${index}">+</button>
                    </div>
                </td>
                <td class="text-end">
                    <strong>${formatCurrency(item.price * item.qty)}</strong>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" data-action="remove" data-index="${index}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        cartCount.textContent = itemCount;
        cartTotal.textContent = formatCurrency(total);
        payBtn.disabled = false;

        // Setup cart item event listeners
        this.setupCartEventListeners();
        this.updateChange();
    }

    setupCartEventListeners() {
        document.querySelectorAll('[data-action="increase"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'));
                if (this.cart[index].qty < this.cart[index].max_stock) {
                    this.cart[index].qty++;
                    this.renderCart();
                }
            });
        });

        document.querySelectorAll('[data-action="decrease"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'));
                if (this.cart[index].qty > 1) {
                    this.cart[index].qty--;
                    this.renderCart();
                }
            });
        });

        document.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.getAttribute('data-index'));
                this.cart.splice(index, 1);
                this.renderCart();
            });
        });

        document.querySelectorAll('input[type="number"][data-index]').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                const newQty = parseInt(e.target.value);
                if (newQty >= 1 && newQty <= this.cart[index].max_stock) {
                    this.cart[index].qty = newQty;
                    this.renderCart();
                }
            });
        });
    }

    setupEventListeners() {
        // Search
        document.getElementById('product-search').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.renderProductGrid();
        });

        // Category filter
        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.selectedCategory = e.target.value;
            this.renderProductGrid();
        });

        // Payment method change
        document.getElementById('payment-method').addEventListener('change', (e) => {
            const amountPaidContainer = document.getElementById('amount-paid-container');
            if (e.target.value === 'Cash') {
                amountPaidContainer.style.display = 'block';
            } else {
                amountPaidContainer.style.display = 'none';
            }
        });

        // Amount paid change
        document.getElementById('amount-paid').addEventListener('input', () => {
            this.updateChange();
        });

        // Clear cart
        document.getElementById('clear-cart-btn').addEventListener('click', () => {
            if (this.cart.length > 0 && confirm('Clear all items from cart?')) {
                this.cart = [];
                this.renderCart();
            }
        });

        // Pay button
        document.getElementById('pay-btn').addEventListener('click', () => {
            this.processPayment();
        });
    }

    updateChange() {
        const paymentMethod = document.getElementById('payment-method').value;
        const changeDisplay = document.getElementById('change-display');
        
        if (paymentMethod !== 'Cash') {
            changeDisplay.textContent = 'Rp 0';
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const amountPaid = parseFloat(document.getElementById('amount-paid').value) || 0;
        const change = amountPaid - total;

        changeDisplay.textContent = formatCurrency(Math.max(0, change));
        changeDisplay.className = change < 0 ? 'text-danger' : 'text-success';
    }

    async processPayment() {
        const paymentMethod = document.getElementById('payment-method').value;
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        
        let amountPaid = total;
        if (paymentMethod === 'Cash') {
            amountPaid = parseFloat(document.getElementById('amount-paid').value) || 0;
            if (amountPaid < total) {
                showToast('Amount paid is less than total', 'error');
                return;
            }
        }

        // Confirm transaction
        if (!confirm(`Process payment of ${formatCurrency(total)}?`)) {
            return;
        }

        const payBtn = document.getElementById('pay-btn');
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
                showToast('Transaction completed successfully!', 'success');
                
                // Clear cart
                this.cart = [];
                this.renderCart();
                
                // Reset form
                document.getElementById('amount-paid').value = '';
                
                // Reload items to update stock
                await this.loadItems();
                
                // Show receipt (optional)
                this.showReceipt(response.data);
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            payBtn.disabled = false;
            payBtn.innerHTML = '<i class="bi bi-credit-card me-2"></i>Process Payment';
        }
    }

    showReceipt(transaction) {
        alert(`Transaction Success!\nInvoice: ${transaction.invoice_no}\nTotal: ${formatCurrency(transaction.grand_total)}`);
    }
}

export default POS;