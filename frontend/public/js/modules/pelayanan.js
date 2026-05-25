import Service from './service.js';
import Order from './order.js';

class Pelayanan {
    constructor() {
        this.service = new Service();
        this.order = new Order();
    }

    async render() {
        window.pelayananModule = this;
        const content = document.getElementById('app-content');

        content.innerHTML = `
            <div class="card shadow-sm border-0">
                <div class="card-header bg-white border-0 pt-3 pb-0 px-3 px-md-4">
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
            });
        });
    }
}

export default Pelayanan;
