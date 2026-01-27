
# 🔧 Bengkel UTC - Workshop & POS Management System

**Bengkel UTC** is a comprehensive, full-stack solution designed to manage computer workshop operations and retail point-of-sale (POS) activities. It features a strict separation of concerns with a robust Node.js/MongoDB backend and a modular, vanilla JavaScript frontend.

## 🚀 Key Features

### 🛠️ Workshop Service Management

* **Ticket System:** Track repairs from "Queue" to "Picked Up".
* **Technician Assignment:** Assign jobs to specific technicians.
* **Parts Tracking:** Add spare parts to tickets with automatic stock deduction.
* **Service History:** Complete logs of repairs and costs.

### 🛒 Point of Sale (POS)

* **Retail Transactions:** Fast checkout for spare parts and accessories.
* **Shopping Cart:** Real-time totals and stock validation.
* **Multi-Payment:** Support for Cash, Transfer, QRIS, and Card.
* **Atomic Operations:** Ensures inventory integrity during concurrent sales.

### 📦 Inventory & Reporting

* **Stock Management:** Real-time tracking with low-stock alerts.
* **Analytics:** Daily/Monthly revenue reports, top-selling items, and staff performance.
* **Role-Based Access:** Distinct panels for Admins, Technicians, and Cashiers.

---

## 🏗️ Tech Stack

### Backend (API)

* **Runtime:** Node.js & Express.js
* **Database:** MongoDB (with Mongoose ODM)
* **Security:** JWT Authentication, Bcrypt
* **Architecture:** MVC (Model-View-Controller)

### Frontend (Client)

* **Core:** HTML5, Vanilla JavaScript (ES6 Modules)
* **Styling:** Bootstrap 5.3 & Bootstrap Icons
* **HTTP Client:** Fetch API Wrapper
* **Build Tool:** None (Native Browser Support)

---

## 📂 Project Structure

```bash
bengkel-utc/
├── backend/            # Express API Server
│   ├── config/         # Database configuration
│   ├── controllers/    # Request logic
│   ├── models/         # Mongoose schemas
│   ├── routes/         # API endpoints
│   └── server.js       # Entry point
│
├── frontend/           # Public Interface
│   └── public/
│       ├── css/        # Stylesheets
│       ├── js/         # Application logic (Modules)
│       └── index.html  # Main entry file
│
└── README.md           # This file

```

---

## ⚡ Getting Started

Follow these steps to get the entire system up and running.

### 1. Prerequisites

* Node.js (v16+)
* MongoDB (Running locally or via Atlas)
* Git

### 2. Backend Setup

The backend runs on port `5000` by default.

```bash
# Go to backend directory
cd backend

# Install dependencies
npm install

# Setup Environment Variables
# Create a .env file and add:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/bengkel_utc
# JWT_SECRET=your_secret_key

# Seed the Database (Creates default Users & Items)
npm run seed

# Start the Server
npm run dev

```

> **Note:** The seeder creates default accounts for Admin, Cashier, and Technicians.

### 3. Frontend Setup

The frontend is a static site that can be served by any HTTP server.

```bash
# Open a new terminal and go to frontend directory
cd frontend/public

# Option A: Using Python (if installed)
python -m http.server 8080

# Option B: Using Node http-server
npx http-server -p 8080

# Option C: VS Code Live Server
# Right-click index.html -> "Open with Live Server"

```

Access the application at: `http://localhost:8080` (or your specific port).

---

## 🔐 Default Credentials

Use these accounts to test the Role-Based Access Control (RBAC):

| Role | Username | Password | Access |
| --- | --- | --- | --- |
| **Administrator** | `admin` | `admin123` | Full Access (Users, Inventory, Reports) |
| **Cashier** | `kasir1` | `kasir123` | POS, Inventory, Daily Reports |
| **Technician** | `farrel` | `password123` | Workshop Services, View Inventory |

---

## 📸 Usage Highlights

1. **Dashboard:** Provides a quick overview of today's revenue and active tickets.
2. **POS:** Go to "Kasir" menu. Add items to cart. Validates stock instantly. Checkout reduces stock count.
3. **Service:** Go to "Servis" menu. Create a ticket. Assign `Farrel`. Add parts used (this also reduces stock). Update status to `Completed`.

---

## ⚠️ Important Configuration

If you change the backend port from `5000`, you must update the frontend configuration:

1. Open `frontend/public/js/api.js`
2. Update the `API_BASE_URL` constant:
```javascript
const API_BASE_URL = 'http://localhost:<YOUR_PORT>/api';

```



---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and create a pull request for any features or bug fixes.

## 📄 License

This project is licensed under the MIT License.

---

**Built for Bengkel Unida Teknologi Center**

Farrel Ghozy Affifudin, Fthurahman Naufal, ts