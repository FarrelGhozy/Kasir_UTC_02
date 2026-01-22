// public/js/modules/service.js - Workshop Service Management Module

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
                <!-- New Service Form -->
                <div class="col-lg-4">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h5 class="mb-0"><i class="bi bi-plus-circle me-2"></i>New Service Ticket</h5>
                        </div>
                        <div class="card-body">
                            <form id="service-form">
                                <h6 class="border-bottom pb-2 mb-3">Customer Information</h6>
                                
                                <div class="mb-3">
                                    <label class="form-label">Customer Name *</label>
                                    <input type="text" class="form-control" id="customer-name" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Phone Number *</label>
                                    <input type="tel" class="form-control" id="customer-phone" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Customer Type *</label>
                                    <select class="form-select" id="customer-type" required>
                                        <option value="">Select Type</option>
                                        <option value="Mahasiswa">Mahasiswa</option>
                                        <option value="Dosen">Dosen</option>
                                        <option value="Umum">Umum</option>
                                    </select>
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4">Device Information</h6>

                                <div class="mb-3">
                                    <label class="form-label">Device Type *</label>
                                    <input type="text" class="form-control" id="device-type" 
                                           placeholder="e.g., Laptop, PC, Printer" required>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Brand</label>
                                    <input type="text" class="form-control" id="device-brand" 
                                           placeholder="e.g., ASUS, HP, Lenovo">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Model</label>
                                    <input type="text" class="form-control" id="device-model">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Serial Number</label>
                                    <input type="text" class="form-control" id="device-serial">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Symptoms/Problem *</label>
                                    <textarea class="form-control" id="device-symptoms" rows="3" 
                                              placeholder="Describe the issue..." required></textarea>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Accessories</label>
                                    <input type="text" class="form-control" id="device-accessories" 
                                           placeholder="e.g., Charger, Mouse, Bag">
                                </div>

                                <h6 class="border-bottom pb-2 mb-3 mt-4">Assignment</h6>

                                <div class="mb-3">
                                    <label class="form-label">Assign Technician *</label>
                                    <select class="form-select" id="technician-select" required>
                                        <option value="">Loading technicians...</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Service Fee</label>
                                    <input type="number" class="form-control" id="service-fee" 
                                           value="0" min="0">
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Notes</label>
                                    <textarea class="form-control" id="service-notes" rows="2"></textarea>
                                </div>

                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="bi bi-check-circle me-2"></i>Create Ticket
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- Active Tickets List -->
                <div class="col-lg-8">
                    <div class="card">
                        <div class="card-header">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5 class="mb-0"><i class="bi bi-list-task me-2"></i>Active Service Tickets</h5>
                                <button class="btn btn-sm btn-outline-primary" id="refresh-tickets-btn">
                                    <i class="bi bi-arrow-clockwise"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <select class="form-select" id="status-filter">
                                    <option value="">All Status</option>
                                    <option value="Queue">Queue</option>
                                    <option value="Diagnosing">Diagnosing</option>
                                    <option value="Waiting_Part">Waiting Part</option>
                                    <option value="In_Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>

                            <div id="tickets-container" style="max-height: 600px; overflow-y: auto;">
                                <!-- Tickets loaded here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Add Part Modal -->
            <div class="modal fade" id="addPartModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add Spare Part</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="add-part-form">
                                <input type="hidden" id="part-ticket-id">
                                
                                <div class="mb-3">
                                    <label class="form-label">Select Item *</label>
                                    <select class="form-select" id="part-item-select" required>
                                        <option value="">Choose item...</option>
                                    </select>
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Quantity *</label>
                                    <input type="number" class="form-control" id="part-quantity" 
                                           min="1" value="1" required>
                                </div>

                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle me-2"></i>
                                    Stock will be automatically deducted when you add the part.
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="save-part-btn">
                                <i class="bi bi-plus-circle me-2"></i>Add Part
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
            select.innerHTML = '<option value="">Select Technician</option>' +
                this.technicians.map(tech => 
                    `<option value="${tech._id}">${tech.name}</option>`
                ).join('');
        } catch (error) {
            showToast('Failed to load technicians', 'error');
        }
    }

    async loadItems() {
        try {
            const response = await api.getInventory({ limit: 100 });
            this.items = response.data.filter(item => item.stock > 0);
            
            const select = document.getElementById('part-item-select');
            select.innerHTML = '<option value="">Choose item...</option>' +
                this.items.map(item => 
                    `<option value="${item._id}">${item.name} - Stock: ${item.stock} - ${formatCurrency(item.selling_price)}</option>`
                ).join('');
        } catch (error) {
            console.error('Failed to load items:', error);
        }
    }

    async loadTickets() {
        const container = document.getElementById('tickets-container');
        const statusFilter = document.getElementById('status-filter').value;
        
        container.innerHTML = '<div class="text-center py-4"><div class="spinner-border"></div></div>';

        try {
            const params = statusFilter ? { status: statusFilter } : {};
            const response = await api.getServiceTickets(params);
            this.tickets = response.data;
            
            this.renderTickets();
        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }

    renderTickets() {
        const container = document.getElementById('tickets-container');
        
        if (this.tickets.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox fs-1"></i>
                    <p class="mt-2">No tickets found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tickets.map(ticket => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h6 class="mb-1">
                                <strong>${ticket.ticket_number}</strong>
                                <span class="ticket-status ${ticket.status} ms-2">${ticket.status.replace('_', ' ')}</span>
                            </h6>
                            <small class="text-muted">
                                <i class="bi bi-calendar me-1"></i>${formatDateTime(ticket.timestamps.created_at)}
                            </small>
                        </div>
                        <div class="text-end">
                            <strong class="text-primary">${formatCurrency(ticket.total_cost)}</strong>
                        </div>
                    </div>

                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <small class="text-muted d-block">Customer</small>
                            <strong>${ticket.customer.name}</strong><br>
                            <small>${ticket.customer.phone} • ${ticket.customer.type}</small>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted d-block">Device</small>
                            <strong>${ticket.device.type} ${ticket.device.brand || ''}</strong><br>
                            <small>${ticket.device.symptoms}</small>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted d-block">Technician</small>
                            <strong><i class="bi bi-person-badge me-1"></i>${ticket.technician.name}</strong>
                        </div>
                        ${ticket.parts_used.length > 0 ? `
                        <div class="col-md-6">
                            <small class="text-muted d-block">Parts Used</small>
                            ${ticket.parts_used.map(part => `
                                <small>${part.name} x${part.qty}</small><br>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>

                    <div class="d-flex gap-2">
                        ${ticket.status !== 'Completed' && ticket.status !== 'Picked_Up' ? `
                            <button class="btn btn-sm btn-primary" onclick="service.openAddPartModal('${ticket._id}')">
                                <i class="bi bi-plus-circle me-1"></i>Add Part
                            </button>
                            <button class="btn btn-sm btn-success" onclick="service.updateStatus('${ticket._id}', '${this.getNextStatus(ticket.status)}')">
                                <i class="bi bi-arrow-right me-1"></i>${this.getNextStatus(ticket.status).replace('_', ' ')}
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-outline-secondary" onclick="service.viewTicketDetails('${ticket._id}')">
                            <i class="bi bi-eye me-1"></i>Details
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
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
        // Service form submission
        document.getElementById('service-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createTicket();
        });

        // Status filter
        document.getElementById('status-filter').addEventListener('change', () => {
            this.loadTickets();
        });

        // Refresh tickets
        document.getElementById('refresh-tickets-btn').addEventListener('click', () => {
            this.loadTickets();
        });

        // Add part form
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
                accessories: document.getElementById('device-accessories').value || 'None'
            },
            technician_id: document.getElementById('technician-select').value,
            service_fee: parseInt(document.getElementById('service-fee').value) || 0,
            notes: document.getElementById('service-notes').value
        };

        try {
            const response = await api.createServiceTicket(formData);
            
            if (response.success) {
                showToast('Service ticket created successfully!', 'success');
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
            showToast('Please select item and quantity', 'error');
            return;
        }

        try {
            const response = await api.addPartToService(ticketId, itemId, quantity);
            
            if (response.success) {
                showToast('Part added successfully! Stock deducted.', 'success');
                bootstrap.Modal.getInstance(document.getElementById('addPartModal')).hide();
                await this.loadTickets();
                await this.loadItems(); // Reload to update stock
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async updateStatus(ticketId, newStatus) {
        if (!confirm(`Update status to ${newStatus.replace('_', ' ')}?`)) return;

        try {
            await api.updateTicketStatus(ticketId, newStatus);
            showToast('Status updated successfully!', 'success');
            await this.loadTickets();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    viewTicketDetails(ticketId) {
        const ticket = this.tickets.find(t => t._id === ticketId);
        if (!ticket) return;

        alert(`Ticket Details:\n\n${JSON.stringify(ticket, null, 2)}`);
    }
}

// Make service methods globally accessible
window.service = new Service();

export default Service;