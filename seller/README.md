# Talel Seller

Seller portal built with React, TypeScript, and Vite. The shared Seller and Host API is in `server/` and uses Express, Prisma, and PostgreSQL.

## Run locally

From PowerShell in this folder:

```powershell
npm install
npm run server:install
Copy-Item server/.env.example server/.env
# Edit server/.env with your PostgreSQL connection and a COOKIE_SECRET of at least 32 characters.
npm run server:db:deploy
npm run server:dev
```

In another PowerShell window:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

The Seller app runs at http://localhost:3002; the API runs at http://localhost:4000. API setup, routes, and limitations are documented in [server/README.md](server/README.md).
