import api, { escapeHTML, formatDate } from '../api.js';
import Service from './service.js';
import Order from './order.js';

class Pelayanan {
    constructor() {
        this.service = new Service();
        this.order = new Order();
        this.notas = [];
    }

    async render() {
        window.pelayananModule = this;
        const content = document.getElementById('app-content');

        content.innerHTML = `
            <div class="card shadow-sm border-0">
                <div class="card-header bg-white border-0 pt-3 px-3 px-md-4">
                    <div class="d-flex justify-content-end mb-2">
                        <button class="btn btn-sm btn-outline-secondary" onclick="pelayananModule.showNotaHistory()">
                            <i class="bi bi-file-text me-1"></i>Riwayat Nota
                        </button>
                    </div>
                    <div class="btn-group w-100 shadow-sm" role="group">
                        <button class="btn btn-outline-primary fw-bold py-2 active" id="tab-service" data-panel="service">
                            <i class="bi bi-wrench me-2"></i>Servis
                        </button>
                        <button class="btn btn-outline-primary fw-bold py-2" id="tab-order" data-panel="order">
                            <i class="bi bi-bag-plus me-2"></i>Pesanan Barang
                        </button>
                    </div>
                </div>
                <div class="card-body p-0 pt-3 px-0">
                    <div id="panel-service"></div>
                    <div id="panel-order" class="d-none"></div>
                </div>
            </div>

            <div class="modal fade" id="notaHistoryModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold"><i class="bi bi-file-text me-2"></i>Riwayat Nota Digital</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="d-flex flex-wrap gap-2 mb-3">
                                <div class="input-group input-group-sm" style="width: 220px;">
                                    <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
                                    <input type="text" class="form-control" id="nota-search" placeholder="Cari nomor/nama...">
                                </div>
                                <select class="form-select form-select-sm" id="nota-type-filter" style="width: 140px;">
                                    <option value="">Semua Tipe</option>
                                    <option value="Servis">Servis</option>
                                    <option value="Pesanan">Pesanan</option>
                                </select>
                                <span class="ms-auto small text-muted align-self-center" id="nota-count"></span>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-hover table-sm align-middle mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th style="width: 50px;">#</th>
                                            <th style="width: 80px;">Tipe</th>
                                            <th>No. Tiket</th>
                                            <th>Pelanggan</th>
                                            <th style="width: 100px;">Tanggal</th>
                                            <th style="width: 60px;">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="nota-table-body">
                                        <tr><td colspan="6" class="text-center text-muted py-4">Memuat data...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div class="text-center text-muted small mt-2" id="nota-empty" style="display:none;">
                                <i class="bi bi-inbox display-6"></i><p class="mt-1">Belum ada nota digital.</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <span class="small text-muted me-auto">Nota disimpan sebagai arsip digital.</span>
                            <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Tutup</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await Promise.all([
            this.service.render('panel-service'),
            this.order.render('panel-order')
        ]);

        this.setupEventListeners();
    }

    setupEventListeners() {
        const toggleBtns = document.querySelectorAll('#tab-service, #tab-order');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const panel = btn.dataset.panel;
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('panel-service').classList.toggle('d-none', panel !== 'service');
                document.getElementById('panel-order').classList.toggle('d-none', panel !== 'order');
                if (panel === 'order') this.order.loadOrders();
            });
        });
    }

    async showNotaHistory() {
        const modalEl = document.getElementById('notaHistoryModal');
        if (!modalEl) return;
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        document.getElementById('nota-table-body').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>Memuat data...</td></tr>';

        try {
            const res = await api.getNotas();
            this.notas = res.data || [];
            this.renderNotaTable();
        } catch (err) {
            document.getElementById('nota-table-body').innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${escapeHTML(err.message)}</td></tr>`;
        }

        const searchInput = document.getElementById('nota-search');
        const filterSelect = document.getElementById('nota-type-filter');
        const handler = () => this.renderNotaTable();

        searchInput.removeEventListener('input', handler);
        filterSelect.removeEventListener('change', handler);
        searchInput.addEventListener('input', handler);
        filterSelect.addEventListener('change', handler);
    }

    renderNotaTable() {
        const searchTerm = document.getElementById('nota-search')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('nota-type-filter')?.value || '';

        let filtered = this.notas.filter(n => {
            if (typeFilter && n.type !== typeFilter) return false;
            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                return (n.ticketNumber || '').toLowerCase().includes(q)
                    || (n.customerName || '').toLowerCase().includes(q)
                    || (n.type || '').toLowerCase().includes(q);
            }
            return true;
        });

        const tbody = document.getElementById('nota-table-body');
        const empty = document.getElementById('nota-empty');
        const count = document.getElementById('nota-count');

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            count.textContent = '0 nota';
            return;
        }

        empty.style.display = 'none';
        count.textContent = `${filtered.length} nota`;

        tbody.innerHTML = filtered.map((n, i) => `
            <tr>
                <td class="text-muted">${i + 1}</td>
                <td><span class="badge ${n.type === 'Servis' ? 'bg-primary' : 'bg-success'}">${n.type}</span></td>
                <td class="fw-medium">${escapeHTML(n.ticketNumber)}</td>
                <td>${escapeHTML(n.customerName)}</td>
                <td class="text-muted small">${formatDate(n.date)}</td>
                <td>
                    <a href="${n.url}" target="_blank" class="btn btn-sm btn-outline-primary" title="Download">
                        <i class="bi bi-download"></i>
                    </a>
                </td>
            </tr>
        `).join('');
    }
}

export default Pelayanan;
