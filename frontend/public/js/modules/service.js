// public/js/modules/service.js - Modul Manajemen Servis (FIXED: Add Part & Detail View)

import api, { formatCurrency, formatDateTime, showToast, showError, setupCurrencyInput, parseCurrencyValue, calculateElapsedTime, validateWhatsApp } from '../api.js';

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
        this._modals = {};
    }

    getOrCreateModal(id) {
        if (!this._modals[id]) {
            this._modals[id] = new bootstrap.Modal(document.getElementById(id));
            
            // Cleanup backdrop on hide to prevent stuck overlays
            document.getElementById(id).addEventListener('hidden.bs.modal', () => {
                const backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 0) {
                    backdrops.forEach(b => b.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.paddingRight = '';
                }
            });
        }
        return this._modals[id];
    }

    async render() {
        // PERBAIKAN: Pastikan global 'service' merujuk ke instance yang aktif
        window.service = this;

        // CSS Hack — inject only once
        if (!document.getElementById('service-module-styles')) {
            const style = document.createElement('style');
            style.id = 'service-module-styles';
            style.innerHTML = `
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; margin: 0; 
                }
                input[type=number] { -moz-appearance: textfield; }

                /* Photo Upload UI */
                .photo-grid-input {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .photo-upload-box {
                    position: relative;
                    height: 100px;
                    border: 2px dashed #dee2e6;
                    border-radius: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    overflow: hidden;
                    transition: all 0.2s ease;
                    background: #f8f9fa;
                }
                .photo-upload-box:hover {
                    border-color: #0d6efd;
                    background: #f0f7ff;
                }
                .photo-upload-box i {
                    font-size: 1.5rem;
                    color: #adb5bd;
                    margin-bottom: 4px;
                }
                .photo-upload-box span {
                    font-size: 0.65rem;
                    font-weight: bold;
                    color: #6c757d;
                    text-transform: uppercase;
                }
                .photo-upload-box img {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    z-index: 2;
                }
                .photo-upload-box .remove-photo {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    z-index: 3;
                    background: rgba(220, 53, 69, 0.8);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    display: none;
                }
                .photo-upload-box.has-image {
                    border-style: solid;
                }
                .photo-upload-box.has-image .remove-photo {
                    display: flex;
                }
            `;
            document.head.appendChild(style);
        }

        const content = document.getElementById('app-content');
        
        content.innerHTML = `
            <div class="row g-4">
                <div class="col-lg-4">
                    <div class="card shadow-sm border-0 sticky-top" style="top: 20px; z-index: 1; max-height: calc(100vh - 40px); display: flex; flex-direction: column;">
                        <div class="card-header bg-primary text-white py-3">
                            <h5 class="mb-0"><i class="bi bi-plus-circle me-2"></i>Tiket Servis Baru</h5>
                        </div>
                        <div class="card-body" style="overflow-y: auto;">
                            <form id="service-form">
                                <h6 class="border-bottom pb-2 mb-3 fw-bold text-secondary">Informasi Pelanggan</h6>
                                
                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nama Pelanggan *</label>
                                    <input type="text" class="form-control" id="customer-name" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Nomor Telepon (WhatsApp)</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="bi bi-whatsapp"></i></span>
                                        <input type="tel" class="form-control" id="customer-phone" placeholder="08xxxxxxxx">
                                    </div>
                                    <div id="wa-validation-msg" class="mt-1"></div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Email (Opsional - Untuk Nota)</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                                        <input type="email" class="form-control" id="customer-email" placeholder="email@contoh.com">
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

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Foto Perangkat (Opsional)</h6>
                                <div class="photo-grid-input mb-3">
                                    <div class="photo-upload-box" onclick="this.querySelector('input').click()">
                                        <i class="bi bi-camera"></i>
                                        <span>Depan</span>
                                        <input type="file" class="d-none device-photo" data-side="front" accept="image/*" onchange="service.handlePhotoInput(this)">
                                        <img class="d-none">
                                        <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePhoto(this)"><i class="bi bi-x"></i></button>
                                    </div>
                                    <div class="photo-upload-box" onclick="this.querySelector('input').click()">
                                        <i class="bi bi-camera"></i>
                                        <span>Belakang</span>
                                        <input type="file" class="d-none device-photo" data-side="back" accept="image/*" onchange="service.handlePhotoInput(this)">
                                        <img class="d-none">
                                        <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePhoto(this)"><i class="bi bi-x"></i></button>
                                    </div>
                                    <div class="photo-upload-box" onclick="this.querySelector('input').click()">
                                        <i class="bi bi-camera"></i>
                                        <span>Kiri</span>
                                        <input type="file" class="d-none device-photo" data-side="left" accept="image/*" onchange="service.handlePhotoInput(this)">
                                        <img class="d-none">
                                        <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePhoto(this)"><i class="bi bi-x"></i></button>
                                    </div>
                                    <div class="photo-upload-box" onclick="this.querySelector('input').click()">
                                        <i class="bi bi-camera"></i>
                                        <span>Kanan</span>
                                        <input type="file" class="d-none device-photo" data-side="right" accept="image/*" onchange="service.handlePhotoInput(this)">
                                        <img class="d-none">
                                        <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePhoto(this)"><i class="bi bi-x"></i></button>
                                    </div>
                                </div>
                                <div id="photo-compression-msg" class="small text-muted mb-3 d-none">
                                    <div class="spinner-border spinner-border-sm text-primary me-1"></div> Mengompres foto...
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Perangkat & Masalah</h6>

                                <div class="row g-2 mb-3">
                                    <div class="col-4">
                                        <label class="form-label small fw-bold">Tipe *</label>
                                        <input type="text" class="form-control" id="device-type" placeholder="Laptop/PC" required>
                                    </div>
                                    <div class="col-4">
                                        <label class="form-label small fw-bold">Merek</label>
                                        <input type="text" class="form-control" id="device-brand" placeholder="Asus/HP">
                                    </div>
                                    <div class="col-4">
                                        <label class="form-label small fw-bold">Model/Seri</label>
                                        <input type="text" class="form-control" id="device-model">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Serial Number (SN)</label>
                                    <input type="text" class="form-control" id="device-serial-number" placeholder="SN: xxxxxxx">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Keluhan / Kerusakan *</label>
                                    <textarea class="form-control auto-expand" id="device-symptoms" rows="4" required placeholder="Jelaskan detail kerusakan..."></textarea>
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
                                        <input type="text" class="form-control currency-input" id="service-fee" placeholder="0" inputmode="numeric">
                                    </div>
                                    <div class="form-text">Biaya final ditentukan saat selesai.</div>
                                </div>

                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary fw-bold py-2" id="save-ticket-btn">
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
                                    <button class="btn btn-sm btn-outline-danger admin-only" id="view-logs-btn" style="display:none;" title="System Logs">
                                        <i class="bi bi-bug"></i>
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

        // Initialize currency inputs
        document.querySelectorAll('.currency-input').forEach(input => setupCurrencyInput(input));

        await this.loadTechnicians();
        await this.loadTickets();
        await this.loadItems();
        this.setupEventListeners();
    }

    renderModals() {
        return `
            <div class="modal fade" id="editTicketModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Data Tiket</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="edit-ticket-form">
                                <input type="hidden" id="edit-ticket-id">
                                
                                <h6 class="border-bottom pb-2 mb-3 fw-bold text-secondary">Informasi Pelanggan</h6>
                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Nama Pelanggan</label>
                                        <input type="text" class="form-control" id="edit-customer-name" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">No. Telepon (WhatsApp)</label>
                                        <input type="text" class="form-control" id="edit-customer-phone">
                                        <div id="edit-wa-validation-msg" class="small mt-1 d-none"></div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Email (Untuk Nota)</label>
                                        <input type="email" class="form-control" id="edit-customer-email">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Tipe Pelanggan</label>
                                        <select class="form-select" id="edit-customer-type">
                                            <option value="Umum">Umum</option>
                                            <option value="Mahasiswa">Mahasiswa</option>
                                            <option value="Dosen">Dosen</option>
                                        </select>
                                    </div>
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Foto Perangkat</h6>
                                <div class="row g-2 mb-3" id="edit-photos-preview">
                                    <!-- Preview foto lama akan muncul di sini -->
                                </div>
                                <div class="photo-grid-input mb-3">
                                    <div class="photo-upload-box" onclick="this.querySelector('input').click()">
                                        <i class="bi bi-camera"></i>
                                        <span>Ganti Depan</span>
                                        <input type="file" class="d-none edit-device-photo" data-side="front" accept="image/*" onchange="service.handlePhotoInput(this)">
                                        <img class="d-none">
                                        <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePhoto(this)"><i class="bi bi-x"></i></button>
                                    </div>
                                    <div class="photo-upload-box" onclick="this.querySelector('input').click()">
                                        <i class="bi bi-camera"></i>
                                        <span>Ganti Belakang</span>
                                        <input type="file" class="d-none edit-device-photo" data-side="back" accept="image/*" onchange="service.handlePhotoInput(this)">
                                        <img class="d-none">
                                        <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePhoto(this)"><i class="bi bi-x"></i></button>
                                    </div>
                                    <div class="photo-upload-box" onclick="this.querySelector('input').click()">
                                        <i class="bi bi-camera"></i>
                                        <span>Ganti Kiri</span>
                                        <input type="file" class="d-none edit-device-photo" data-side="left" accept="image/*" onchange="service.handlePhotoInput(this)">
                                        <img class="d-none">
                                        <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePhoto(this)"><i class="bi bi-x"></i></button>
                                    </div>
                                    <div class="photo-upload-box" onclick="this.querySelector('input').click()">
                                        <i class="bi bi-camera"></i>
                                        <span>Ganti Kanan</span>
                                        <input type="file" class="d-none edit-device-photo" data-side="right" accept="image/*" onchange="service.handlePhotoInput(this)">
                                        <img class="d-none">
                                        <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePhoto(this)"><i class="bi bi-x"></i></button>
                                    </div>
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Perangkat & Masalah</h6>
                                <div class="row g-3 mb-3">
                                    <div class="col-md-3">
                                        <label class="form-label small fw-bold">Tipe Perangkat</label>
                                        <input type="text" class="form-control" id="edit-device-type">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label small fw-bold">Merek</label>
                                        <input type="text" class="form-control" id="edit-device-brand">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label small fw-bold">Model / Seri</label>
                                        <input type="text" class="form-control" id="edit-device-model">
                                    </div>
                                    <div class="col-md-3">
                                        <label class="form-label small fw-bold">Serial Number</label>
                                        <input type="text" class="form-control" id="edit-device-serial-number">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Keluhan / Kerusakan *</label>
                                    <textarea class="form-control auto-expand" id="edit-symptoms" rows="4" required placeholder="Jelaskan detail kerusakan..."></textarea>
                                </div>


                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Kelengkapan</label>
                                        <input type="text" class="form-control" id="edit-device-accessories">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Password / Sandi</label>
                                        <input type="text" class="form-control" id="edit-device-password">
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label small fw-bold">Pola Keamanan</label>
                                    <input type="hidden" id="edit-device-pattern">
                                    <div id="edit-pattern-selector"></div>
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Petugas & Biaya</h6>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Teknisi</label>
                                        <select class="form-select" id="edit-technician-select"></select>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label small fw-bold">Estimasi Biaya Jasa (Awal)</label>
                                        <div class="input-group">
                                            <span class="input-group-text">Rp</span>
                                            <input type="text" class="form-control currency-input" id="edit-service-fee" placeholder="0" inputmode="numeric">
                                        </div>
                                    </div>
                                </div>
                                
                                <h6 class="border-bottom pb-2 mb-3 mt-4 fw-bold text-secondary">Manajemen Sparepart</h6>
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="small text-muted">Daftar sparepart yang terpasang pada tiket ini:</span>
                                    <button type="button" class="btn btn-sm btn-outline-primary" id="edit-add-part-btn">
                                        <i class="bi bi-plus-lg me-1"></i> Tambah Part
                                    </button>
                                </div>
                                <div class="table-responsive border rounded bg-white">
                                    <table class="table table-sm table-hover mb-0">
                                        <thead class="table-light">
                                            <tr>
                                                <th class="ps-2">Item</th>
                                                <th class="text-center" width="50">Qty</th>
                                                <th class="text-end pe-2" width="100">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody id="edit-parts-list">
                                            <!-- List sparepart akan muncul di sini via JS -->
                                        </tbody>
                                    </table>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary fw-bold" id="save-edit-btn">
                                <i class="bi bi-save me-2"></i>Simpan Perubahan
                            </button>
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
                                    <input type="text" class="form-control form-control-lg fw-bold text-end currency-input" id="final-service-fee" inputmode="numeric">
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

            <div class="modal fade" id="paymentModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title"><i class="bi bi-cash-stack me-2"></i>Penyelesaian Pembayaran</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="payment-ticket-id">
                            
                            <div class="alert alert-info mb-4">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>Total yang harus dibayar:</span>
                                    <h4 class="mb-0 fw-bold" id="payment-grand-total">Rp 0</h4>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-bold">Metode Pembayaran</label>
                                <div class="row g-2">
                                    <div class="col-4">
                                        <input type="radio" class="btn-check" name="payment-method" id="pay-cash" value="Cash" checked>
                                        <label class="btn btn-outline-primary w-100 py-3" for="pay-cash">
                                            <i class="bi bi-wallet2 d-block mb-1 fs-4"></i> Cash
                                        </label>
                                    </div>
                                    <div class="col-4">
                                        <input type="radio" class="btn-check" name="payment-method" id="pay-qris" value="QRIS">
                                        <label class="btn btn-outline-primary w-100 py-3" for="pay-qris">
                                            <i class="bi bi-qr-code-scan d-block mb-1 fs-4"></i> QRIS
                                        </label>
                                    </div>
                                    <div class="col-4">
                                        <input type="radio" class="btn-check" name="payment-method" id="pay-transfer" value="Transfer">
                                        <label class="btn btn-outline-primary w-100 py-3" for="pay-transfer">
                                            <i class="bi bi-bank d-block mb-1 fs-4"></i> Transfer
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-bold">Bukti Pembayaran (Opsional)</label>
                                <div class="photo-upload-box w-100" style="height: 150px;" onclick="this.querySelector('input').click()">
                                    <i class="bi bi-camera fs-1"></i>
                                    <span>Klik untuk Unggah / Ambil Foto</span>
                                    <input type="file" class="d-none" id="payment-proof-input" accept="image/*" onchange="service.handlePaymentProofPreview(this)">
                                    <img id="payment-proof-preview" class="d-none">
                                    <button type="button" class="remove-photo" onclick="event.stopPropagation(); service.removePaymentProof(this)"><i class="bi bi-x"></i></button>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary fw-bold" id="confirm-payment-btn">
                                <i class="bi bi-check-circle me-2"></i>Selesaikan & Ambil Barang
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

            <div class="modal fade" id="logsModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-dark text-white">
                            <h5 class="modal-title"><i class="bi bi-bug me-2"></i>System Logs (Error Tracking)</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body p-0">
                            <div class="table-responsive">
                                <table class="table table-hover table-sm mb-0">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>Waktu</th>
                                            <th>Level</th>
                                            <th>Sumber</th>
                                            <th>Pesan</th>
                                            <th>Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody id="logs-content">
                                        <tr><td colspan="5" class="text-center py-4">Memuat log...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
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
            
            // Logika Durasi
            let durationLabel = 'Durasi Masuk';
            let durationValue = calculateElapsedTime(t.timestamps.created_at);
            let durationColor = 'text-muted';

            if (t.status === 'Completed') {
                durationLabel = 'Selesai Sejak';
                durationValue = calculateElapsedTime(t.timestamps.completed_at);
                durationColor = 'text-success';
            } else if (t.status === 'Picked_Up') {
                durationLabel = 'Total Servis';
                durationValue = calculateElapsedTime(t.timestamps.created_at, t.timestamps.picked_up_at);
                durationColor = 'text-dark';
            } else {
                // Untuk status aktif (Queue, Diagnosing, etc)
                const hours = (new Date() - new Date(t.timestamps.created_at)) / (1000 * 60 * 60);
                if (hours > 48) durationColor = 'text-danger fw-bold';
                else if (hours > 24) durationColor = 'text-warning fw-bold';
            }

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
                                <div class="small text-muted d-flex align-items-center gap-1">
                                    ${t.customer.phone || 'N/A'}
                                    ${t.customer.phone ? `
                                        <button class="btn btn-success btn-xs ms-1 px-1 py-0 shadow-sm" onclick="service.resendWA('${t._id}')" title="Kirim Ulang WA" style="font-size: 0.65rem; border-radius: 4px;">
                                            <i class="bi bi-whatsapp me-1"></i>Kirim WA
                                        </button>
                                    ` : ''}
                                </div>
                                ${t.customer.email ? `
                                    <div class="small text-muted mt-1 text-truncate" style="font-size: 0.7rem;">
                                        <i class="bi bi-envelope me-1"></i>${t.customer.email}
                                    </div>
                                ` : ''}
                            </div>
                            <div class="col-6 text-end">
                                ${this.getWarrantyBadge(t)}
                                <div class="${durationColor} text-truncate" style="font-size:0.85rem">
                                    ${durationValue}
                                </div>
                                <div class="small text-muted" style="font-size: 0.7rem">${durationLabel}</div>
                            </div>
                        </div>

                        <div class="row align-items-start mt-2">
                            <div class="col-7">
                                <small class="text-secondary fw-bold" style="font-size:0.7rem">PERANGKAT</small>
                                <div class="fw-bold text-primary mb-1" style="font-size: 1.1rem; line-height: 1.2;">
                                    ${t.device.type} ${t.device.brand || ''} ${t.device.model || ''}
                                </div>
                                <div class="small text-danger fw-semibold" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                    <i class="bi bi-exclamation-circle me-1"></i>${t.device.symptoms}
                                </div>
                            </div>
                            <div class="col-5 text-end">
                                ${t.device.photos && t.device.photos.front ? `
                                    <img src="${t.device.photos.front}" class="rounded-3 shadow-sm border" style="width: 100%; max-width: 160px; height: 100px; object-fit: cover; cursor: pointer;" onclick="window.open('${t.device.photos.front}', '_blank')">
                                ` : `
                                    <div class="bg-light rounded-3 border d-flex align-items-center justify-content-center ms-auto" style="width: 100%; max-width: 160px; height: 100px;">
                                        <i class="bi bi-image text-muted fs-1"></i>
                                    </div>
                                `}
                            </div>
                        </div>


                        ${statusSelect}

                        ${t.status === 'Picked_Up' ? `
                            <div class="p-2 bg-light rounded border mt-2">
                                <div class="row align-items-center">
                                    <div class="col-8">
                                        <small class="text-secondary fw-bold d-block" style="font-size:0.65rem">PEMBAYARAN</small>
                                        <div class="fw-bold text-success">
                                            <i class="bi bi-check-circle-fill me-1"></i>${t.payment_method || 'Lunas'}
                                        </div>
                                    </div>
                                    <div class="col-4 text-end">
                                        ${t.payment_proof ? `
                                            <img src="${t.payment_proof}" class="rounded border shadow-sm" style="width: 40px; height: 40px; object-fit: cover; cursor: pointer;" onclick="window.open('${t.payment_proof}', '_blank')" title="Lihat Bukti Bayar">
                                        ` : `
                                            <div class="text-muted" style="font-size:0.6rem">No Proof</div>
                                        `}
                                    </div>
                                </div>
                            </div>
                        ` : ''}

                        <div class="d-flex gap-2 mt-3 pt-2 border-top justify-content-end">
                            <button class="btn btn-sm btn-outline-secondary" onclick="service.openDetail('${t._id}')" title="Detail">
                                <i class="bi bi-eye"></i>
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

                            ${t.warranty_expires_at && new Date() < new Date(t.warranty_expires_at) ? `
                                <button class="btn btn-sm btn-warning fw-bold" onclick="service.claimWarranty('${t._id}')" title="Klaim Garansi">
                                    <i class="bi bi-shield-check"></i>
                                </button>
                            ` : ''}

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

    getWarrantyBadge(ticket) {
        if (!ticket.warranty_expires_at) return '';
        const now = new Date();
        const expiry = new Date(ticket.warranty_expires_at);
        if (now < expiry) {
            return `<span class="badge bg-success-subtle text-success border border-success-subtle mb-1" style="font-size: 0.65rem;">Garansi Aktif</span>`;
        }
        return `<span class="badge bg-light text-muted border mb-1" style="font-size: 0.65rem;">Garansi Habis</span>`;
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
        if (newStatus === 'Picked_Up') {
            this.openPayment(id);
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

    openPayment(id) {
        const t = this.tickets.find(x => x._id === id);
        if (!t) return;

        document.getElementById('payment-ticket-id').value = id;
        document.getElementById('payment-grand-total').textContent = formatCurrency(t.total_cost);
        
        // Reset form
        document.getElementById('pay-cash').checked = true;
        this.removePaymentProof(document.querySelector('#paymentModal .remove-photo'));
        
        this.getOrCreateModal('paymentModal').show();
    }

    handlePaymentProofPreview(input) {
        const box = input.closest('.photo-upload-box');
        const img = box.querySelector('img');
        const file = input.files[0];
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
                img.classList.remove('d-none');
                box.classList.add('has-image');
            };
            reader.readAsDataURL(file);
        }
    }

    removePaymentProof(btn) {
        const box = btn.closest('.photo-upload-box');
        const input = box.querySelector('input');
        const img = box.querySelector('img');
        
        input.value = '';
        img.src = '';
        img.classList.add('d-none');
        box.classList.remove('has-image');
    }

    async confirmPayment() {
        const id = document.getElementById('payment-ticket-id').value;
        const method = document.querySelector('input[name="payment-method"]:checked').value;
        const proofFile = document.getElementById('payment-proof-input').files[0];

        const formData = new FormData();
        formData.append('status', 'Picked_Up');
        formData.append('payment_method', method);
        if (proofFile) {
            const compressed = await this.compressImage(proofFile);
            formData.append('payment_proof', compressed);
        }

        try {
            await api.updateTicketStatus(id, formData);
            showToast('Pembayaran selesai & Barang diambil');
            this.getOrCreateModal('paymentModal').hide();
            await this.loadTickets();
        } catch (e) {
            showToast(e.message, 'error');
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
        
        // Customer fields
        document.getElementById('edit-customer-name').value = t.customer.name;
        document.getElementById('edit-customer-phone').value = t.customer.phone || '';
        document.getElementById('edit-customer-email').value = t.customer.email || '';
        document.getElementById('edit-customer-type').value = t.customer.type || 'Umum';
        
        // Photos Preview
        const photosPreview = document.getElementById('edit-photos-preview');
        const photos = t.device.photos || {};
        photosPreview.innerHTML = `
            ${['front', 'back', 'left', 'right'].map(side => `
                <div class="col-3">
                    <div class="border rounded p-1 text-center bg-white h-100">
                        <small class="d-block text-muted extra-small uppercase">${side}</small>
                        ${photos[side] ? `
                            <img src="${photos[side]}" class="img-fluid rounded mt-1" style="max-height: 50px; cursor: pointer;" onclick="window.open('${photos[side]}', '_blank')">
                        ` : `<div class="py-2"><i class="bi bi-image text-light fs-4"></i></div>`}
                    </div>
                </div>
            `).join('')}
        `;
        
        // Device fields
        document.getElementById('edit-device-type').value = t.device.type || '';
        document.getElementById('edit-device-brand').value = t.device.brand || '';
        document.getElementById('edit-device-model').value = t.device.model || '';
        document.getElementById('edit-device-serial-number').value = t.device.serial_number || '';
        document.getElementById('edit-symptoms').value = t.device.symptoms || '';
        document.getElementById('edit-device-accessories').value = t.device.accessories || '';
        document.getElementById('edit-device-password').value = t.device.password || '';

        // Technician select
        const techSelect = document.getElementById('edit-technician-select');
        techSelect.innerHTML = this.technicians.map(tech => 
            `<option value="${tech._id}" ${ (t.technician.id === tech._id || t.technician._id === tech._id) ? 'selected' : ''}>${tech.name}</option>`
        ).join('');

        // Service Fee with formatting
        const feeInput = document.getElementById('edit-service-fee');
        feeInput.value = t.service_fee || 0;
        setupCurrencyInput(feeInput);

        // Initialize and populate Pattern Lock for Edit
        if (!this.editPatternLock) {
            this.editPatternLock = new PatternLock('edit-pattern-selector', 'edit-device-pattern');
        }
        this.editPatternLock.init();
        this.editPatternLock.setSequence(t.device.pattern || '');

        // Clear previous validation msg
        const valMsg = document.getElementById('edit-wa-validation-msg');
        if (valMsg) valMsg.classList.add('d-none');
        
        // Setup blur listener for edit phone
        document.getElementById('edit-customer-phone').onblur = (e) => {
            this.validateWA(e.target.value, 'edit-wa-validation-msg', 'save-edit-btn');
        };

        // Populate Parts List for Edit
        const partsListContainer = document.getElementById('edit-parts-list');
        if (t.parts_used && t.parts_used.length > 0) {
            partsListContainer.innerHTML = t.parts_used.map(p => `
                <tr>
                    <td class="ps-2">${p.name}</td>
                    <td class="text-center">${p.qty}</td>
                    <td class="text-end pe-2">
                        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1" onclick="service.deletePart('${t._id}', '${p._id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            partsListContainer.innerHTML = '<tr><td colspan="3" class="text-center text-muted small py-2">Belum ada sparepart terpasang</td></tr>';
        }

        // Add Part button in Edit context
        document.getElementById('edit-add-part-btn').onclick = () => {
            // Kita sembunyikan modal edit sebentar agar modal tambah part terlihat jelas
            // atau bisa juga biarkan bertumpuk (Bootstrap 5 mendukung tumpukan)
            // Sesuai permintaan user: "popup detail ini menghilang (close atau tetap di belakang)"
            // Kita gunakan pendekatan tetap di belakang tapi pastikan modal baru di depan.
            this.openAddPart(t._id);
        };
        
        this.getOrCreateModal('editTicketModal').show();
    }

    async saveEdit() {
        const id = document.getElementById('edit-ticket-id').value;
        const t = this.tickets.find(x => x._id === id);
        if (!t) return;

        const formData = new FormData();
        const customerData = {
            name: document.getElementById('edit-customer-name').value,
            phone: document.getElementById('edit-customer-phone').value,
            email: document.getElementById('edit-customer-email').value,
            type: document.getElementById('edit-customer-type').value
        };
        formData.append('customer', JSON.stringify(customerData));

        const deviceData = {
            type: document.getElementById('edit-device-type').value,
            brand: document.getElementById('edit-device-brand').value,
            model: document.getElementById('edit-device-model').value,
            serial_number: document.getElementById('edit-device-serial-number').value,
            symptoms: document.getElementById('edit-symptoms').value,
            accessories: document.getElementById('edit-device-accessories').value,
            password: document.getElementById('edit-device-password').value,
            pattern: document.getElementById('edit-device-pattern').value
        };
        formData.append('device', JSON.stringify(deviceData));
        formData.append('technician_id', document.getElementById('edit-technician-select').value);
        formData.append('service_fee', parseCurrencyValue(document.getElementById('edit-service-fee').value));
        formData.append('notes', t.notes || '');

        // Handle new photo uploads
        const photoInputs = document.querySelectorAll('.edit-device-photo');
        for (const input of photoInputs) {
            if (input.files[0]) {
                const compressed = await this.compressImage(input.files[0]);
                formData.append(input.dataset.side, compressed);
            }
        }

        try {
            await api.updateTicketDetails(id, formData);
            showToast('Data tiket berhasil diperbarui', 'success');
            this.getOrCreateModal('editTicketModal').hide();
            await this.loadTickets();
        } catch(e) { 
            showToast(e.message, 'error'); 
        }
    }


    openAddPart(id) {
        console.log('Opening Add Part for ticket:', id);
        // Sesuai permintaan: tutup modal detail jika sedang terbuka
        this.getOrCreateModal('detailModal').hide();
        
        document.getElementById('part-ticket-id').value = id;
        this.getOrCreateModal('addPartModal').show();
    }

    async deletePart(ticketId, partId) {
        if (!confirm('Apakah Anda yakin ingin menghapus sparepart ini? Stok akan dikembalikan ke gudang.')) return;
        try {
            await api.removePartFromService(ticketId, partId);
            showToast('Sparepart berhasil dihapus');
            
            // Reload data
            await this.loadTickets();
            
            // Refresh modal yang sedang terbuka
            if (document.getElementById('editTicketModal').classList.contains('show')) {
                this.openEdit(ticketId);
            } else if (document.getElementById('detailModal').classList.contains('show')) {
                this.openDetail(ticketId);
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    openFinalize(id) {
        console.log('Opening Finalize for ticket:', id);
        const t = this.tickets.find(x => x._id === id);
        if(!t) return;
        document.getElementById('final-ticket-id').value = id;
        const partTotal = t.parts_used.reduce((sum, p) => sum + p.subtotal, 0);
        document.getElementById('final-part-cost').textContent = formatCurrency(partTotal);
        
        const feeInput = document.getElementById('final-service-fee');
        feeInput.value = t.service_fee;
        setupCurrencyInput(feeInput);

        const updateGrandTotal = () => {
            const fee = parseCurrencyValue(feeInput.value);
            document.getElementById('final-grand-total').textContent = formatCurrency(partTotal + fee);
        };
        feeInput.oninput = (e) => {
            updateGrandTotal();
        };
        updateGrandTotal();
        this.getOrCreateModal('finalizeModal').show();
        }

        async confirmFinish() {
        const id = document.getElementById('final-ticket-id').value;
        const finalFee = parseCurrencyValue(document.getElementById('final-service-fee').value);
        try {
            await api.updateServiceFee(id, finalFee);
            await api.updateTicketStatus(id, 'Completed');
            showToast('Servis Selesai!');
            this.getOrCreateModal('finalizeModal').hide();
            await this.loadTickets();
            this.printInvoice(id);
        } catch(e) {
 showToast(e.message, 'error'); }
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

    async validateWA(phone, targetMsgId = 'wa-validation-msg', submitBtnId = 'save-ticket-btn') {
        return validateWhatsApp(phone, targetMsgId, submitBtnId);
    }

    openDetail(id) {
        console.log('Opening Detail for ticket:', id);
        const t = this.tickets.find(x => x._id === id);
        if(!t) return;

        const partList = t.parts_used.length ? t.parts_used.map(p => 
            `<tr>
                <td>${p.name}</td>
                <td class="text-center">${p.qty}</td>
                <td class="text-end">${formatCurrency(p.subtotal)}</td>
            </tr>`
        ).join('') : '<tr><td colspan="3" class="text-center text-muted">Tidak ada sparepart</td></tr>';
        
        const html = `
            <div class="row g-4 mb-4">
                <div class="col-md-6">
                    <div class="p-3 bg-light rounded shadow-sm h-100">
                        <h6 class="fw-bold text-primary border-bottom pb-2 mb-3"><i class="bi bi-person me-2"></i>INFO PELANGGAN</h6>
                        <table class="table table-sm table-borderless mb-0">
                            <tr><td width="110" class="text-secondary">Nama</td><td>: <strong>${t.customer.name}</strong></td></tr>
                            <tr><td class="text-secondary">Telepon</td><td>: ${t.customer.phone}</td></tr>
                            <tr><td class="text-secondary">Email</td><td>: ${t.customer.email || '-'}</td></tr>
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
                <div class="col-12">
                    <div class="p-3 bg-light rounded shadow-sm">
                        <h6 class="fw-bold text-primary border-bottom pb-2 mb-3"><i class="bi bi-images me-2"></i>FOTO PERANGKAT</h6>
                        <div class="row g-2">
                            ${['front', 'back', 'left', 'right'].map(side => `
                                <div class="col-3">
                                    <div class="border rounded p-1 bg-white text-center">
                                        <small class="d-block text-muted extra-small uppercase mb-1">${side}</small>
                                        ${t.device.photos && t.device.photos[side] ? `
                                            <img src="${t.device.photos[side]}" class="img-fluid rounded" style="max-height: 120px; object-fit: contain; cursor: pointer;" onclick="window.open('${t.device.photos[side]}', '_blank')">
                                        ` : `
                                            <div class="py-3 text-light"><i class="bi bi-image fs-2"></i></div>
                                        `}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
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
        this.getOrCreateModal('detailModal').show();
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

    handlePhotoInput(input) {
        const file = input.files[0];
        const box = input.closest('.photo-upload-box');
        const img = box.querySelector('img');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
                img.classList.remove('d-none');
                box.classList.add('has-image');
            };
            reader.readAsDataURL(file);
        }
    }

    removePhoto(btn) {
        const box = btn.closest('.photo-upload-box');
        const input = box.querySelector('input');
        const img = box.querySelector('img');
        
        input.value = '';
        img.src = '';
        img.classList.add('d-none');
        box.classList.remove('has-image');
    }

    async compressImage(file) {
        if (!window.imageCompression) {
            console.error('Library image-compression tidak ditemukan');
            return file;
        }
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1280,
            useWebWorker: true
        };
        try {
            return await window.imageCompression(file, options);
        } catch (error) {
            console.error('Gagal mengompres gambar:', error);
            return file;
        }
    }

    async resendWA(id) {
        try {
            showToast('Mengirim ulang notifikasi...', 'info');
            await api.resendWA(id);
            showToast('Notifikasi WA berhasil dikirim ulang');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async claimWarranty(id) {
        if (!confirm('Buat tiket klaim garansi baru berdasarkan tiket ini?')) return;
        try {
            await api.claimWarranty(id);
            showToast('Tiket klaim garansi berhasil dibuat');
            await this.loadTickets();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async loadLogs() {
        const content = document.getElementById('logs-content');
        content.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm"></div> Memuat...</td></tr>';
        
        try {
            const res = await api.getSystemLogs();
            if (res.data.length === 0) {
                content.innerHTML = '<tr><td colspan="5" class="text-center py-4">Tidak ada log sistem.</td></tr>';
                return;
            }
            
            content.innerHTML = res.data.map(log => `
                <tr class="${log.level === 'ERROR' ? 'table-danger' : log.level === 'WARN' ? 'table-warning' : ''}">
                    <td class="small">${formatDateTime(log.timestamp)}</td>
                    <td><span class="badge ${log.level === 'ERROR' ? 'bg-danger' : log.level === 'WARN' ? 'bg-warning text-dark' : 'bg-info text-dark'}">${log.level}</span></td>
                    <td class="small fw-bold">${log.source}</td>
                    <td class="small">${log.message}</td>
                    <td class="small text-truncate" style="max-width: 200px;" title='${JSON.stringify(log.details)}'>${log.details ? JSON.stringify(log.details) : '-'}</td>
                </tr>
            `).join('');
        } catch (error) {
            content.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">${error.message}</td></tr>`;
        }
    }

    setupEventListeners() {
        // Cek Role untuk tombol Admin
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
        }

        document.getElementById('service-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Memproses...';

            const formData = new FormData();
            
            // PENTING: Ambil nilai terbaru dari elemen DOM
            const customerName = document.getElementById('customer-name').value;
            const customerPhone = document.getElementById('customer-phone').value;
            const customerEmail = document.getElementById('customer-email').value;
            const customerType = document.getElementById('customer-type').value;

            const customerData = {
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
                type: customerType
            };
            
            const deviceType = document.getElementById('device-type').value;
            const deviceBrand = document.getElementById('device-brand').value;
            const deviceModel = document.getElementById('device-model').value;
            const deviceSN = document.getElementById('device-serial-number').value;
            const deviceSymptoms = document.getElementById('device-symptoms').value;
            const deviceAcc = document.getElementById('device-accessories').value;
            const devicePass = document.getElementById('device-password').value;
            const devicePat = document.getElementById('device-pattern').value;

            const deviceData = {
                type: deviceType,
                brand: deviceBrand,
                model: deviceModel,
                serial_number: deviceSN,
                symptoms: deviceSymptoms,
                accessories: deviceAcc,
                password: devicePass,
                pattern: devicePat
            };

            const techId = document.getElementById('technician-select').value;
            const fee = parseCurrencyValue(document.getElementById('service-fee').value);

            // Append data teks DULUAN (Penting untuk beberapa server/proxy)
            formData.append('customer', JSON.stringify(customerData));
            formData.append('device', JSON.stringify(deviceData));
            formData.append('technician_id', techId);
            formData.append('service_fee', fee);

            // Handle Photo Uploads with Compression
            const photoMsg = document.getElementById('photo-compression-msg');
            const photoInputs = document.querySelectorAll('.device-photo');
            let hasPhotos = false;
            for (const input of photoInputs) { if (input.files[0]) hasPhotos = true; }

            try { 
                let response;
                
                if (!hasPhotos) {
                    // JIKA TIDAK ADA FOTO: Kirim sebagai JSON biasa (Paling Stabil di Online)
                    const payload = {
                        customer: customerData,
                        device: deviceData,
                        technician_id: techId,
                        service_fee: fee
                    };
                    response = await api.post('/services', payload);
                } else {
                    // JIKA ADA FOTO: Gunakan FormData
                    photoMsg.classList.remove('d-none');
                    for (const input of photoInputs) {
                        if (input.files[0]) {
                            const compressed = await this.compressImage(input.files[0]);
                            formData.append(input.dataset.side, compressed);
                        }
                    }
                    photoMsg.classList.add('d-none');
                    response = await api.createServiceTicket(formData);
                }

                console.log('Ticket creation success:', response);
                showToast('Tiket Dibuat'); 
                document.getElementById('service-form').reset(); 
                // Clear photo previews
                document.querySelectorAll('.photo-upload-box').forEach(box => {
                    const img = box.querySelector('img');
                    if (img) img.classList.add('d-none');
                    box.classList.remove('has-image');
                });
                if (this.mainPatternLock) this.mainPatternLock.reset();
                document.getElementById('wa-validation-msg').innerHTML = '';
                this.loadTickets(); 
            } catch(e){ 
                console.error('Ticket creation failed:', e);
                showToast(e.message || 'Gagal membuat tiket', 'error'); 
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-save me-2"></i>Buat Tiket';
            }
        });

        // WA Validation on blur
        document.getElementById('customer-phone').addEventListener('blur', (e) => {
            this.validateWA(e.target.value);
        });

        document.getElementById('view-logs-btn').addEventListener('click', () => {
            this.loadLogs();
            this.getOrCreateModal('logsModal').show();
        });

        // Auto-expand textarea logic
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('auto-expand')) {
                e.target.style.height = 'auto';
                e.target.style.height = (e.target.scrollHeight) + 'px';
            }
        });
        document.getElementById('status-filter').addEventListener('change', () => this.loadTickets());
        document.getElementById('refresh-tickets-btn').addEventListener('click', () => this.loadTickets());
        document.getElementById('save-edit-btn').addEventListener('click', () => this.saveEdit());
        
        // Listener Pencarian
        document.getElementById('search-customer').addEventListener('input', () => this.renderTicketList());

        document.getElementById('save-part-btn').addEventListener('click', async () => {
            const tId = document.getElementById('part-ticket-id').value;
            const iId = document.getElementById('part-item-select').value;
            const qty = document.getElementById('part-quantity').value;
            try { 
                await api.addPartToService(tId, iId, qty); 
                showToast('Part ditambahkan'); 
                this.getOrCreateModal('addPartModal').hide(); 
                
                // PENTING: Reload tiket agar data Detail terupdate
                await this.loadTickets();

                // Refresh modal yang sedang terbuka
                if (document.getElementById('editTicketModal').classList.contains('show')) {
                    this.openEdit(tId);
                } else if (document.getElementById('detailModal').classList.contains('show')) {
                    this.openDetail(tId);
                }
            } catch(e){ 
                showToast(e.message, 'error'); 
            }
        });

        document.getElementById('confirm-finish-btn').addEventListener('click', () => this.confirmFinish());

        document.getElementById('confirm-payment-btn').addEventListener('click', () => this.confirmPayment());
    }
}

window.service = new Service();
export default Service;