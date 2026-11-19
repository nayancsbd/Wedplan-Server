# WedPlan Server

Backend API server for WedPlan, a role-based wedding planning platform.

## Tech Stack
- Express.js + TypeScript (ESM)
- MongoDB (Native Node Driver)
- Better Auth
- Stripe Checkout
- Zod validation
- Helmet, Morgan, CORS

## Getting Started

### Prerequisites
- Node.js (>= 20)
- MongoDB instance

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

### Development
Start the development server with live reload:
```bash
npm run dev
```

### Build & Production
Build TypeScript to JavaScript:
```bash
npm run build
```

Run production server:
```bash
npm run start
```
