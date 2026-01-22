# Bengkel UTC - Workshop & POS Management System

A complete RESTful API for managing computer workshop services and retail point-of-sale operations with MongoDB as the database backend.

## 🚀 Features

### Core Modules
- **Authentication & Authorization** - Role-based access control (Admin, Teknisi, Kasir)
- **Inventory Management** - Stock tracking with automatic deduction on sales
- **Service Ticketing** - Complete workshop ticket management with status tracking
- **POS Transactions** - Retail sales with atomic stock operations
- **Revenue Reports** - Comprehensive analytics and aggregation pipelines

### Key Highlights
- ✅ **Strict MVC Architecture** - Clean separation of Routes → Controllers → Models
- ✅ **Atomic Transactions** - MongoDB sessions ensure data consistency
- ✅ **Auto Stock Deduction** - Prevents overselling with validation
- ✅ **Embedded Documents** - Optimized schema design for NoSQL
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Aggregation Pipelines** - Advanced reporting and analytics

---

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- npm or yarn

---

## 🛠️ Installation

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd bengkel-utc-api
npm install
```

### 2. Environment Configuration

Create `.env` file in root directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bengkel_utc
JWT_SECRET=your_super_secret_jwt_key_change_in_production
NODE_ENV=development
```

### 3. Seed Database

```bash
npm run seed
```

This will create:
- **7 Technicians**: Farrel, Wildan, Kaukab, Rasya, Tamam, Noer Syamsi, Baso
- **Default Admin**: `admin / admin123`
- **Default Kasir**: `kasir1 / kasir123`
- **10 Sample Items** for testing

### 4. Start Server

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:5000`

---

## 🔐 Authentication

All endpoints (except login) require JWT token in Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "name": "Admin UTC",
      "username": "admin",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 📚 API Endpoints

### Authentication & Users

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/login` | Public | User login |
| GET | `/api/auth/me` | Private | Get current user |
| POST | `/api/auth/register` | Admin | Create new user |
| GET | `/api/auth/users` | Admin | Get all users |
| GET | `/api/auth/technicians` | Private | Get technicians only |
| PATCH | `/api/auth/change-password` | Private | Change own password |
| PUT | `/api/auth/users/:id` | Admin | Update user |
| DELETE | `/api/auth/users/:id` | Admin | Deactivate user |

### Inventory Management

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/inventory` | Admin, Kasir | Create new item |
| GET | `/api/inventory` | Private | Get all items with filters |
| GET | `/api/inventory/:id` | Private | Get item by ID |
| PUT | `/api/inventory/:id` | Admin, Kasir | Update item |
| DELETE | `/api/inventory/:id` | Admin | Deactivate item |
| GET | `/api/inventory/alerts/low-stock` | Private | Get low stock alerts |
| PATCH | `/api/inventory/:id/stock` | Admin | Manual stock adjustment |
| GET | `/api/inventory/summary/value` | Admin | Get inventory value |
| GET | `/api/inventory/summary/by-category` | Private | Items by category |

**Example: Create Item**
```http
POST /api/inventory
Authorization: Bearer <token>

{
  "sku": "RAM-16GB-001",
  "name": "RAM DDR4 16GB Corsair",
  "category": "Sparepart",
  "purchase_price": 800000,
  "selling_price": 1000000,
  "stock": 10,
  "min_stock_alert": 3
}
```

**Example: Get Low Stock Items**
```http
GET /api/inventory/alerts/low-stock
Authorization: Bearer <token>
```

### Service Tickets (Bengkel)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/services` | Teknisi, Admin | Create service ticket |
| GET | `/api/services` | Private | Get all tickets with filters |
| GET | `/api/services/:id` | Private | Get ticket by ID |
| PATCH | `/api/services/:id/status` | Teknisi, Admin | Update ticket status |
| POST | `/api/services/:id/parts` | Teknisi, Admin | Add part (auto-deduct stock) |
| PATCH | `/api/services/:id/service-fee` | Teknisi, Admin | Update service fee |
| DELETE | `/api/services/:id` | Admin | Cancel ticket |
| GET | `/api/services/technician/:id/workload` | Private | Get technician workload |

**Example: Create Service Ticket**
```http
POST /api/services
Authorization: Bearer <token>

{
  "customer": {
    "name": "Ahmad Fauzi",
    "phone": "081234567890",
    "type": "Mahasiswa"
  },
  "device": {
    "type": "Laptop",
    "brand": "ASUS",
    "model": "VivoBook 14",
    "serial_number": "ABC123456",
    "symptoms": "Laptop mati total, tidak bisa booting",
    "accessories": "Charger, tas laptop"
  },
  "technician_id": "64f8a1b2c3d4e5f6a7b8c9d0",
  "service_fee": 50000,
  "notes": "Customer menunggu"
}
```

**Example: Add Part to Service (CRITICAL - Auto Stock Deduction)**
```http
POST /api/services/64f8a1b2c3d4e5f6a7b8c9d1/parts
Authorization: Bearer <token>

{
  "item_id": "64f8a1b2c3d4e5f6a7b8c9d2",
  "quantity": 2
}
```
⚠️ **This will automatically deduct 2 units from inventory**

**Status Values:**
- `Queue` - Waiting to be diagnosed
- `Diagnosing` - Being diagnosed
- `Waiting_Part` - Waiting for spare parts
- `In_Progress` - Being repaired
- `Completed` - Repair completed
- `Picked_Up` - Device picked up by customer
- `Cancelled` - Service cancelled

### POS Transactions (Kasir)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/transactions` | Kasir, Admin | Create retail transaction |
| GET | `/api/transactions` | Private | Get all transactions |
| GET | `/api/transactions/:id` | Private | Get transaction by ID |
| GET | `/api/transactions/invoice/:invoice_no` | Private | Get by invoice number |
| GET | `/api/transactions/summary/today` | Private | Today's summary |
| DELETE | `/api/transactions/:id` | Admin | Delete transaction |

**Example: Create Transaction (CRITICAL - Atomic Stock Operation)**
```http
POST /api/transactions
Authorization: Bearer <token>

{
  "items": [
    {
      "item_id": "64f8a1b2c3d4e5f6a7b8c9d2",
      "qty": 2
    },
    {
      "item_id": "64f8a1b2c3d4e5f6a7b8c9d3",
      "qty": 1
    }
  ],
  "payment_method": "Cash",
  "amount_paid": 1500000,
  "notes": "Customer VIP"
}
```
⚠️ **Stock is deducted atomically. If any item has insufficient stock, the entire transaction is rolled back.**

**Payment Methods:** `Cash`, `Transfer`, `QRIS`, `Card`

### Reports & Analytics

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/reports/revenue/daily` | Admin, Kasir | Daily revenue report |
| GET | `/api/reports/revenue/monthly` | Admin, Kasir | Monthly revenue report |
| GET | `/api/reports/revenue/range` | Admin, Kasir | Custom date range |
| GET | `/api/reports/top-items` | Admin | Top selling items |
| GET | `/api/reports/cashier-performance` | Admin | Cashier performance |
| GET | `/api/reports/technician-performance` | Admin | Technician performance |

**Example: Daily Revenue**
```http
GET /api/reports/revenue/daily?date=2026-01-22
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "date": "2026-01-22",
  "data": {
    "retail_sales": {
      "revenue": 5500000,
      "transactions": 12
    },
    "service_revenue": {
      "revenue": 3200000,
      "tickets": 8
    },
    "total_revenue": 8700000,
    "total_transactions": 20
  }
}
```

---

## 🗂️ Database Schema

### User Schema
```javascript
{
  name: String,
  username: String (unique),
  password: String (hashed),
  role: Enum ['admin', 'teknisi', 'kasir'],
  isActive: Boolean,
  created_at: Date
}
```

### Item Schema
```javascript
{
  sku: String (unique),
  name: String,
  category: Enum ['Sparepart', 'Accessory', 'Software', 'Service', 'Other'],
  purchase_price: Number,
  selling_price: Number,
  stock: Number,
  min_stock_alert: Number,
  isActive: Boolean
}
```

### ServiceTicket Schema (Embedded)
```javascript
{
  ticket_number: String (auto: SRV-2026001),
  customer: {
    name: String,
    phone: String,
    type: Enum ['Mahasiswa', 'Dosen', 'Umum']
  },
  device: {
    type: String,
    brand: String,
    model: String,
    serial_number: String,
    symptoms: String,
    accessories: String
  },
  technician: {
    id: ObjectId (ref: User),
    name: String
  },
  status: Enum,
  parts_used: [{
    item_id: ObjectId (ref: Item),
    name: String,
    qty: Number,
    price_at_time: Number,
    subtotal: Number
  }],
  service_fee: Number,
  total_cost: Number (auto-calculated),
  timestamps: {
    created_at: Date,
    diagnosed_at: Date,
    completed_at: Date
  }
}
```

### Transaction Schema
```javascript
{
  invoice_no: String (auto: INV-202601XXXX),
  cashier_id: ObjectId (ref: User),
  cashier_name: String,
  items: [{
    item_id: ObjectId (ref: Item),
    name: String,
    qty: Number,
    price: Number,
    subtotal: Number
  }],
  grand_total: Number,
  payment_method: Enum,
  amount_paid: Number,
  change: Number,
  date: Date
}
```

---

## 🔒 Role-Based Access Control

### Admin
- Full access to all endpoints
- User management
- Inventory management
- Reports and analytics

### Teknisi (Technician)
- Create and manage service tickets
- Add parts to services
- View inventory
- Update service status

### Kasir (Cashier)
- Create POS transactions
- Manage inventory (CRUD)
- View daily/monthly reports
- Cannot manage users

---

## ⚠️ Important Notes

### Stock Management
1. **Atomic Operations**: Both POS transactions and service parts use MongoDB transactions to ensure atomicity
2. **Validation**: Stock is validated before deduction. Insufficient stock throws an error and rolls back
3. **Historical Pricing**: Transactions store the price at the time of sale, not references

### Best Practices
- Always check low stock alerts: `GET /api/inventory/alerts/low-stock`
- Use filters for large datasets: `?page=1&limit=20`
- Monitor technician workload: `GET /api/services/technician/:id/workload`

### Security
- Change default passwords immediately in production
- Use strong JWT_SECRET
- Enable HTTPS in production
- Implement rate limiting for production

---

## 🧪 Testing Examples

### Complete Workflow Test

1. **Login as Kasir**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"kasir1","password":"kasir123"}'
```

2. **Check Low Stock**
```bash
curl http://localhost:5000/api/inventory/alerts/low-stock \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Create POS Transaction**
```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"item_id":"ITEM_ID_HERE","qty":1}],
    "payment_method":"Cash",
    "amount_paid":500000
  }'
```

4. **Get Today's Revenue**
```bash
curl http://localhost:5000/api/reports/revenue/daily \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📞 Support

For issues or questions:
- Create an issue in the repository
- Contact: admin@bengkelutc.ac.id

---

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ for Bengkel Unida Teknologi Center**