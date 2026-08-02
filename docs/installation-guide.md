# SupportDesk Enterprise v1.0 — Installation Guide

This guide provides step-by-step instructions for installing and initializing SupportDesk Enterprise v1.0 in local, containerized, or bare-metal enterprise environments.

---

## 1. System Requirements

### Hardware Requirements

- **CPU**: 4 cores minimum (8 cores recommended for production)
- **RAM**: 8 GB RAM minimum (16 GB recommended)
- **Disk**: 50 GB SSD storage minimum

### Software Prerequisites

- **Node.js**: `v20.x` LTS or higher
- **pnpm**: `v9.x` package manager (`corepack enable pnpm`)
- **PostgreSQL**: `v16.x` or higher
- **Redis**: `v7.x` or higher
- **Docker & Docker Compose**: (Optional, for containerized installation)

---

## 2. Environment Configuration

1. Clone the repository and navigate to the project root:

   ```bash
   git clone https://github.com/enterprise/supportdesk.git
   cd supportdesk
   ```

2. Copy the sample environment file and configure variables:

   ```bash
   cp .env.example .env
   ```

3. Configure required parameters in `.env`:
   ```ini
   # Server Configuration
   PORT=3000
   NODE_ENV=production
   APP_URL=https://supportdesk.example.com

   # Database Configuration
   DATABASE_URL="postgresql://supportdesk:securepassword@localhost:5432/supportdesk?schema=public"

   # Security & JWT Tokens
   JWT_SECRET="your-256-bit-production-jwt-secret-key"
   SESSION_SECRET="your-256-bit-production-session-secret"

   # Redis Cache & Outbox Event Bus
   REDIS_URL="redis://localhost:6379"

   # Storage Provider (LOCAL | S3)
   STORAGE_PROVIDER=LOCAL
   STORAGE_LOCAL_PATH="./uploads"
   ```

---

## 3. Local / Manual Installation

1. Install project dependencies using pnpm:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Generate Prisma Client bindings:

   ```bash
   pnpm run prisma:generate
   ```

3. Deploy database migrations to PostgreSQL:

   ```bash
   cd apps/api
   pnpm exec prisma migrate deploy
   ```

4. Build production bundles for API backend and Web frontend:

   ```bash
   pnpm run build
   ```

5. Start the production API and Web services:
   ```bash
   # Start API server
   cd apps/api && pnpm run start

   # In a separate terminal, start Web client
   cd apps/web && pnpm run start
   ```

---

## 4. Docker Compose Installation

For automated containerized deployment, run:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

This starts PostgreSQL 16, Redis 7, the NestJS API application, and the Next.js Web frontend behind Nginx.

---

## 5. Post-Installation Verification

1. **API Health Check**: Access `http://localhost:3000/api/v1/health` (Expect `{ "status": "ok" }`).
2. **Web Portal**: Access `http://localhost:3001` in a browser.
3. **Database Seed**: Run the initial tenant and system administrator setup wizard or command:
   ```bash
   cd apps/api && pnpm exec ts-node src/database/seed.ts
   ```

---

## Next Steps

- Refer to the [Deployment Guide](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/deployment-guide.md) for production TLS and proxy configuration.
- Refer to the [Administrator Manual](file:///Users/mayurkulkarni/Downloads/SupportDesk/docs/administrator-manual.md) to set up custom roles, SLA policies, and teams.
