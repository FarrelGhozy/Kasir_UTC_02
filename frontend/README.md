# Bengkel UTC - Frontend Documentation

A professional, modular vanilla JavaScript frontend for the Bengkel UTC Workshop Management System.

## 🎨 Tech Stack

- **HTML5** - Semantic structure
- **Bootstrap 5.3** - Responsive UI framework (via CDN)
- **Bootstrap Icons** - Icon library (via CDN)
- **Vanilla JavaScript (ES6+)** - Modular architecture with import/export
- **No Build Tools** - Pure client-side application

## 📁 File Structure

```
public/
├── index.html              # Main application shell
├── css/
│   └── styles.css         # Custom theme & overrides
├── js/
│   ├── api.js             # Global API handler (fetch wrapper)
│   ├── auth.js            # Authentication & token management
│   ├── app.js             # Main router & navigation
│   └── modules/
│       ├── dashboard.js   # Dashboard overview
│       ├── pos.js         # Point of Sale module
│       ├── service.js     # Workshop service management
│       ├── inventory.js   # Inventory CRUD operations
│       └── reports.js     # Reports & analytics
└── assets/
    └── logo.png           # (Optional) Company logo
```

## 🚀 Running the Application

### Option 1: Python SimpleHTTPServer

```bash
cd public
python -m http.server 8080
```

Visit: `http://localhost:8080`

### Option 2: Node.js HTTP Server

```bash
npm install -g http-server
cd public
http-server -p 8080
```

### Option 3: VS Code Live Server

1. Install "Live Server" extension
2. Right-click `index.html`
3. Select "Open with Live Server"

## ⚙️ Configuration

Edit `public/js/api.js` to configure your backend URL:

```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

## 🔐 Authentication

### Login Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`

**Kasir (Cashier):**
- Username: `kasir1`
- Password: `kasir123`

**Teknisi (Technician):**
- Username: `farrel` (or wildan, kaukab, rasya, tamam, noer_syamsi, baso)
- Password: `password123`

### How It Works

1. User logs in via the login form
2. JWT token is stored in `localStorage`
3. Token is automatically attached to all API requests via `Authorization: Bearer <token>`
4. On token expiration or logout, user is redirected to login screen

## 📦 Modules Overview

### 1. Dashboard (`dashboard.js`)

**Features:**
- Today's revenue summary
- Transaction count
- Active service tickets
- Low stock alerts
- Recent activity feed

**Key Functions:**
- `loadDashboardData()` - Fetches all dashboard metrics
- `loadLowStock()` - Displays items with low stock
- `loadRecentActivity()` - Shows recent transactions

### 2. Point of Sale (`pos.js`)

**Features:**
- Product search & category filtering
- Visual product grid
- Shopping cart with real-time updates
- Multiple payment methods (Cash, Transfer, QRIS, Card)
- Automatic stock validation
- Change calculation for cash payments

**Key Functions:**
- `addToCart(itemId)` - Adds product to cart
- `processPayment()` - Submits transaction to API (atomic stock deduction)
- `renderCart()` - Updates cart UI dynamically

**User Flow:**
1. Search/browse products
2. Click product to add to cart
3. Adjust quantities in cart
4. Select payment method
5. Click "Process Payment"
6. Stock is automatically deducted

### 3. Workshop Service (`service.js`)

**Features:**
- Customer intake form
- Device information capture
- Technician assignment (fetched from API)
- Active ticket tracking with status badges
- Add spare parts to tickets (auto stock deduction)
- Status progression workflow
- Filter by ticket status

**Key Functions:**
- `createTicket()` - Submits new service request
- `loadTechnicians()` - Fetches technicians from `/auth/technicians`
- `addPart()` - Adds spare part to ticket (deducts stock)
- `updateStatus(id, status)` - Updates ticket status

**Status Flow:**
Queue → Diagnosing → In_Progress → Completed → Picked_Up

### 4. Inventory Management (`inventory.js`)

**Features:**
- Full CRUD operations for items
- Search by name or SKU
- Category filtering
- Stock status indicators (Low/Medium/Good)
- Manual stock adjustment (add/deduct)
- Stock alerts with color coding

**Key Functions:**
- `loadItems()` - Fetches inventory with filters
- `saveItem()` - Create or update item
- `adjustStock()` - Manual stock restock/correction
- `deleteItem(id)` - Soft delete item

**Stock Badge Colors:**
- 🔴 Red (Low): Stock ≤ min_stock_alert
- 🟡 Yellow (Medium): Stock ≤ 2× min_stock_alert
- 🟢 Green (Good): Stock > 2× min_stock_alert

### 5. Reports & Analytics (`reports.js`)

**Features:**
- Daily revenue breakdown
- Monthly revenue with daily breakdown
- Top selling items
- Cashier performance metrics
- Technician performance metrics

**Report Types:**

**Daily Revenue:**
- Total revenue (Retail + Service)
- Transaction count
- Date selector

**Monthly Revenue:**
- Month/year selector
- Daily breakdown table
- Retail vs Service comparison

**Top Items:**
- Top 10 best-selling products
- Quantity sold
- Revenue generated
- Purchase frequency

**Performance:**
- Cashier leaderboard
- Technician productivity
- Average transaction values

## 🎨 Design System

### Color Scheme

```css
Primary:    #0d6efd (Bootstrap Blue)
Secondary:  #6c757d (Gray)
Success:    #198754 (Green)
Warning:    #ffc107 (Yellow)
Danger:     #dc3545 (Red)
Background: #f8f9fa (Light Gray)
Dark:       #212529 (Almost Black)
```

### Layout Structure

```
┌─────────────────────────────────────┐
│  [Sidebar Nav]  │  [Top Nav Bar]   │
│                 ├──────────────────┤
│  - Dashboard    │                  │
│  - Kasir (POS)  │   Main Content   │
│  - Servis       │      Area        │
│  - Gudang       │                  │
│  - Laporan      │                  │
│                 │                  │
│  [User Info]    │                  │
│  [Logout Btn]   │                  │
└─────────────────────────────────────┘
```

### Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🔧 Key Features

### 1. **Atomic Stock Operations**

Both POS and Service modules use **optimistic UI updates** with **server-side validation**:

```javascript
// Frontend validates before sending
if (item.stock < quantity) {
    showToast('Insufficient stock', 'error');
    return;
}

// Backend validates again & uses MongoDB transactions
await api.createTransaction(data);
```

### 2. **Real-time Cart Updates**

The shopping cart recalculates totals on every change:

```javascript
const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
document.getElementById('cart-total').textContent = formatCurrency(total);
```

### 3. **Dynamic Technician Loading**

Service form fetches technicians from the backend:

```javascript
const response = await api.getTechnicians();
select.innerHTML = technicians.map(tech => 
    `<option value="${tech._id}">${tech.name}</option>`
).join('');
```

### 4. **Error Handling**

All API calls include error handling:

```javascript
try {
    const response = await api.createTransaction(data);
    showToast('Success!', 'success');
} catch (error) {
    showToast(error.message, 'error');
}
```

### 5. **Toast Notifications**

Unified notification system:

```javascript
showToast('Item added to cart', 'success');
showToast('Insufficient stock', 'error');
showToast('Processing...', 'info');
```

## 🎯 Role-Based Access

### Admin
- Full access to all modules
- Can manage users, inventory, services, and view all reports

### Kasir (Cashier)
- Dashboard ✅
- POS (Kasir) ✅
- Inventory ✅
- Reports ✅
- Service ❌ (hidden)

### Teknisi (Technician)
- Dashboard ✅
- Service ✅
- Inventory ✅ (view only)
- Reports ✅ (view only)
- POS ❌ (hidden)

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🐛 Troubleshooting

### API Connection Issues

```javascript
// Check if backend is running
curl http://localhost:5000/health

// Check CORS settings in backend server.js
app.use(cors({
  origin: ['http://localhost:8080']
}));
```

### Authentication Errors

```javascript
// Clear localStorage and try again
localStorage.removeItem('token');
localStorage.removeItem('user');
location.reload();
```

### Module Not Loading

```javascript
// Check browser console for errors
// Ensure you're using a server (not file://)
// Verify all module paths in import statements
```

## 🔒 Security Notes

1. **Never commit sensitive credentials**
2. **Change default passwords in production**
3. **Use HTTPS in production**
4. **Set secure token expiration**
5. **Implement rate limiting on backend**
6. **Validate all inputs on both frontend and backend**

## 🎓 Code Structure Best Practices

### Modular Architecture

Each module follows this pattern:

```javascript
class ModuleName {
    constructor() {
        // Initialize state
    }

    async render() {
        // Render HTML template
    }

    setupEventListeners() {
        // Attach event handlers
    }

    async loadData() {
        // Fetch from API
    }
}

export default ModuleName;
```

### API Calls

Always use the centralized API handler:

```javascript
import api from '../api.js';

// Good ✅
const response = await api.getInventory();

// Bad ❌
fetch('http://localhost:5000/api/inventory')
```

### Error Handling Pattern

```javascript
try {
    const response = await api.someMethod();
    if (response.success) {
        showToast('Success!', 'success');
        await this.refreshData();
    }
} catch (error) {
    showToast(error.message, 'error');
}
```

## 📚 Additional Resources

- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)
- [Bootstrap Icons](https://icons.getbootstrap.com/)
- [MDN ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

## 🤝 Contributing

When adding new features:

1. Create a new module in `js/modules/`
2. Import and register in `app.js`
3. Add navigation link in `index.html`
4. Follow existing patterns for consistency
5. Handle errors gracefully
6. Update this documentation

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for Bengkel Unida Teknologi Center**