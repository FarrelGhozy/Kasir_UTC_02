import api, { formatCurrency, formatDateTime, showToast, setupCurrencyInput, parseCurrencyValue, calculateElapsedTime } from '../api.js';

class Order {
    constructor() {
        this.orders = [];
        this.technicians = [];
    }

    async render() {
        window.orderModule = this;
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4">
                <div class="col-lg-4">
                    <div class="card shadow-sm border-0 sticky-top" style="top: 20px; z-index: 1;">
                        <div class="card-header bg-success text-white py-3">
                            <h5 class="mb-0"><i class="bi bi-bag-plus me-2"></i>Pesanan Barang Baru</h5>
                        </div>
                        <div class="card-body">
                            <form id="order-form">
                                <h6 class="border-bottom pb-2 mb-3 fw-bold text-secondary">Informasi Pelanggan</h6>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nama Pelanggan *</label>
                                    <input type="text" class="form-control" id="order-customer-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nomor Telepon *</label>
                                    <input type="tel" class="form-control" id="order-customer-phone" required>
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Detail Barang</h6>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nama Barang *</label>
                                    <input type="text" class="form-control" id="order-item-name" placeholder="Contoh: RAM DDR4 8GB" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Deskripsi / Spesifikasi</label>
                                    <textarea class="form-control" id="order-item-desc" rows="2" placeholder="Merek, Speed, Link Produk, dll"></textarea>
                                </div>

                                <div class="row g-2 mb-3">
                                    <div class="col-6">
                                        <label class="form-label small fw-bold">Est. Harga Total</label>
                                        <div class="input-group">
                                            <span class="input-group-text">Rp</span>
                                            <input type="text" class="form-control currency-input" id="order-est-price" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label small fw-bold">Uang Muka (DP)</label>
                                        <div class="input-group">
                                            <span class="input-group-text">Rp</span>
                                            <input type="text" class="form-control currency-input" id="order-dp" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Penanggung Jawab</label>
                                    <select class="form-select" id="order-staff-select">
                                        <option value="">Pilih Staff/Teknisi</option>
                                    </select>
                                </div>

                                <div class="d-grid">
                                    <button type="submit" class="btn btn-success fw-bold py-2">
                                        <i class="bi bi-save me-2"></i>Simpan Pesanan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="col-lg-8">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-white py-3">
                            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                                <h5 class="mb-0 fw-bold text-success">Monitoring Pesanan</h5>
                                <div class="d-flex flex-wrap gap-2">
                                    <div class="input-group input-group-sm" style="width: 200px;">
                                        <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                                        <input type="text" class="form-control" id="search-order" placeholder="Cari Nama/HP/Barang...">
                                    </div>
                                    <select class="form-select form-select-sm" id="order-status-filter" style="width: 150px;">
                                        <option value="">Semua Status</option>
                                        <option value="Pending">Antrian (Pending)</option>
                                        <option value="Searching">Mencari Barang</option>
                                        <option value="Ordered">Sudah Dipesan</option>
                                        <option value="Arrived">Sudah Sampai</option>
                                        <option value="Picked_Up">Sudah Diambil</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="card-body bg-light">
                            <div id="orders-container" class="row g-3"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modals -->
            <div class="modal fade" id="editOrderModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Pesanan</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-order-form">
                                <input type="hidden" id="edit-order-id">
                                <div class="mb-3">
                                    <label class="form-label">Nama Barang</label>
                                    <input type="text" class="form-control" id="edit-order-item-name">
                                </div>
                                <div class="row g-2 mb-3">
                                    <div class="col-6">
                                        <label class="form-label">Est. Harga</label>
                                        <div class="input-group">
                                            <span class="input-group-text">Rp</span>
                                            <input type="text" class="form-control currency-input" id="edit-order-price" inputmode="numeric">
                                        </div>
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label">DP</label>
                                        <div class="input-group">
                                            <span class="input-group-text">Rp</span>
                                            <input type="text" class="form-control currency-input" id="edit-order-dp" inputmode="numeric">
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Catatan</label>
                                    <textarea class="form-control" id="edit-order-notes"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" id="save-edit-order-btn">Simpan</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize currency inputs
        document.querySelectorAll('.currency-input').forEach(input => setupCurrencyInput(input));

        await this.loadTechnicians();
        await this.loadOrders();
        this.setupEventListeners();
    }

    async loadTechnicians() {
        try {
            const res = await api.getTechnicians();
            this.technicians = res.data;
            const opts = '<option value="">Pilih Staff</option>' + this.technicians.map(t => `<option value="${t._id}">${t.name}</option>`).join('');
            document.getElementById('order-staff-select').innerHTML = opts;
        } catch (e) { console.error('Gagal memuat staff'); }
    }

    async loadOrders() {
        const container = document.getElementById('orders-container');
        const filter = document.getElementById('order-status-filter').value;
        container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-success"></div></div>';

        try {
            const res = await api.getSpecialOrders(filter ? { status: filter } : {});
            this.orders = res.data.filter(o => o.status !== 'Cancelled');
            this.renderOrderList();
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    }

    renderOrderList() {
        const container = document.getElementById('orders-container');
        const searchTerm = document.getElementById('search-order')?.value.toLowerCase() || '';

        const filteredOrders = this.orders.filter(o => {
            const name = o.customer.name.toLowerCase();
            const phone = o.customer.phone.toLowerCase();
            const item = o.item_name.toLowerCase();
            return name.includes(searchTerm) || phone.includes(searchTerm) || item.includes(searchTerm);
        });

        if (filteredOrders.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted py-5"><p>${this.orders.length === 0 ? 'Tidak ada data pesanan.' : 'Tidak ada hasil pencarian.'}</p></div>`;
            return;
        }

        container.innerHTML = filteredOrders.map(o => {
            const badgeClass = {
                'Pending': 'bg-secondary',
                'Searching': 'bg-info text-dark',
                'Ordered': 'bg-primary',
                'Arrived': 'bg-success',
                'Picked_Up': 'bg-dark',
                'Cancelled': 'bg-danger'
            }[o.status] || 'bg-light text-dark';

            // Logika Durasi
            let durationLabel = 'Dipesan Sejak';
            let durationValue = calculateElapsedTime(o.timestamps.created_at);
            let durationColor = 'text-muted';

            if (o.status === 'Arrived') {
                durationLabel = 'Sampai Sejak';
                durationValue = calculateElapsedTime(o.timestamps.arrived_at);
                durationColor = 'text-success fw-bold';
            } else if (o.status === 'Picked_Up') {
                durationLabel = 'Total Waktu';
                durationValue = calculateElapsedTime(o.timestamps.created_at, o.timestamps.picked_up_at);
                durationColor = 'text-dark';
            }

            return `
            <div class="col-12">
                <div class="card border-0 shadow-sm mb-2 border-start border-4 ${o.status === 'Arrived' ? 'border-success' : 'border-info'}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h6 class="fw-bold mb-0 text-primary">${o.item_name}</h6>
                                <small class="text-muted">#${o.order_number} | ${formatDateTime(o.timestamps.created_at)}</small>
                            </div>
                            <div class="text-end">
                                <span class="badge ${badgeClass}">${o.status}</span>
                                <div class="small mt-1 ${durationColor}" style="font-size: 0.75rem">
                                    <i class="bi bi-clock me-1"></i>${durationValue}
                                </div>
                                <div class="text-muted" style="font-size: 0.65rem">${durationLabel}</div>
                            </div>
                        </div>
                        <div class="row small mb-3">
                            <div class="col-md-4">
                                <small class="text-secondary fw-bold">PELANGGAN</small>
                                <div class="fw-bold">${o.customer.name}</div>
                                <div class="text-muted">${o.customer.phone}</div>
                            </div>
                            <div class="col-md-4">
                                <small class="text-secondary fw-bold">ESTIMASI & DP</small>
                                <div>Total: ${formatCurrency(o.estimated_price)}</div>
                                <div>DP: <span class="text-success">${formatCurrency(o.down_payment)}</span></div>
                            </div>
                            <div class="col-md-4">
                                <small class="text-secondary fw-bold">SISA BAYAR</small>
                                <div class="h6 fw-bold text-danger mb-0">${formatCurrency(o.remaining_payment)}</div>
                                <div class="small text-muted">Ditangani: ${o.handled_by?.name || '-'}</div>
                            </div>
                        </div>
                        <div class="d-flex gap-2 border-top pt-2">
                            <select class="form-select form-select-sm" style="width: 150px" onchange="orderModule.updateStatus('${o._id}', this.value)">
                                <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Antrian</option>
                                <option value="Searching" ${o.status === 'Searching' ? 'selected' : ''}>Mencari</option>
                                <option value="Ordered" ${o.status === 'Ordered' ? 'selected' : ''}>Dipesan</option>
                                <option value="Arrived" ${o.status === 'Arrived' ? 'selected' : ''}>Sampai</option>
                                <option value="Picked_Up" ${o.status === 'Picked_Up' ? 'selected' : ''}>Diambil</option>
                            </select>
                            <button class="btn btn-sm btn-outline-primary" onclick="orderModule.openEdit('${o._id}')" title="Edit"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="orderModule.deleteOrder('${o._id}')" title="Batal"><i class="bi bi-trash"></i></button>
                            <button class="btn btn-sm btn-outline-dark" onclick="orderModule.printInvoice('${o._id}')" title="Cetak Nota"><i class="bi bi-printer"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    printInvoice(id) {
        const o = this.orders.find(x => x._id === id);
        if(!o) return;
        
        const fileName = `Order_${o.customer.name}_${o.order_number}`.replace(/\s+/g, '_');

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <html><head><title>${fileName}</title><style>
                body { font-family: 'Courier New', monospace; padding: 20px; width: 80mm; font-size: 12px; }
                .header { text-align: center; border-bottom: 2px dashed #000; margin-bottom: 10px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .divider { border-top: 1px dashed #000; margin: 10px 0; }
                .bold { font-weight: bold; }
                .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            </style></head><body>
                <div class="header">
                    <div style="font-size: 16px; font-weight: bold;">BENGKEL UTC</div>
                    <div>Jln. Raya Siman, Ponorogo</div>
                    <div style="font-size: 10px;">PESANAN BARANG</div>
                </div>
                <div class="row"><span>No. Order</span> <span>${o.order_number}</span></div>
                <div class="row"><span>Tanggal</span> <span>${new Date(o.timestamps.created_at).toLocaleDateString('id-ID')}</span></div>
                <div class="row"><span>Pelanggan</span> <span>${o.customer.name}</span></div>
                <div class="row"><span>No. HP</span> <span>${o.customer.phone}</span></div>
                <div class="divider"></div>
                <div class="row bold"><span>Barang:</span></div>
                <div style="margin-bottom: 5px;">${o.item_name}</div>
                <div class="row"><span>Status</span> <span>${o.status}</span></div>
                <div class="divider"></div>
                <div class="row"><span>Est. Total</span> <span>${new Intl.NumberFormat('id-ID').format(o.estimated_price)}</span></div>
                <div class="row"><span>DP (Masuk)</span> <span>${new Intl.NumberFormat('id-ID').format(o.down_payment)}</span></div>
                <div class="divider"></div>
                <div class="row bold"><span>SISA BAYAR</span><span>${new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR'}).format(o.remaining_payment)}</span></div>
                <div class="footer"><p>Simpan nota ini sebagai bukti DP.</p><p>Terima Kasih!</p></div>
            </body></html>
        `);
        doc.close();
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 5000);
    }

    async updateStatus(id, newStatus) {
        try {
            await api.updateSpecialOrderStatus(id, newStatus);
            showToast('Status pesanan diperbarui');
            this.loadOrders();
        } catch (e) { showToast(e.message, 'error'); }
    }

    async deleteOrder(id) {
        if (!confirm('Batalkan pesanan ini?')) return;
        try {
            await api.deleteSpecialOrder(id);
            showToast('Pesanan dibatalkan');
            this.loadOrders();
        } catch (e) { showToast(e.message, 'error'); }
    }

    openEdit(id) {
        const o = this.orders.find(x => x._id === id);
        if(!o) return;
        document.getElementById('edit-order-id').value = o._id;
        document.getElementById('edit-order-item-name').value = o.item_name;
        
        // Currency formatting for edit
        const priceInput = document.getElementById('edit-order-price');
        const dpInput = document.getElementById('edit-order-dp');
        
        priceInput.value = o.estimated_price;
        dpInput.value = o.down_payment;
        
        setupCurrencyInput(priceInput);
        setupCurrencyInput(dpInput);
        
        document.getElementById('edit-order-notes').value = o.notes || '';
        new bootstrap.Modal(document.getElementById('editOrderModal')).show();
    }

    setupEventListeners() {
        document.getElementById('order-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                customer: {
                    name: document.getElementById('order-customer-name').value,
                    phone: document.getElementById('order-customer-phone').value
                },
                item_name: document.getElementById('order-item-name').value,
                item_description: document.getElementById('order-item-desc').value,
                estimated_price: parseCurrencyValue(document.getElementById('order-est-price').value),
                down_payment: parseCurrencyValue(document.getElementById('order-dp').value),
                handled_by_id: document.getElementById('order-staff-select').value
            };
            try {
                await api.createSpecialOrder(data);
                showToast('Pesanan berhasil disimpan');
                document.getElementById('order-form').reset();
                this.loadOrders();
            } catch (e) { showToast(e.message, 'error'); }
        });

        document.getElementById('save-edit-order-btn').addEventListener('click', async () => {
            const id = document.getElementById('edit-order-id').value;
            const data = {
                item_name: document.getElementById('edit-order-item-name').value,
                estimated_price: parseCurrencyValue(document.getElementById('edit-order-price').value),
                down_payment: parseCurrencyValue(document.getElementById('edit-order-dp').value),
                notes: document.getElementById('edit-order-notes').value
            };
            try {
                await api.updateSpecialOrderDetails(id, data);
                showToast('Perubahan disimpan');
                bootstrap.Modal.getInstance(document.getElementById('editOrderModal')).hide();
                this.loadOrders();
            } catch (e) { showToast(e.message, 'error'); }
        });

        document.getElementById('order-status-filter').addEventListener('change', () => this.loadOrders());
        document.getElementById('search-order').addEventListener('input', () => this.renderOrderList());
    }
}

export default Order;