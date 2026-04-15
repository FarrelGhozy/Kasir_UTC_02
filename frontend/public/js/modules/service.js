// public/js/modules/service.js - Modul Manajemen Servis (FIXED: Add Part & Detail View)

import api, { formatCurrency, formatDateTime, showToast, showError } from '../api.js';

/**
 * Helper class for Pattern Lock UI
 */
class PatternLock {
    constructor(containerId, inputId) {
        this.containerId = containerId;
        this.inputId = inputId;
        this.sequence = [];
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="pattern-lock-container">
                <div class="pattern-sequence-display" id="${this.containerId}-display">Pola: -</div>
                <div class="pattern-grid">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                        <div class="pattern-dot" data-index="${num}">${num}</div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="${this.containerId}-reset">
                    <i class="bi bi-arrow-counterclockwise me-1"></i>Reset Pola
                </button>
            </div>
        `;

        const dots = container.querySelectorAll('.pattern-dot');
        dots.forEach(dot => {
            dot.addEventListener('click', () => this.toggleDot(dot));
        });

        const resetBtn = document.getElementById(`${this.containerId}-reset`);
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
    }

    toggleDot(dotEl) {
        const index = dotEl.dataset.index;
        
        // If already in sequence, don't add again (typical pattern behavior)
        if (this.sequence.includes(index)) {
            // Optional: allow removing the LAST added dot
            if (this.sequence[this.sequence.length - 1] === index) {
                this.sequence.pop();
                dotEl.classList.remove('active');
            }
            this.updateDisplay();
            return;
        }

        this.sequence.push(index);
        dotEl.classList.add('active');
        this.updateDisplay();
    }

    updateDisplay() {
        const display = document.getElementById(`${this.containerId}-display`);
        const input = document.getElementById(this.inputId);
        
        const seqStr = this.sequence.join('');
        if (display) display.textContent = `Pola: ${seqStr || '-'}`;
        if (input) input.value = seqStr;
    }

    reset() {
        this.sequence = [];
        const container = document.getElementById(this.containerId);
        if (container) {
            container.querySelectorAll('.pattern-dot').forEach(dot => {
                dot.classList.remove('active');
            });
        }
        this.updateDisplay();
    }

    setSequence(seqStr) {
        this.reset();
        if (!seqStr) return;
        
        const indices = String(seqStr).split('');
        const container = document.getElementById(this.containerId);
        
        indices.forEach(idx => {
            if (['1','2','3','4','5','6','7','8','9'].includes(idx)) {
                this.sequence.push(idx);
                if (container) {
                    const dot = container.querySelector(`.pattern-dot[data-index="${idx}"]`);
                    if (dot) dot.classList.add('active');
                }
            }
        });
        this.updateDisplay();
    }
}

class Service {
    constructor() {
        this.tickets = [];
        this.technicians = [];
        this.items = [];
        this.mainPatternLock = null;
        this.editPatternLock = null;
    }

    async render() {
        // PERBAIKAN: Pastikan global 'service' merujuk ke instance yang aktif
        window.service = this;

        // CSS Hack — inject only once
        if (!document.getElementById('service-number-style')) {
            const style = document.createElement('style');
            style.id = 'service-number-style';
            style.innerHTML = `
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; margin: 0; 
                }
                input[type=number] { -moz-appearance: textfield; }
            `;
            document.head.appendChild(style);
        }

        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4">
                <div class="col-lg-4">
                    <div class="card shadow-sm border-0 sticky-top" style="top: 20px; z-index: 1;">
                        <div class="card-header bg-primary text-white py-3">
                            <h5 class="mb-0"><i class="bi bi-plus-circle me-2"></i>Tiket Servis Baru</h5>
                        </div>
                        <div class="card-body">
                            <form id="service-form">
                                <h6 class="border-bottom pb-2 mb-3 fw-bold text-secondary">Informasi Pelanggan</h6>
                                
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nama Pelanggan *</label>
                                    <input type="text" class="form-control" id="customer-name" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nomor Telepon *</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="bi bi-whatsapp"></i></span>
                                        <input type="tel" class="form-control" id="customer-phone" required>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Tipe Pelanggan *</label>
                                    <select class="form-select" id="customer-type" required>
                                        <option value="Umum">Umum</option>
                                        <option value="Mahasiswa">Mahasiswa</option>
                                        <option value="Dosen">Dosen</option>
                                    </select>
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Perangkat & Masalah</h6>

                                <div class="row g-2 mb-3">
                                    <div class="col-6">
                                        <label class="form-label small fw-bold">Tipe *</label>
                                        <input type="text" class="form-control" id="device-type" placeholder="Laptop/PC" required>
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label small fw-bold">Merek</label>
                                        <input type="text" class="form-control" id="device-brand" placeholder="Asus/HP">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Model / Seri</label>
                                    <input type="text" class="form-control" id="device-model">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Keluhan / Kerusakan *</label>
                                    <textarea class="form-control" id="device-symptoms" rows="2" required></textarea>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Kelengkapan</label>
                                    <input type="text" class="form-control" id="device-accessories" placeholder="Charger, Tas...">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Password / Sandi</label>
                                    <input type="text" class="form-control" id="device-password" placeholder="1234">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Pola Keamanan</label>
                                    <input type="hidden" id="device-pattern">
                                    <div id="main-pattern-selector"></div>
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Estimasi & Tugas</h6>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Teknisi *</label>
                                    <select class="form-select" id="technician-select" required>
                                        <option value="">Memuat...</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Estimasi Biaya Jasa</label>
                                    <div class="input-group">
                                        <span class="input-group-text">Rp</span>
                                        <input type="number" class="form-control" id="service-fee" value="0" min="0">
                                    </div>
                                    <div class="form-text">Biaya final ditentukan saat selesai.</div>
                                </div>

                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary fw-bold py-2">
                                        <i class="bi bi-save me-2"></i>Buat Tiket
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <div class="col-lg-8">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-header bg-white py-3">
                            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                                <h5 class="mb-0 fw-bold text-primary">Daftar Servis Aktif</h5>
                                <div class="d-flex flex-wrap gap-2">
                                    <div class="input-group input-group-sm" style="width: 200px;">
                                        <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                                        <input type="text" class="form-control" id="search-customer" placeholder="Cari Nama / HP...">
                                    </div>
                                    <select class="form-select form-select-sm" id="status-filter" style="width: 150px;">
                                        <option value="">Semua Status</option>
                                        <option value="Queue">Antrian</option>
                                        <option value="Diagnosing">Diagnosa</option>
                                        <option value="Waiting_Part">Tunggu Part</option>
                                        <option value="In_Progress">Dikerjakan</option>
                                        <option value="Completed">Selesai</option>
                                    </select>
                                    <button class="btn btn-sm btn-outline-primary" id="refresh-tickets-btn">
                                        <i class="bi bi-arrow-clockwise"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="card-body bg-light">
                            <div id="tickets-container" class="row g-3">
                                </div>
                        </div>
                    </div>
                </div>
            </div>

            ${this.renderModals()}
        `;

        // Initialize Pattern Lock UI
        this.mainPatternLock = new PatternLock('main-pattern-selector', 'device-pattern');
        this.mainPatternLock.init();

        await this.loadTechnicians();
        await this.loadTickets();
        await this.loadItems();
        this.setupEventListeners();
    }

    renderModals() {
        return `
            <div class="modal fade" id="editTicketModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Data Tiket</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-ticket-form">
                                <input type="hidden" id="edit-ticket-id">
                                <div class="mb-3">
                                    <label class="form-label">Nama Pelanggan</label>
                                    <input type="text" class="form-control" id="edit-customer-name" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">No. Telepon</label>
                                    <input type="text" class="form-control" id="edit-customer-phone" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Perangkat (Tipe/Merek)</label>
                                    <input type="text" class="form-control" id="edit-device-full">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Keluhan</label>
                                    <textarea class="form-control" id="edit-symptoms" rows="3"></textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Password</label>
                                    <input type="text" class="form-control" id="edit-device-password">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Pola Keamanan</label>
                                    <input type="hidden" id="edit-device-pattern">
                                    <div id="edit-pattern-selector"></div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" id="save-edit-btn">Simpan Perubahan</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="addPartModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Pasang Sparepart</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="part-ticket-id">
                            <div class="mb-3">
                                <label class="form-label">Cari Barang</label>
                                <select class="form-select" id="part-item-select"></select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Jumlah</label>
                                <input type="number" class="form-control" id="part-quantity" value="1" min="1">
                            </div>
                            <div class="alert alert-warning small">
                                <i class="bi bi-exclamation-triangle me-1"></i> Stok gudang akan langsung berkurang.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary w-100" id="save-part-btn">Tambahkan</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="finalizeModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title"><i class="bi bi-check-circle-fill me-2"></i>Selesaikan Servis</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="final-ticket-id">
                            <div class="d-flex justify-content-between mb-2">
                                <span>Total Sparepart:</span>
                                <strong id="final-part-cost">Rp 0</strong>
                            </div>
                            <div class="mb-4">
                                <label class="form-label fw-bold">Biaya Jasa Final</label>
                                <div class="input-group">
                                    <span class="input-group-text bg-white">Rp</span>
                                    <input type="number" class="form-control form-control-lg fw-bold text-end" id="final-service-fee" min="0">
                                </div>
                            </div>
                            <div class="d-flex justify-content-between p-3 bg-light rounded border">
                                <span class="h5 mb-0">Grand Total:</span>
                                <span class="h4 mb-0 fw-bold text-primary" id="final-grand-total">Rp 0</span>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-success fw-bold" id="confirm-finish-btn">
                                <i class="bi bi-printer me-2"></i>Simpan & Cetak Nota
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="detailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">Detail Tiket Servis</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="detail-content"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Tutup</button>
                            <button type="button" class="btn btn-primary" id="print-copy-btn">
                                <i class="bi bi-printer me-2"></i>Cetak Salinan
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- DATA LOADING ---

    async loadTechnicians() {
        try {
            const res = await api.getTechnicians();
            this.technicians = res.data;
            const opts = '<option value="">Pilih Teknisi</option>' + this.technicians.map(t => `<option value="${t._id}">${t.name}</option>`).join('');
            document.getElementById('technician-select').innerHTML = opts;
        } catch (e) { console.error('Gagal memuat teknisi'); }
    }

    async loadItems() {
        try {
            const res = await api.getInventory({ limit: 100 });
            this.items = res.data.filter(i => i.stock > 0);
            const opts = '<option value="">Pilih barang...</option>' + this.items.map(i => `<option value="${i._id}">${i.name} (Stok: ${i.stock})</option>`).join('');
            document.getElementById('part-item-select').innerHTML = opts;
        } catch (e) { console.error('Gagal memuat item'); }
    }

    async loadTickets() {
        const container = document.getElementById('tickets-container');
        const filter = document.getElementById('status-filter').value;
        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

        try {
            const res = await api.getServiceTickets(filter ? { status: filter } : {});
            this.tickets = res.data.filter(t => t.status !== 'Cancelled');
            this.renderTicketList();
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    }

    // --- RENDER LIST ---

    renderTicketList() {
        const container = document.getElementById('tickets-container');
        const searchTerm = document.getElementById('search-customer')?.value.toLowerCase() || '';

        const filteredTickets = this.tickets.filter(t => {
            const name = t.customer.name.toLowerCase();
            const phone = t.customer.phone.toLowerCase();
            return name.includes(searchTerm) || phone.includes(searchTerm);
        });

        if (filteredTickets.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted py-5"><i class="bi bi-clipboard-x display-4"></i><p class="mt-2">${this.tickets.length === 0 ? 'Tidak ada data tiket aktif.' : 'Tidak ada hasil pencarian.'}</p></div>`;
            return;
        }

        container.innerHTML = filteredTickets.map(t => {
            const isCompleted = t.status === 'Completed' || t.status === 'Picked_Up';
            
            let statusSelect = '';
            if (!isCompleted) {
                const stages = [
                    {val: 'Queue', label: 'Antrian'},
                    {val: 'Diagnosing', label: 'Diagnosa'},
                    {val: 'Waiting_Part', label: 'Tunggu Part'},
                    {val: 'In_Progress', label: 'Dikerjakan'}
                ];
                
                const options = stages.map(s => 
                    `<option value="${s.val}" ${t.status === s.val ? 'selected' : ''}>${s.label}</option>`
                ).join('');

                statusSelect = `
                    <div class="mb-2">
                        <small class="text-secondary fw-bold" style="font-size:0.7rem">STATUS</small>
                        <select class="form-select form-select-sm border-primary text-primary fw-bold" 
                                onchange="service.updateStatus('${t._id}', this.value)">
                            ${options}
                        </select>
                    </div>
                `;
            } else {
                const pickedUp = t.status === 'Picked_Up';
                statusSelect = `
                    <div class="mb-2">
                         <small class="text-secondary fw-bold" style="font-size:0.7rem">STATUS</small>
                         <select class="form-select form-select-sm ${pickedUp ? 'bg-dark text-white' : 'bg-success text-white'}" 
                                onchange="service.updateStatus('${t._id}', this.value)" ${pickedUp ? 'disabled' : ''}>
                            <option value="Completed" ${!pickedUp ? 'selected' : ''}>Selesai</option>
                            <option value="Picked_Up" ${pickedUp ? 'selected' : ''}>Diambil</option>
                        </select>
                    </div>
                `;
            }

            return `
            <div class="col-md-6 col-xl-12">
                <div class="card h-100 border-start border-4 ${isCompleted ? 'border-success' : 'border-primary'} shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h6 class="fw-bold mb-0 text-dark">#${t.ticket_number}</h6>
                                <small class="text-muted">${formatDateTime(t.timestamps.created_at)}</small>
                            </div>
                            <div class="text-end">
                                ${this.getStatusBadge(t.status)}
                                <div class="small text-secondary mt-1" style="font-size: 0.75rem;">
                                    <i class="bi bi-person-badge me-1"></i>${t.technician.name}
                                </div>
                            </div>
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-6">
                                <small class="text-secondary fw-bold" style="font-size:0.7rem">PELANGGAN</small>
                                <div class="fw-bold text-truncate">
                                    ${t.customer.name} 
                                    <span class="badge bg-light text-dark border ms-1" style="font-size:0.6rem; font-weight: normal;">${t.customer.type}</span>
                                </div>
                                <div class="small text-muted">${t.customer.phone}</div>
                            </div>
                            <div class="col-6">
                                <small class="text-secondary fw-bold" style="font-size:0.7rem">PERANGKAT</small>
                                <div class="fw-bold text-truncate">${t.device.type} ${t.device.brand || ''}</div>
                                <div class="small text-muted text-truncate">${t.device.symptoms}</div>
                            </div>
                        </div>

                        ${statusSelect}

                        <div class="d-flex gap-2 mt-3 pt-2 border-top">
                            <button class="btn btn-sm btn-outline-secondary flex-grow-1" onclick="service.openDetail('${t._id}')">
                                <i class="bi bi-eye"></i> Detail
                            </button>

                            <button class="btn btn-sm btn-outline-warning" onclick="service.openEdit('${t._id}')" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            
                            <button class="btn btn-sm btn-outline-danger" onclick="service.deleteTicket('${t._id}')" title="Batal">
                                <i class="bi bi-trash"></i>
                            </button>
                            
                            <button class="btn btn-sm btn-outline-primary" onclick="service.openAddPart('${t._id}')" title="Part">
                                <i class="bi bi-tools"></i>
                            </button>

                            <button class="btn btn-sm btn-success fw-bold px-3" onclick="service.openFinalize('${t._id}')">
                                <i class="bi bi-check-lg"></i>
                            </button>

                            ${isCompleted ? `
                                <button class="btn btn-sm btn-outline-dark" onclick="service.printInvoice('${t._id}')" title="Nota">
                                    <i class="bi bi-printer"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    getStatusBadge(status) {
        const map = {
            'Queue': '<span class="badge bg-secondary">Antrian</span>',
            'Diagnosing': '<span class="badge bg-info text-dark">Diagnosa</span>',
            'Waiting_Part': '<span class="badge bg-warning text-dark">Tunggu Part</span>',
            'In_Progress': '<span class="badge bg-primary">Dikerjakan</span>',
            'Completed': '<span class="badge bg-success">Selesai</span>',
            'Picked_Up': '<span class="badge bg-dark">Diambil</span>',
            'Cancelled': '<span class="badge bg-danger">Dibatalkan</span>'
        };
        return map[status] || status;
    }

    async updateStatus(id, newStatus) {
        if (newStatus === 'Picked_Up' && !confirm('Pastikan barang sudah diterima pelanggan & pembayaran lunas. Lanjutkan?')) {
            this.loadTickets(); 
            return;
        }
        try {
            await api.updateTicketStatus(id, newStatus);
            showToast('Status diperbarui');
            this.loadTickets();
        } catch (e) {
            showToast(e.message, 'error');
            this.loadTickets();
        }
    }

    async deleteTicket(id) {
        if (!confirm('Yakin ingin MEMBATALKAN/MENGHAPUS tiket ini?')) return;
        try {
            await api.deleteServiceTicket(id);
            showToast('Tiket berhasil dihapus', 'success');
            await this.loadTickets(); 
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    openEdit(id) {
        const t = this.tickets.find(x => x._id === id);
        if(!t) return;
        
        document.getElementById('edit-ticket-id').value = t._id;
        document.getElementById('edit-customer-name').value = t.customer.name;
        document.getElementById('edit-customer-phone').value = t.customer.phone;
        document.getElementById('edit-device-full').value = `${t.device.type} ${t.device.brand || ''} ${t.device.model || ''}`.trim().replace(/\s+/g, ' ');
        document.getElementById('edit-symptoms').value = t.device.symptoms;
        
        // Populate Password
        if (document.getElementById('edit-device-password')) {
            document.getElementById('edit-device-password').value = t.device.password || '';
        }

        // Initialize and populate Pattern Lock for Edit
        if (!this.editPatternLock) {
            this.editPatternLock = new PatternLock('edit-pattern-selector', 'edit-device-pattern');
        }
        this.editPatternLock.init();
        this.editPatternLock.setSequence(t.device.pattern || '');
        
        new bootstrap.Modal(document.getElementById('editTicketModal')).show();
    }

    async saveEdit() {
        const id = document.getElementById('edit-ticket-id').value;
        const t = this.tickets.find(x => x._id === id);
        const newData = {
            customer: { ...t.customer, name: document.getElementById('edit-customer-name').value, phone: document.getElementById('edit-customer-phone').value },
            device: { 
                ...t.device, 
                symptoms: document.getElementById('edit-symptoms').value,
                password: document.getElementById('edit-device-password') ? document.getElementById('edit-device-password').value : t.device.password,
                pattern: document.getElementById('edit-device-pattern') ? document.getElementById('edit-device-pattern').value : t.device.pattern
            }, 
            notes: t.notes
        };
        try {
            await api.updateTicketDetails(id, newData);
            showToast('Data diupdate');
            bootstrap.Modal.getInstance(document.getElementById('editTicketModal')).hide();
            this.loadTickets();
        } catch(e) { showToast(e.message, 'error'); }
    }

    openAddPart(id) {
        document.getElementById('part-ticket-id').value = id;
        new bootstrap.Modal(document.getElementById('addPartModal')).show();
    }

    openFinalize(id) {
        const t = this.tickets.find(x => x._id === id);
        if(!t) return;
        document.getElementById('final-ticket-id').value = id;
        const partTotal = t.parts_used.reduce((sum, p) => sum + p.subtotal, 0);
        document.getElementById('final-part-cost').textContent = formatCurrency(partTotal);
        const feeInput = document.getElementById('final-service-fee');
        feeInput.value = t.service_fee;
        const updateGrandTotal = () => {
            const fee = parseFloat(feeInput.value) || 0;
            document.getElementById('final-grand-total').textContent = formatCurrency(partTotal + fee);
        };
        feeInput.oninput = updateGrandTotal;
        updateGrandTotal();
        new bootstrap.Modal(document.getElementById('finalizeModal')).show();
    }

    async confirmFinish() {
        const id = document.getElementById('final-ticket-id').value;
        const finalFee = document.getElementById('final-service-fee').value;
        try {
            await api.updateServiceFee(id, finalFee);
            await api.updateTicketStatus(id, 'Completed');
            showToast('Servis Selesai!');
            bootstrap.Modal.getInstance(document.getElementById('finalizeModal')).hide();
            await this.loadTickets();
            this.printInvoice(id);
        } catch(e) { showToast(e.message, 'error'); }
    }

    renderPatternVisualization(seqStr) {
        if (!seqStr) return '<span class="text-muted small">Tidak ada pola</span>';
        
        const activeIndices = String(seqStr).split('');
        return `
            <div class="pattern-mini-grid">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                    <div class="pattern-mini-dot ${activeIndices.includes(String(num)) ? 'active' : ''}"></div>
                `).join('')}
            </div>
            <div class="small fw-bold text-primary mt-1">Urutan: ${seqStr}</div>
        `;
    }

    openDetail(id) {
        const t = this.tickets.find(x => x._id === id);
        if(!t) return;

        const partList = t.parts_used.length ? t.parts_used.map(p => 
            `<tr><td>${p.name}</td><td class="text-center">${p.qty}</td><td class="text-end">${formatCurrency(p.subtotal)}</td></tr>`
        ).join('') : '<tr><td colspan="3" class="text-center text-muted">Tidak ada sparepart</td></tr>';
        
        const html = `
            <div class="row g-4 mb-4">
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded shadow-sm h-100">
                        <h6 class="fw-bold text-primary border-bottom pb-2 mb-3"><i class="bi bi-person me-2"></i>INFO PELANGGAN</h6>
                        <table class="table table-sm table-borderless mb-0">
                            <tr><td width="110" class="text-secondary">Nama</td><td>: <strong>${t.customer.name}</strong></td></tr>
                            <tr><td class="text-secondary">Telepon</td><td>: ${t.customer.phone}</td></tr>
                            <tr><td class="text-secondary">Tipe</td><td>: <span class="badge bg-info text-dark">${t.customer.type}</span></td></tr>
                        </table>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded shadow-sm h-100">
                        <h6 class="fw-bold text-primary border-bottom pb-2 mb-3"><i class="bi bi-laptop me-2"></i>PERANGKAT</h6>
                        <table class="table table-sm table-borderless mb-0">
                            <tr><td width="110" class="text-secondary">Unit / Tipe</td><td>: <strong>${t.device.type} ${t.device.brand || ''}</strong></td></tr>
                            <tr><td class="text-secondary">Model/Seri</td><td>: ${t.device.model || '-'}</td></tr>
                            <tr><td class="text-secondary">Serial No.</td><td>: ${t.device.serial_number || '-'}</td></tr>
                            <tr><td class="text-secondary">Password</td><td>: <span class="badge bg-warning text-dark">${t.device.password || '-'}</span></td></tr>
                            <tr>
                                <td class="text-secondary">Pola</td>
                                <td>: ${this.renderPatternVisualization(t.device.pattern)}</td>
                            </tr>
                            <tr><td class="text-secondary">Keluhan</td><td>: <span class="text-danger">${t.device.symptoms}</span></td></tr>
                            <tr><td class="text-secondary">Kelengkapan</td><td>: ${t.device.accessories || '-'}</td></tr>
                        </table>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded shadow-sm h-100">
                        <h6 class="fw-bold text-primary border-bottom pb-2 mb-3"><i class="bi bi-clock me-2"></i>TIMELINE & PETUGAS</h6>
                        <table class="table table-sm table-borderless mb-0">
                            <tr><td width="110" class="text-secondary">Teknisi</td><td>: <strong>${t.technician.name}</strong></td></tr>
                            <tr><td class="text-secondary">Waktu Masuk</td><td>: ${formatDateTime(t.timestamps.created_at)}</td></tr>
                            ${t.timestamps.completed_at ? `<tr><td class="text-secondary text-success fw-bold">Waktu Selesai</td><td>: ${formatDateTime(t.timestamps.completed_at)}</td></tr>` : ''}
                            ${t.timestamps.picked_up_at ? `<tr><td class="text-secondary text-primary fw-bold">Waktu Keluar</td><td>: ${formatDateTime(t.timestamps.picked_up_at)}</td></tr>` : ''}
                        </table>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded shadow-sm h-100">
                        <h6 class="fw-bold text-primary border-bottom pb-2 mb-3"><i class="bi bi-journal-text me-2"></i>CATATAN</h6>
                        <p class="small text-muted mb-0">${t.notes || 'Tidak ada catatan tambahan.'}</p>
                    </div>
                </div>
            </div>

            <h6 class="fw-bold text-primary mb-3"><i class="bi bi-cart me-2"></i>RINCIAN BIAYA & SPAREPART</h6>
            <div class="table-responsive rounded border">
                <table class="table table-hover table-sm mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Nama Item / Sparepart</th>
                            <th class="text-center" width="80">Qty</th>
                            <th class="text-end" width="150">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${partList}
                    </tbody>
                    <tfoot class="table-light">
                        <tr class="fw-bold">
                            <td colspan="2" class="text-end">Biaya Jasa</td>
                            <td class="text-end">${formatCurrency(t.service_fee)}</td>
                        </tr>
                        <tr class="table-primary fw-bold">
                            <td colspan="2" class="text-end fs-5 text-primary">GRAND TOTAL</td>
                            <td class="text-end fs-5 text-primary">${formatCurrency(t.total_cost)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        document.getElementById('detail-content').innerHTML = html;
        document.getElementById('print-copy-btn').onclick = () => this.printInvoice(id);
        new bootstrap.Modal(document.getElementById('detailModal')).show();
    }

    printInvoice(id) {
        const t = this.tickets.find(x => x._id === id);
        if(!t) return;
        
        // Format Nama File: nama_nomerPelanggan_barang_angkaRandoom.pdf
        const randomNum = Math.floor(Math.random() * 10000);
        const fileName = `${t.customer.name}_${t.customer.phone}_${t.device.type}_${randomNum}`.replace(/\s+/g, '_');

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
                </div>
                <div class="row"><span>Tiket</span> <span>${t.ticket_number}</span></div>
                <div class="row"><span>Tgl</span> <span>${new Date().toLocaleDateString('id-ID')}</span></div>
                <div class="row"><span>Klien</span> <span>${t.customer.name}</span></div>
                <div class="divider"></div>
                <div class="row"><span>Perangkat</span> <span>${t.device.type} ${t.device.brand || ''}</span></div>
                <div class="row"><span>Sandi/Pola</span> <span>${t.device.password || '-'}/${t.device.pattern || '-'}</span></div>
                <div class="divider"></div>
                ${t.parts_used.map(p => `<div class="row"><span>${p.name} x${p.qty}</span><span>${new Intl.NumberFormat('id-ID').format(p.subtotal)}</span></div>`).join('')}
                <div class="row"><span>Jasa</span><span>${new Intl.NumberFormat('id-ID').format(t.service_fee)}</span></div>
                <div class="divider"></div>
                <div class="row bold"><span>TOTAL</span><span>${new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR'}).format(t.total_cost)}</span></div>
                <div class="footer"><p>Terima Kasih!</p></div>
            </body></html>
        `);
        doc.close();
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 5000);
    }

    setupEventListeners() {
        document.getElementById('service-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                customer: { name: document.getElementById('customer-name').value, phone: document.getElementById('customer-phone').value, type: document.getElementById('customer-type').value },
                device: { 
                    type: document.getElementById('device-type').value, 
                    brand: document.getElementById('device-brand').value, 
                    model: document.getElementById('device-model').value, 
                    symptoms: document.getElementById('device-symptoms').value, 
                    accessories: document.getElementById('device-accessories').value,
                    password: document.getElementById('device-password').value,
                    pattern: document.getElementById('device-pattern').value
                },
                technician_id: document.getElementById('technician-select').value,
                service_fee: document.getElementById('service-fee').value,
                notes: ''
            };
            try { 
                await api.createServiceTicket(data); 
                showToast('Tiket Dibuat'); 
                document.getElementById('service-form').reset(); 
                if (this.mainPatternLock) this.mainPatternLock.reset();
                this.loadTickets(); 
            } catch(e){ showToast(e.message, 'error'); }
        });
        document.getElementById('status-filter').addEventListener('change', () => this.loadTickets());
        document.getElementById('refresh-tickets-btn').addEventListener('click', () => this.loadTickets());
        document.getElementById('save-edit-btn').addEventListener('click', () => this.saveEdit());
        
        // Listener Pencarian
        document.getElementById('search-customer').addEventListener('input', () => this.renderTicketList());

        // --- PERBAIKAN: Refresh data otomatis setelah tambah part ---
        document.getElementById('save-part-btn').addEventListener('click', async () => {
            const tId = document.getElementById('part-ticket-id').value;
            const iId = document.getElementById('part-item-select').value;
            const qty = document.getElementById('part-quantity').value;
            try { 
                await api.addPartToService(tId, iId, qty); 
                showToast('Part ditambahkan'); 
                bootstrap.Modal.getInstance(document.getElementById('addPartModal')).hide(); 
                
                // PENTING: Reload tiket agar data Detail terupdate
                await this.loadTickets(); 
            } catch(e){ showToast(e.message, 'error'); }
        });
        
        document.getElementById('confirm-finish-btn').addEventListener('click', () => this.confirmFinish());
    }
    
}

window.service = new Service();
export default Service;