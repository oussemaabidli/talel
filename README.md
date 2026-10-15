# AutoParts Pro - Multi-App Architecture

The project has been separated into 3 independent, dedicated applications:

---

### 1. `client/` — Client Application
Contains all client portal features:
- **Port**: `http://localhost:3001`
- **Features**: Spare part requests creation & tracking, browsing incoming offers, order history, messaging, notifications, profile.
- **Run**:
  ```bash
  npm run dev:client
  # or
  cd client && npm run dev
  ```

---

### 2. `seller/` — Seller Application
Contains all seller portal features:
- **Port**: `http://localhost:3002`
- **Features**: Browse buyer requests, quote offers, order fulfillment, inventory management, sales reports, client messaging, notifications.
- **Run**:
  ```bash
  npm run dev:seller
  # or
  cd seller && npm run dev
  ```

---

### 3. `admin/` — Admin Application
Contains all platform management features:
- **Port**: `http://localhost:3003`
- **Features**: Platform overview dashboard, user moderation (clients & sellers), system-wide request/offer/order tracking, financial transactions, categories, reports, audit logs, system settings.
- **Run**:
  ```bash
  npm run dev:admin
  # or
  cd admin && npm run dev
  ```

---

### Project Structure Overview

```
talel/
├── package.json         # Root scripts (run dev:client, dev:seller, dev:admin)
├── client/              # Standalone Client Vite/React App (Port 3001)
│   ├── src/
│   │   ├── layouts/     # ClientLayout
│   │   ├── pages/       # Client pages (Dashboard, Requests, Offers, Orders, etc.)
│   │   ├── components/  # Reusable UI widgets
│   │   ├── store/       # Zustand store
│   │   ├── types/       # TypeScript types
│   │   └── utils/       # Helpers
│   └── package.json
│
├── seller/              # Standalone Seller Vite/React App (Port 3002)
│   ├── src/
│   │   ├── layouts/     # SellerLayout
│   │   ├── pages/       # Seller pages (Dashboard, Inventory, Offers, Sales, etc.)
│   │   └── ...
│   └── package.json
│
└── admin/               # Standalone Admin Vite/React App (Port 3003)
    ├── src/
    │   ├── layouts/     # AdminLayout
    │   ├── pages/       # Admin pages (Overview, Users, Transactions, Reports, etc.)
    │   └── ...
    └── package.json
```

