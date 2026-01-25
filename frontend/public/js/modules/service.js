// public/js/modules/service.js - Modul Manajemen Servis Bengkel

import api, { formatCurrency, formatDateTime, showToast, showError } from '../api.js';

class Service {
    constructor() {
        this.tickets = [];
        this.technicians = [];
        this.items = [];
    }

    async render() {
        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4">
                <div class="col-lg-4">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-primary text-white py-3">
                            <h5 class="mb-0"><i class="bi bi-plus-circle me-2"></i>Tiket Servis Baru</h5>
                        </div>
                        <div class="card-body">
                            <form id="service-form">
                                <h6 class="border-bottom pb-2 mb-3 fw-bold text-secondary">Informasi Pelanggan</h6>
                                
                                <div class="mb-3">
                                    <label class="form-label">Nama Pelanggan *</label>
                                    <input type="text" class="form-control" id="customer-name" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Nomor Telepon *</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                                        <input type="tel" class="form-control" id="customer-phone" required>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Tipe Pelanggan *</label>
                                    <select class="form-select" id="customer-type" required>
                                        <option value="">Pilih Tipe</option>
                                        <option value="Mahasiswa">Mahasiswa</option>
                                        <option value="Dosen">Dosen</option>
                                        <option value="Umum">Umum</option>
                                    </select>
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Informasi Perangkat</h6>

                                <div class="mb-3">
                                    <label class="form-label">Tipe Perangkat *</label>
                                    <input type="text" class="form-control" id="device-type" 
                                           placeholder="Contoh: Laptop, PC, Printer" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Merek (Brand)</label>
                                    <input type="text" class="form-control" id="device-brand" 
                                           placeholder="Contoh: ASUS, HP, Lenovo">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Model / Tipe</label>
                                    <input type="text" class="form-control" id="device-model">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Nomor Seri (SN)</label>
                                    <input type="text" class="form-control" id="device-serial">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Keluhan / Masalah *</label>
                                    <textarea class="form-control" id="device-symptoms" rows="3" 
                                              placeholder="Jelaskan kendala perangkat..." required></textarea>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Kelengkapan</label>
                                    <input type="text" class="form-control" id="device-accessories" 
                                           placeholder="Contoh: Charger, Tas, Mouse">
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Penugasan</h6>

                                <div class="mb-3">
                                    <label class="form-label">Pilih Teknisi *</label>
                                    <select class="form-select" id="technician-select" required>
                                        <option value="">Memuat data teknisi...</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Biaya Jasa Awal</label>
                                    <div class="input-group">
                                        <span class="input-group-text">Rp</span>
                                        <input type="number" class="form-control" id="service-fee" 
                                           value="0" min="0">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Catatan Tambahan</label>
                                    <textarea class="form-control" id="service-notes" rows="2"></textarea>
                                </div>

                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary fw-bold py-2">
                                        <i class="bi bi-check-circle me-2"></i>Buat Tiket Servis
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="col-lg-8">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-header bg-white py-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="mb-0 fw-bold"><i class="bi bi-list-task me-2 text-primary"></i>Tiket Servis Aktif</h5>
                                <button class="btn btn-sm btn-outline-primary" id="refresh-tickets-btn" title="Muat Ulang">
                                    <i class="bi bi-arrow-clockwise"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <div class="input-group">
                                    <span class="input-group-text bg-light"><i class="bi bi-funnel"></i></span>
                                    <select class="form-select" id="status-filter">
                                        <option value="">Semua Status</option>
                                        <option value="Queue">Antrian (Queue)</option>
                                        <option value="Diagnosing">Diagnosis (Diagnosing)</option>
                                        <option value="Waiting_Part">Menunggu Sparepart (Waiting Part)</option>
                                        <option value="In_Progress">Sedang Dikerjakan (In Progress)</option>
                                        <option value="Completed">Selesai (Completed)</option>
                                    </select>
                                </div>
                            </div>

                            <div id="tickets-container" style="max-height: 800px; overflow-y: auto;">
                                </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="addPartModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Tambah Suku Cadang / Sparepart</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="add-part-form">
                                <input type="hidden" id="part-ticket-id">
                                
                                <div class="mb-3">
                                    <label class="form-label">Pilih Barang *</label>
                                    <select class="form-select" id="part-item-select" required>
                                        <option value="">Pilih barang...</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Jumlah *</label>
                                    <input type="number" class="form-control" id="part-quantity" 
                                           min="1" value="1" required>
                                </div>

                                <div class="alert alert-info d-flex align-items-center">
                                    <i class="bi bi-info-circle me-3 fs-4"></i>
                                    <div>
                                        Stok gudang akan otomatis berkurang saat Anda menambahkan suku cadang ini.
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" id="save-part-btn">
                                <i class="bi bi-plus-circle me-2"></i>Tambahkan
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadTechnicians();
        await this.loadTickets();
        await this.loadItems();
        this.setupEventListeners();
    }

    async loadTechnicians() {
        try {
            const response = await api.getTechnicians();
            this.technicians = response.data;
            
            const select = document.getElementById('technician-select');
            select.innerHTML = '<option value="">Pilih Teknisi</option>' +
                this.technicians.map(tech => 
                    `<option value="${tech._id}">${tech.name}</option>`
                ).join('');
        } catch (error) {
            showToast('Gagal memuat data teknisi', 'error');
        }
    }

    async loadItems() {
        try {
            const response = await api.getInventory({ limit: 100 });
            this.items = response.data.filter(item => item.stock > 0);
            
            const select = document.getElementById('part-item-select');
            select.innerHTML = '<option value="">Pilih barang...</option>' +
                this.items.map(item => 
                    `<option value="${item._id}">${item.name} - Stok: ${item.stock} - ${formatCurrency(item.selling_price)}</option>`
                ).join('');
        } catch (error) {
            console.error('Gagal memuat barang:', error);
        }
    }

    async loadTickets() {
        const container = document.getElementById('tickets-container');
        const statusFilter = document.getElementById('status-filter').value;
        
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2 text-muted">Memuat tiket...</p>
            </div>
        `;

        try {
            const params = statusFilter ? { status: statusFilter } : {};
            const response = await api.getServiceTickets(params);
            this.tickets = response.data;
            
            this.renderTickets();
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }

    // Fungsi Helper untuk menerjemahkan status backend ke Bahasa Indonesia
    translateStatus(status) {
        const statusMap = {
            'Queue': 'Antrian',
            'Diagnosing': 'Diagnosis',
            'Waiting_Part': 'Menunggu Sparepart',
            'In_Progress': 'Sedang Dikerjakan',
            'Completed': 'Selesai',
            'Picked_Up': 'Sudah Diambil'
        };
        return statusMap[status] || status.replace('_', ' ');
    }

    renderTickets() {
        const container = document.getElementById('tickets-container');
        
        if (this.tickets.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox fs-1 opacity-50"></i>
                    <p class="mt-2 fw-semibold">Belum ada tiket servis</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tickets.map(ticket => {
            const displayStatus = this.translateStatus(ticket.status);
            const nextStatusRaw = this.getNextStatus(ticket.status);
            const nextStatusDisplay = this.translateStatus(nextStatusRaw);

            // Tentukan warna badge berdasarkan status
            let badgeClass = 'bg-secondary';
            if (ticket.status === 'Queue') badgeClass = 'bg-secondary';
            else if (ticket.status === 'Diagnosing') badgeClass = 'bg-info text-dark';
            else if (ticket.status === 'Waiting_Part') badgeClass = 'bg-warning text-dark';
            else if (ticket.status === 'In_Progress') badgeClass = 'bg-primary';
            else if (ticket.status === 'Completed') badgeClass = 'bg-success';

            return `
            <div class="card mb-3 border border-light shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h6 class="mb-1 d-flex align-items-center">
                                <strong class="text-primary me-2">${ticket.ticket_number}</strong>
                                <span class="badge ${badgeClass}">${displayStatus}</span>
                            </h6>
                            <small class="text-muted">
                                <i class="bi bi-calendar me-1"></i>${formatDateTime(ticket.timestamps.created_at)}
                            </small>
                        </div>
                        <div class="text-end">
                            <small class="text-muted">Total Biaya</small><br>
                            <strong class="text-success fs-5">${formatCurrency(ticket.total_cost)}</strong>
                        </div>
                    </div>

                    <div class="row g-3 mb-3 bg-light p-2 rounded mx-0">
                        <div class="col-md-6">
                            <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Pelanggan</small>
                            <strong class="text-dark">${ticket.customer.name}</strong><br>
                            <small class="text-muted">${ticket.customer.phone} • ${ticket.customer.type}</small>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Perangkat</small>
                            <strong class="text-dark">${ticket.device.type} ${ticket.device.brand || ''}</strong><br>
                            <small class="text-danger fst-italic">"${ticket.device.symptoms}"</small>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Teknisi</small>
                            <strong><i class="bi bi-person-badge me-1"></i>${ticket.technician.name}</strong>
                        </div>
                        ${ticket.parts_used.length > 0 ? `
                        <div class="col-md-6">
                            <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Suku Cadang</small>
                            ${ticket.parts_used.map(part => `
                                <div class="small"><i class="bi bi-gear me-1"></i>${part.name} (x${part.qty})</div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>

                    <div class="d-flex gap-2">
                        ${ticket.status !== 'Completed' && ticket.status !== 'Picked_Up' ? `
                            <button class="btn btn-sm btn-outline-primary" onclick="service.openAddPartModal('${ticket._id}')">
                                <i class="bi bi-plus-circle me-1"></i>Tambah Part
                            </button>
                            <button class="btn btn-sm btn-success text-white" onclick="service.updateStatus('${ticket._id}', '${nextStatusRaw}')">
                                <i class="bi bi-arrow-right-circle me-1"></i>Lanjut: ${nextStatusDisplay}
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-secondary ms-auto" onclick="service.viewTicketDetails('${ticket._id}')">
                            <i class="bi bi-eye me-1"></i>Detail JSON
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }

    getNextStatus(currentStatus) {
        const statusFlow = {
            'Queue': 'Diagnosing',
            'Diagnosing': 'In_Progress',
            'Waiting_Part': 'In_Progress',
            'In_Progress': 'Completed',
            'Completed': 'Picked_Up'
        };
        return statusFlow[currentStatus] || 'Completed';
    }

    setupEventListeners() {
        // Submit form servis
        document.getElementById('service-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createTicket();
        });

        // Filter status
        document.getElementById('status-filter').addEventListener('change', () => {
            this.loadTickets();
        });

        // Refresh tiket
        document.getElementById('refresh-tickets-btn').addEventListener('click', () => {
            this.loadTickets();
        });

        // Simpan part
        document.getElementById('save-part-btn').addEventListener('click', async () => {
            await this.addPart();
        });
    }

    async createTicket() {
        const formData = {
            customer: {
                name: document.getElementById('customer-name').value,
                phone: document.getElementById('customer-phone').value,
                type: document.getElementById('customer-type').value
            },
            device: {
                type: document.getElementById('device-type').value,
                brand: document.getElementById('device-brand').value,
                model: document.getElementById('device-model').value,
                serial_number: document.getElementById('device-serial').value,
                symptoms: document.getElementById('device-symptoms').value,
                accessories: document.getElementById('device-accessories').value || 'Tidak ada'
            },
            technician_id: document.getElementById('technician-select').value,
            service_fee: parseInt(document.getElementById('service-fee').value) || 0,
            notes: document.getElementById('service-notes').value
        };

        try {
            const response = await api.createServiceTicket(formData);
            
            if (response.success) {
                showToast('Tiket servis berhasil dibuat!', 'success');
                document.getElementById('service-form').reset();
                await this.loadTickets();
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    openAddPartModal(ticketId) {
        document.getElementById('part-ticket-id').value = ticketId;
        const modal = new bootstrap.Modal(document.getElementById('addPartModal'));
        modal.show();
    }

    async addPart() {
        const ticketId = document.getElementById('part-ticket-id').value;
        const itemId = document.getElementById('part-item-select').value;
        const quantity = parseInt(document.getElementById('part-quantity').value);

        if (!itemId || !quantity) {
            showToast('Mohon pilih barang dan jumlah', 'error');
            return;
        }

        try {
            const response = await api.addPartToService(ticketId, itemId, quantity);
            
            if (response.success) {
                showToast('Suku cadang berhasil ditambahkan! Stok berkurang.', 'success');
                bootstrap.Modal.getInstance(document.getElementById('addPartModal')).hide();
                await this.loadTickets();
                await this.loadItems(); // Reload untuk update stok di dropdown
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async updateStatus(ticketId, newStatus) {
        const displayStatus = this.translateStatus(newStatus);
        if (!confirm(`Ubah status menjadi "${displayStatus}"?`)) return;

        try {
            await api.updateTicketStatus(ticketId, newStatus);
            showToast('Status berhasil diperbarui!', 'success');
            await this.loadTickets();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    viewTicketDetails(ticketId) {
        const ticket = this.tickets.find(t => t._id === ticketId);
        if (!ticket) return;

        alert(`Detail Tiket:\n\n${JSON.stringify(ticket, null, 2)}`);
    }
}

// Membuat method service dapat diakses secara global
window.service = new Service();

export default Service;