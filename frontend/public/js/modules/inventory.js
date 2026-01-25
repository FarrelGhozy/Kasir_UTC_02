// public/js/modules/inventory.js - Modul Manajemen Gudang (Inventaris)

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
            <div class="card shadow-sm border-0">
                <div class="card-header bg-white py-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0 fw-bold"><i class="bi bi-box-seam me-2"></i>Manajemen Gudang</h5>
                        <button class="btn btn-primary" onclick="inventory.openItemModal()">
                            <i class="bi bi-plus-circle me-2"></i>Tambah Barang
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row g-3 mb-4">
                        <div class="col-md-6">
                            <div class="search-bar">
                                <div class="input-group">
                                    <span class="input-group-text bg-light border-end-0"><i class="bi bi-search"></i></span>
                                    <input type="text" class="form-control border-start-0 ps-0" id="inventory-search" 
                                           placeholder="Cari nama barang atau SKU...">
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="inventory-category-filter">
                                <option value="all">Semua Kategori</option>
                                <option value="Sparepart">Suku Cadang</option>
                                <option value="Accessory">Aksesoris</option>
                                <option value="Software">Software</option>
                                <option value="Other">Lainnya</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-outline-primary w-100" id="refresh-inventory-btn">
                                <i class="bi bi-arrow-clockwise me-2"></i>Muat Ulang
                            </button>
                        </div>
                    </div>

                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead class="table-light">
                                <tr>
                                    <th>SKU</th>
                                    <th>Nama Barang</th>
                                    <th>Kategori</th>
                                    <th>Harga Beli</th>
                                    <th>Harga Jual</th>
                                    <th>Stok</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody id="inventory-table-body">
                                <tr>
                                    <td colspan="8" class="text-center py-5">
                                        <div class="spinner-border text-primary"></div>
                                        <p class="mt-2 text-muted">Memuat data barang...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="itemModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="itemModalTitle">Tambah Barang Baru</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="item-form" novalidate>
                                <input type="hidden" id="item-id">
                                
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">SKU *</label>
                                        <input type="text" class="form-control" id="item-sku" placeholder="Kode unik barang" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Kategori *</label>
                                        <select class="form-select" id="item-category" required>
                                            <option value="">Pilih Kategori</option>
                                            <option value="Sparepart">Suku Cadang</option>
                                            <option value="Accessory">Aksesoris</option>
                                            <option value="Software">Software</option>
                                            <option value="Other">Lainnya</option>
                                        </select>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Nama Barang *</label>
                                        <input type="text" class="form-control" id="item-name" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Harga Beli (HPP) *</label>
                                        <div class="input-group">
                                            <span class="input-group-text">Rp</span>
                                            <input type="number" class="form-control" id="item-purchase-price" min="0" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Harga Jual *</label>
                                        <div class="input-group">
                                            <span class="input-group-text">Rp</span>
                                            <input type="number" class="form-control" id="item-selling-price" min="0" required>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Stok Awal</label>
                                        <input type="number" class="form-control" id="item-stock" min="0" value="0">
                                        <small class="text-muted d-none" id="stock-edit-hint">Gunakan tombol "Sesuaikan Stok" di tabel utama untuk mengubah stok.</small>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Peringatan Stok Minimum *</label>
                                        <input type="number" class="form-control" id="item-min-stock" min="0" value="5" required>
                                        <div class="form-text">Sistem akan memberi peringatan jika stok di bawah angka ini.</div>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Deskripsi</label>
                                        <textarea class="form-control" id="item-description" rows="3"></textarea>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" id="save-item-btn">
                                <i class="bi bi-save me-2"></i>Simpan Barang
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="stockModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Penyesuaian Stok</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="stock-item-id">
                            <div class="alert alert-info border-0 bg-info bg-opacity-10">
                                <strong id="stock-item-name" class="d-block mb-1"></strong>
                                Stok Saat Ini: <strong id="stock-current">0</strong>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Jenis Penyesuaian</label>
                                <select class="form-select" id="stock-type">
                                    <option value="add">Tambah Stok (Restock)</option>
                                    <option value="deduct">Kurangi Stok (Koreksi/Rusak)</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Jumlah</label>
                                <input type="number" class="form-control" id="stock-quantity" 
                                       min="1" value="1" required>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" id="save-stock-btn">
                                <i class="bi bi-check-circle me-2"></i>Simpan Perubahan
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
                    <td colspan="8" class="text-center text-muted py-5">
                        <i class="bi bi-box-seam fs-1 d-block mb-2 opacity-50"></i>
                        Barang tidak ditemukan
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.items.map(item => {
            const stockBadge = item.stock <= item.min_stock_alert 
                ? '<span class="badge bg-danger">Menipis</span>'
                : item.stock <= item.min_stock_alert * 2
                ? '<span class="badge bg-warning text-dark">Sedang</span>'
                : '<span class="badge bg-success">Aman</span>';

            // Terjemahan Kategori untuk tampilan tabel
            const categoryMap = {
                'Sparepart': 'Suku Cadang',
                'Accessory': 'Aksesoris',
                'Software': 'Software',
                'Other': 'Lainnya'
            };
            const displayCategory = categoryMap[item.category] || item.category;

            return `
                <tr>
                    <td><code class="text-primary fw-bold">${item.sku}</code></td>
                    <td><strong>${item.name}</strong></td>
                    <td><span class="badge bg-secondary bg-opacity-75">${displayCategory}</span></td>
                    <td>${formatCurrency(item.purchase_price)}</td>
                    <td>${formatCurrency(item.selling_price)}</td>
                    <td><strong>${item.stock}</strong></td>
                    <td>${stockBadge}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="inventory.openStockModal('${item._id}', '${item.name}', ${item.stock})" title="Sesuaikan Stok">
                                <i class="bi bi-arrow-left-right"></i>
                            </button>
                            <button class="btn btn-outline-secondary" onclick="inventory.editItem('${item._id}')" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="inventory.deleteItem('${item._id}', '${item.name}')" title="Hapus">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    setupEventListeners() {
        // Cari
        document.getElementById('inventory-search').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.loadItems();
        });

        // Filter Kategori
        document.getElementById('inventory-category-filter').addEventListener('change', (e) => {
            this.categoryFilter = e.target.value;
            this.loadItems();
        });

        // Tombol Muat Ulang
        document.getElementById('refresh-inventory-btn').addEventListener('click', () => {
            this.loadItems();
        });

        // Simpan Barang
        document.getElementById('save-item-btn').addEventListener('click', () => {
            this.saveItem();
        });

        // Simpan Penyesuaian Stok
        document.getElementById('save-stock-btn').addEventListener('click', () => {
            this.adjustStock();
        });
    }

    openItemModal(itemId = null) {
        // Gunakan getOrCreateInstance untuk mencegah instansi modal ganda
        const modalEl = document.getElementById('itemModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        
        document.getElementById('item-form').reset();
        const stockInput = document.getElementById('item-stock');
        const stockHint = document.getElementById('stock-edit-hint');
        
        if (itemId) {
            document.getElementById('itemModalTitle').textContent = 'Edit Barang';
            const item = this.items.find(i => i._id === itemId);
            if (item) {
                document.getElementById('item-id').value = item._id;
                document.getElementById('item-sku').value = item.sku;
                document.getElementById('item-name').value = item.name;
                document.getElementById('item-category').value = item.category;
                document.getElementById('item-purchase-price').value = item.purchase_price;
                document.getElementById('item-selling-price').value = item.selling_price;
                
                // Nonaktifkan edit stok di mode edit
                stockInput.value = item.stock;
                stockInput.disabled = true;
                stockHint.classList.remove('d-none');
                
                document.getElementById('item-min-stock').value = item.min_stock_alert;
                document.getElementById('item-description').value = item.description || '';
            }
        } else {
            document.getElementById('itemModalTitle').textContent = 'Tambah Barang Baru';
            document.getElementById('item-id').value = '';
            
            // Aktifkan input stok untuk barang baru
            stockInput.disabled = false;
            stockInput.value = 0;
            stockHint.classList.add('d-none');
        }
        
        modal.show();
    }

    async saveItem() {
        const form = document.getElementById('item-form');

        // 1. Cek Validasi HTML5
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const itemId = document.getElementById('item-id').value;

        // 2. Pengumpulan Data Aman
        const itemData = {
            sku: document.getElementById('item-sku').value.trim(),
            name: document.getElementById('item-name').value.trim(),
            category: document.getElementById('item-category').value,
            purchase_price: parseFloat(document.getElementById('item-purchase-price').value) || 0,
            selling_price: parseFloat(document.getElementById('item-selling-price').value) || 0,
            min_stock_alert: parseInt(document.getElementById('item-min-stock').value) || 0,
            description: document.getElementById('item-description').value
        };

        // Hanya sertakan stok jika membuat barang baru
        if (!itemId) {
            itemData.stock = parseInt(document.getElementById('item-stock').value) || 0;
        }

        try {
            if (itemId) {
                await api.updateItem(itemId, itemData);
                showToast('Barang berhasil diperbarui', 'success');
            } else {
                await api.createItem(itemData);
                showToast('Barang baru berhasil ditambahkan', 'success');
            }

            // Tutup modal dengan aman
            const modalEl = document.getElementById('itemModal');
            bootstrap.Modal.getInstance(modalEl).hide();
            
            await this.loadItems();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    editItem(itemId) {
        this.openItemModal(itemId);
    }

    async deleteItem(itemId, itemName) {
        if (!confirmDialog(`Apakah Anda yakin ingin menghapus "${itemName}"?`)) return;

        try {
            await api.deleteItem(itemId);
            showToast('Barang berhasil dihapus', 'success');
            await this.loadItems();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    openStockModal(itemId, itemName, currentStock) {
        const modalEl = document.getElementById('stockModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

        document.getElementById('stock-item-id').value = itemId;
        document.getElementById('stock-item-name').textContent = itemName;
        document.getElementById('stock-current').textContent = currentStock;
        document.getElementById('stock-quantity').value = 1;
        
        modal.show();
    }

    async adjustStock() {
        const itemId = document.getElementById('stock-item-id').value;
        const type = document.getElementById('stock-type').value;
        const quantity = parseInt(document.getElementById('stock-quantity').value);

        if (!quantity || quantity < 1) {
            showToast('Mohon masukkan jumlah yang valid', 'error');
            return;
        }

        try {
            await api.patch(`/inventory/${itemId}/stock`, { quantity, type });
            showToast(`Stok berhasil ${type === 'add' ? 'ditambahkan' : 'dikurangi'}`, 'success');
            
            const modalEl = document.getElementById('stockModal');
            bootstrap.Modal.getInstance(modalEl).hide();
            
            await this.loadItems();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}

// Buat inventory dapat diakses secara global
window.inventory = new Inventory();

export default Inventory;