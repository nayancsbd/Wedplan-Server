# WedPlan Server (API Backend)

Backend API server for **WedPlan**, an elegant, role-based wedding planning platform connecting couples (customers) with wedding professionals (vendors) under platform administration.

- **Client Repository**: [wedplan-client](https://github.com/nayancsbd/wedplan-client)
- **Server Repository**: [wedplan-server](https://github.com/nayancsbd/wedplan-server)
- **Live API Endpoint**: `https://api.wedplan.com` (or your deployed host URL)
- **Live Web Application**: `https://wedplan.com`

---

## Features

### Role-Based Access Control (RBAC)
- Strict server-side verification on all protected endpoints (`customer`, `vendor`, `admin`).
- Role elevation protection: sign-up restricts self-assigned roles to `customer` or `vendor`; `admin` can only be created via the idempotent database seed script.

### Authentication & Sessions (Better Auth)
- Email + password authentication with server-enforced complexity (minimum 6 characters, uppercase + lowercase requirement).
- Google OAuth 2.0 social sign-in.
- EdDSA (Ed25519) JSON Web Token (JWT) issuance with remote JWKS verification via `jose`.
- Automatic production cross-origin cookie security (`secure: true`, `sameSite: 'none'`, and `trust proxy: 1`).

### Vendor Service Management
- Multi-image service listings (1 to 5 images) across 6 categories (Photography, Venues, Florist, Catering, Makeup, Fashion).
- Moderation workflow (`pending` -> `approved` / `rejected`).
- Free-plan business logic enforcement: non-premium vendors are restricted to a maximum of 3 active services. Upgrading to Premium unlocks unlimited active services.
- Availability toggles with immediate quota re-validation.
- Safe deletion guards: services with active pending or accepted bookings cannot be deleted.

### Customer Bookings
- Booking creation with future-date validation.
- Concurrency and duplicate-booking protection: unique partial database index on `(customerId, serviceId, eventDate)` for active states (`pending`, `accepted`).
- Self-booking prevention (vendors cannot book their own services).
- Atomic customer cancellation for pending requests.

### Vendor Booking Management
- Vendor dashboard of booking requests filtered by status with populated customer details (`name`, `email`, `image`).
- Atomic status updates (`accepted` / `rejected`) preventing race conditions; processed requests cannot be modified again.

### Stripe Subscription & Billing
- Automated Stripe Checkout integration in `subscription` mode.
- Stripe customer creation and reuse stored on the user document.
- Secure Stripe Webhook handler (`POST /api/webhooks/stripe`) parsing raw binary payloads before JSON body parsers with HMAC signature verification.
- Webhook events handled:
  - `checkout.session.completed`: activates Premium, stores period end expiry, and records paid transaction.
  - `invoice.paid`: extends subscription expiry on recurring renewals (idempotent).
  - `invoice.payment_failed`: records failed payment audit record.
  - `customer.subscription.deleted` & `updated`: downgrades plan to `free` when period ends without deleting existing vendor services.
  - `checkout.session.expired`: logs expired checkout attempts.
- Idempotent transaction recording with unique partial database indexes on `stripeSessionId` and `stripeEventId`.

### Admin Dashboard
- System overview metrics: total users, vendors, customers, services, pending review count, and transactions.
- User management with search, role filters, pagination, and safe block/unblock capabilities (admins cannot block themselves or fellow admins).
- Service moderation: approve, reject, or delete listings.
- Immutable transaction audit log (read-only, no create/update/delete endpoints).

### Media Upload
- In-memory Multer processing with 5 MB cap and image MIME-type validation.
- Server-side ImgBB upload proxy keeping the API key secret.
- Public rate-limited avatar upload endpoint for registration flows.

### Production Security & Hardening
- **Helmet**: secure HTTP response headers.
- **CORS**: restricted strictly to `CLIENT_URL` with credentials allowed.
- **Express Rate Limit**: dedicated auth limiter (100 req/15 min) and write limiter (150 req/15 min) skipping read operations and Stripe webhooks.
- **Body Size Caps**: strict `1mb` limit on JSON and form data; `2mb` on raw webhook payloads.
- **ReDoS Protection**: regex search sanitization utility escaping special regex characters.
- **Production Error Masking**: unhandled 500 errors never leak stack traces or internal database details in production.

---

## Tech Stack

- **Runtime**: Node.js (>= 20)
- **Framework**: Express.js (v5) + TypeScript (ESM)
- **Database**: MongoDB (Native Driver v7)
- **Authentication**: Better Auth (MongoDB adapter + JWT plugin) + `jose`
- **Payments**: Stripe Node SDK (Checkout Sessions + Webhooks)
- **Validation**: Zod
- **Media**: Multer (Memory Storage) + ImgBB API
- **Security**: Helmet, CORS, Express-Rate-Limit

---

## Environment Variables

All secrets are loaded and validated at startup using Zod (`src/config/env.ts`).

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | No | Port for the HTTP server to listen on (defaults to 5000; use 5001 if port 5000 is occupied by macOS AirPlay). | `5001` |
| `NODE_ENV` | Yes | Environment mode (`development`, `production`, `test`). | `production` |
| `MONGODB_URI` | Yes | MongoDB Atlas or local connection string. | `mongodb+srv://...` |
| `DB_NAME` | Yes | MongoDB database name. | `wedplan_prod` |
| `BETTER_AUTH_SECRET` | Yes | Random cryptographic secret (min 32 characters) for Better Auth. | `your_secret_32_characters_minimum` |
| `BETTER_AUTH_URL` | Yes | Base URL where this backend server is accessible. | `https://api.wedplan.com` |
| `CLIENT_URL` | Yes | Allowed frontend client URL for CORS and redirects. | `https://wedplan.com` |
| `GOOGLE_CLIENT_ID` | Yes | Google Cloud Console OAuth 2.0 Client ID. | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | Google Cloud Console OAuth 2.0 Client Secret. | `GOCSPX-xxx` |
| `STRIPE_SECRET_KEY` | Yes | Stripe Secret Key (`sk_test_...` or `sk_live_...`). | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe Webhook Signing Secret (`whsec_...`). | `whsec_...` |
| `STRIPE_PREMIUM_PRICE_ID` | Yes | Stripe Recurring Price ID for the Vendor Premium plan. | `price_xxx` |
| `IMGBB_API_KEY` | Yes | ImgBB API key for server-side image upload proxy. | `your_imgbb_key` |

---

## Local Development

### 1. Prerequisites
- Node.js (v20 or higher)
- Running MongoDB instance (local or MongoDB Atlas)
- Stripe CLI (for webhook testing)

### 2. Clone & Install
```bash
git clone https://github.com/nayancsbd/wedplan-server.git
cd wedplan-server
npm install
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
# Fill in your MongoDB connection string, Stripe keys, and Better Auth secrets
```

### 4. Seed the Database
Create the platform admin account idempotently:
```bash
npm run seed:admin
```

### 5. Start Development Server
```bash
npm run dev
```
The server will start with hot-reload at `http://localhost:5001`.

### 6. Test Stripe Webhooks Locally
In a separate terminal, forward Stripe events to your local server:
```bash
stripe listen --forward-to localhost:5001/api/webhooks/stripe
```
Copy the webhook signing secret printed by the CLI (`whsec_...`) into your `.env` as `STRIPE_WEBHOOK_SECRET`.

---

## Production Deployment

### Option A: Render / Railway (Recommended Long-Running Process)

The server is preconfigured for continuous deployment on platforms like Render or Railway.

1. **Build Command**: `npm run build`
2. **Start Command**: `npm run start` (or automatically via `Procfile` / `render.yaml`)
3. **Environment Variables**: Add all variables from the table above in your host's dashboard.
4. **Proxy Trust**: Express has `app.set('trust proxy', 1)` enabled, ensuring secure cookies and client IP resolution work properly behind Render/Railway reverse proxies.

### Option B: Vercel (Serverless Function)

The repository includes [`vercel.json`](./vercel.json) and [`api/index.js`](./api/index.js) exporting the Express app for Vercel Serverless.

1. Set the root directory or link the repository to Vercel.
2. Add all environment variables in the Vercel Project Settings.
3. Set `BETTER_AUTH_URL` to your production Vercel domain (e.g. ``).
4. Set `CLIENT_URL` to your frontend production domain (e.g. ``).

---

## Stripe Webhook Registration

To enable live subscription activation and billing updates in production:

1. Navigate to the **Stripe Dashboard** -> **Developers** -> **Webhooks**.
2. Click **Add endpoint**.
3. **Endpoint URL**:
   ```
   https://<YOUR_API_DOMAIN>/api/webhooks/stripe
   ```
4. **Events to listen for**:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `checkout.session.expired`
5. Reveal the **Signing secret** (`whsec_...`) and assign it to the `STRIPE_WEBHOOK_SECRET` environment variable in your production hosting platform.

---

## Production Deployment Checklist

- [ ] MongoDB Atlas Network Access: Whitelist `0.0.0.0/0` or the static egress IPs of your hosting provider.
- [ ] Set `NODE_ENV=production` in the hosting dashboard.
- [ ] Set `CLIENT_URL` to your exact frontend domain (without trailing slash, e.g. `https://wedplan.com`).
- [ ] Set `BETTER_AUTH_URL` to your exact backend domain (e.g. `https://api.wedplan.com`).
- [ ] Ensure `STRIPE_SECRET_KEY` uses your live key (`sk_live_...`) and `STRIPE_PREMIUM_PRICE_ID` matches your live recurring subscription product.
- [ ] Register `https://<YOUR_API_DOMAIN>/api/webhooks/stripe` in Stripe and copy the live `whsec_...` to `STRIPE_WEBHOOK_SECRET`.
- [ ] Run `npm run seed:admin` once against the production database to create the admin account.
- [ ] Verify `GET /api/health` returns HTTP 200 with `environment: "production"`.
- [ ] Verify test login and cookies over HTTPS: inspect response headers for `Set-Cookie: ... SameSite=None; Secure; HttpOnly`.

---

## API Testing Guide

For a complete reference of test curl commands covering authentication (401), role access (403), ownership verification, duplicate booking prevention (409), free-plan limits (403), and webhook idempotency, consult [`docs/api-tests.md`](./docs/api-tests.md).
