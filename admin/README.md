# AutoParts Pro - Admin App
Admin panel. Run: `npm install && npm run dev` → http://localhost:3003
# Talel Host / Admin

The Host portal uses the shared Express API from `seller/server`; it does not create a separate backend or database.

1. Configure and migrate the shared API as described in `../seller/server/README.md`.
2. Set `APP_ORIGINS` in `seller/server/.env` to include `http://localhost:3003`.
3. Create the first Host account from the `seller/` folder after migration: set `HOST_ADMIN_EMAIL` and a unique `HOST_ADMIN_PASSWORD` (16+ characters) in a controlled PowerShell session, then run `npm run db:host:create --prefix server`. The helper refuses to promote or overwrite an existing user.
4. Copy `.env.example` to `.env.local`, then run `npm install` and `npm run dev` in this folder. The admin app is served at `http://localhost:3003`.

Host sessions use the shared HTTP-only `talel_session` cookie. Host-only API routes are under `/api/v1/host/`. No Host sign-up flow exists.
