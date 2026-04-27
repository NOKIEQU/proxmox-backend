# Proxmox Backend

A Node.js + Express backend for managing VPS provisioning, billing, and infrastructure. This API handles user authentication, service orders, Proxmox cluster integration, Stripe payments, and automated email notifications.

## Project Structure

```
src/
├── api/           # Route definitions
├── controllers/   # Business logic for each endpoint
├── services/      # Reusable utilities (Proxmox, Stripe, email, etc.)
├── middlewares/   # Auth, error handling
├── cron/          # Scheduled tasks (billing cycles)
└── config/        # Environment and app configuration

prisma/
├── schema.prisma  # Database schema
└── migrations/    # SQL migration history
```

## Prerequisites

- **Node.js** 18+ (tested with `node --version`)
- **MySQL** 5.7+ running locally or accessible remotely
- **Proxmox** cluster with API token credentials
- **Stripe** test/live account for payment processing
- **SMTP** server (e.g., Resend, SendGrid) for email notifications

## Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy the template and fill in your secrets:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```dotenv
NODE_ENV=development
PORT=3001

# Proxmox API
PVE_HOST=your.proxmox.host
PVE_TOKEN_ID=backend@pve!backend-token
PVE_TOKEN_SECRET=your-token-uuid

# JWT
JWT_SECRET=your-secure-random-string

# Database
DATABASE_URL=mysql://user:pass@localhost:3306/proxmox_backend

# Stripe
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend, SendGrid, etc.)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=your-api-key
```

3. **Set up the database:**

Initialize Prisma and run migrations:

```bash
npx prisma migrate dev --name init
```

This creates tables and prepares the database. If you already have migrations, just sync:

```bash
npx prisma db push
```

4. **Seed initial data (optional):**

```bash
node prisma/seed.js
```

## Running the Project

**Development mode** (with auto-reload):

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The server will start on `http://localhost:3001` (or your `PORT` from `.env`).

## API Overview

### Authentication
- `POST /api/auth/login` — Login with email/password
- `POST /api/auth/register` — Create new user account
- `POST /api/auth/refresh` — Refresh JWT token

### User Management
- `GET /api/users/me` — Get current user profile
- `PUT /api/users/me` — Update profile

### VPS Services
- `GET /api/vps` — List user's VPS instances
- `POST /api/vps` — Create new VPS (requires active order)
- `POST /api/vps/:id/start` — Power on
- `POST /api/vps/:id/stop` — Power off
- `POST /api/vps/:id/reboot` — Reboot
- `POST /api/vps/:id/reinstall` — Wipe and reinstall OS
- `GET /api/vps/:id/stats` — CPU, memory, disk usage

### Products & Pricing
- `GET /api/products` — List available plans
- `GET /api/products/:id` — Get plan details

### Billing & Payments
- `POST /api/billing/checkout` — Create Stripe checkout session
- `POST /api/billing/webhook` — Stripe webhook (payment confirmations)
- `GET /api/billing/invoices` — User's invoices

### Admin (requires ADMIN role)
- `GET /api/admin/users` — List all users
- `GET /api/admin/services` — List all VPS instances
- `POST /api/admin/locations` — Add server location
- `POST /api/admin/os-versions` — Register OS template

## Database Schema

Key tables:
- **User** — Account info, role (USER/ADMIN)
- **Product** — VPS plans with specs (vCPU, RAM, storage)
- **Service** — Active VPS instances (hostname, status, VMID)
- **Order** — Billing records (subscription, payment history)
- **IpAddress** — IP allocation pool per location
- **Location** — Proxmox nodes/regions
- **OsVersion** — Available operating systems

View the full schema in `prisma/schema.prisma`.

## Key Services

### `proxmox.service.js`
Configures Axios client for Proxmox API calls. Handles token auth and self-signed SSL cert bypass (dev only).

### `stripe.service.js`
Stripe client initialization. Used by billing controller to create charges and manage subscriptions.

### `email.service.js`
Nodemailer wrapper with pre-built templates for password resets, server provisioning, payment receipts, and suspension notices.

### `vps.service.js`
Orchestrates the full VPS lifecycle: allocate IP, clone template, configure Cloud-Init, start VM, and rollback on failure.

### `token.service.js`
JWT generation and verification. Tokens expire in 24 hours by default.

## Common Tasks

### Add a new API endpoint

1. Create route in `src/api/yourfeature.routes.js`
2. Add controller logic in `src/controllers/yourfeature.controller.js`
3. Add business logic in `src/services/yourfeature.service.js` (if complex)
4. Mount route in `src/api/index.js`

### Update the database schema

1. Edit `prisma/schema.prisma`
2. Run: `npx prisma migrate dev --name describe_your_change`
3. Commit the migration file

### Add a scheduled task

Create a new cron file in `src/cron/` and register it in `src/app.js`:

```javascript
import { initMyCronJob } from './cron/myfeature.cron.js';
initCronJobs();
```

### Debug Proxmox calls

Enable debug logging in the Proxmox service or check the actual VM status in the Proxmox web UI (usually `https://your-host:8006`).

## Troubleshooting

### "Connection refused" on database startup
- Ensure MySQL is running: `mysql -u root -p`
- Check `DATABASE_URL` in `.env` matches your MySQL host, port, and credentials

### "Proxmox API token invalid"
- Verify token ID format: should be `user@realm!tokenname`
- Check token hasn't expired in Proxmox web UI
- Ensure `PVE_TOKEN_SECRET` is exact (no extra spaces)

### "STRIPE_WEBHOOK_SECRET is invalid"
- Stripe webhooks must match the endpoint URL in your Stripe Dashboard
- Test locally with Stripe CLI: `stripe listen --forward-to localhost:3001/api/billing/webhook`

### Email not sending
- Test SMTP credentials with a mail client (e.g., Thunderbird)
- Check logs for nodemailer errors
- Ensure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` are correct

## Environment Variables Checklist

- [ ] `NODE_ENV` (development or production)
- [ ] `PORT` (default 3001)
- [ ] `JWT_SECRET` (strong random string, min 32 chars)
- [ ] `DATABASE_URL` (MySQL connection string)
- [ ] `PVE_HOST`, `PVE_TOKEN_ID`, `PVE_TOKEN_SECRET`
- [ ] `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

## Production Checklist

Before deploying:

- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique `JWT_SECRET`
- [ ] Enable HTTPS / SSL certificates
- [ ] Replace Proxmox SSL bypass with proper CA verification
- [ ] Store secrets in a vault (e.g., AWS Secrets Manager)
- [ ] Set up monitoring and error logging (e.g., Sentry)
- [ ] Configure CORS to allow only your frontend domain
- [ ] Test Stripe webhooks in production mode
- [ ] Set up database backups and replication
- [ ] Use a process manager (PM2, Docker, systemd)

## License

Internal project. Do not distribute.
