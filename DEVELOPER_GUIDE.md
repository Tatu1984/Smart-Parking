# SParking - Developer Guide

## AI-Powered Smart Parking Management System

This comprehensive guide helps developers understand, modify, and extend the SParking parking management system.

**Version:** 2.0
**Last Updated:** January 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Getting Started](#4-getting-started)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema](#6-database-schema)
7. [API Reference](#7-api-reference)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [AI Pipeline](#10-ai-pipeline)
11. [Hardware Integration](#11-hardware-integration)
12. [Payment System](#12-payment-system)
13. [Camera System](#13-camera-system)
14. [Notification System](#14-notification-system)
15. [Caching & Rate Limiting](#15-caching--rate-limiting)
16. [Real-time Features](#16-real-time-features)
17. [Testing](#17-testing)
18. [Deployment](#18-deployment)
19. [Common Tasks](#19-common-tasks)
20. [Error Handling](#20-error-handling)
21. [Security Best Practices](#21-security-best-practices)
22. [Troubleshooting](#22-troubleshooting)
23. [Contributing](#23-contributing)

---

## 1. Project Overview

SParking is a comprehensive AI-powered parking management system designed for facilities ranging from small parking lots to large multi-level commercial parking structures.

### Key Features

| Feature | Description |
|---------|-------------|
| Vehicle Detection | YOLOv8-based detection with <100ms latency |
| ANPR | Automatic License Plate Recognition using Intel OpenVINO |
| Payment Gateway | Stripe/Razorpay integration + digital wallet system |
| Hardware Control | Gates, LED displays, ticket printers |
| Analytics | Predictive occupancy, revenue reports, traffic patterns |
| Multi-tenant | Support for multiple parking lots and organizations |
| Real-time | WebSocket updates for live monitoring |
| Offline Support | Offline queue with automatic sync |
| Multi-currency | INR, USD, EUR, GBP support |

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser                               │
│                    (Next.js Frontend)                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    Next.js API Routes                            │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │
│  │  Auth    │ Parking  │ Payment  │ Hardware │ Analytics │      │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                     PostgreSQL (Prisma)                          │
└─────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   External Services                              │
│  ┌──────────┬──────────┬──────────┬──────────┐                  │
│  │ Stripe   │  Email   │   SMS    │ AI Pipeline                 │
│  └──────────┴──────────┴──────────┴──────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.x | UI library |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | Latest | UI component library |
| Recharts | 2.x | Charts and visualizations |
| Lucide React | Latest | Icons |
| Socket.io-client | 4.x | Real-time updates |
| React Hook Form | 7.x | Form handling |
| Zod | 3.x | Schema validation |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Next.js API Routes | 16.x | REST API |
| Prisma | 7.x | ORM |
| PostgreSQL | 14+ | Database |
| JSON Web Tokens | - | Authentication |
| bcryptjs | - | Password hashing |
| Nodemailer | - | Email sending |

### AI Pipeline
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.8+ | Runtime |
| YOLOv8 | Latest | Vehicle detection |
| OpenVINO | Latest | ANPR optimization |
| OpenCV | 4.x | Video processing |
| FFmpeg | 5.x | Stream handling |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Vercel | Web hosting |
| Neon | Serverless PostgreSQL |
| Docker | AI Pipeline containerization |

---

## 3. Project Structure

```
sparking/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes (50+ endpoints)
│   │   │   ├── alerts/               # Alert management
│   │   │   ├── analytics/            # Analytics & predictive
│   │   │   ├── auth/                 # Authentication
│   │   │   │   ├── login/
│   │   │   │   ├── logout/
│   │   │   │   └── me/
│   │   │   ├── bank-accounts/        # Bank account management
│   │   │   ├── cameras/              # Camera CRUD + streaming
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── snapshot/
│   │   │   │   │   └── stream/
│   │   │   ├── displays/             # LED display control
│   │   │   ├── find-car/             # Vehicle search
│   │   │   ├── gates/                # Gate control
│   │   │   ├── graphql/              # GraphQL-like endpoint
│   │   │   ├── metrics/              # System metrics
│   │   │   ├── notifications/        # Notification management
│   │   │   ├── parking-lots/         # Parking lot CRUD
│   │   │   ├── payments/             # Payment processing
│   │   │   │   ├── deposit/
│   │   │   │   ├── parking/
│   │   │   │   ├── request/
│   │   │   │   ├── transfer/
│   │   │   │   ├── verify/
│   │   │   │   ├── webhook/
│   │   │   │   └── withdraw/
│   │   │   ├── realtime/             # Real-time detection
│   │   │   ├── reports/              # Report generation
│   │   │   ├── sandbox/              # Test/sandbox payments
│   │   │   ├── settings/             # System settings
│   │   │   ├── slots/                # Slot management
│   │   │   ├── sync/                 # Offline sync
│   │   │   ├── tokens/               # Parking tokens
│   │   │   ├── users/                # User management
│   │   │   ├── vehicles/             # Vehicle registry
│   │   │   ├── wallet/               # Digital wallet
│   │   │   ├── webhooks/             # Webhook configuration
│   │   │   └── zones/                # Zone management
│   │   ├── dashboard/                # Admin dashboard pages
│   │   │   ├── analytics/
│   │   │   ├── cameras/
│   │   │   ├── live/
│   │   │   ├── parking-lots/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   │   └── users/
│   │   │   ├── slots/
│   │   │   ├── tokens/
│   │   │   ├── transactions/
│   │   │   ├── vehicles/
│   │   │   ├── wallet/
│   │   │   │   ├── bank-accounts/
│   │   │   │   ├── request/
│   │   │   │   ├── transactions/
│   │   │   │   └── transfer/
│   │   │   ├── zones/
│   │   │   ├── error.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── pay/[ref]/                # Payment page (public)
│   │   ├── error.tsx                 # Global error boundary
│   │   ├── global-error.tsx          # Root error boundary
│   │   ├── not-found.tsx             # 404 page
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Landing page
│   │
│   ├── components/                   # React components
│   │   ├── analytics/                # Analytics charts
│   │   ├── camera/                   # Camera stream components
│   │   │   └── CameraStream.tsx
│   │   ├── dashboard/                # Dashboard layout
│   │   │   ├── header.tsx
│   │   │   └── sidebar-nav.tsx
│   │   ├── parking/                  # Parking-related UI
│   │   ├── settings/                 # Settings components
│   │   ├── signage/                  # Digital signage
│   │   └── ui/                       # shadcn/ui components
│   │       ├── alert-dialog.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── card-skeleton.tsx
│   │       ├── confirm-dialog.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── empty-state.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── skeleton.tsx
│   │       ├── stats-skeleton.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── table-skeleton.tsx
│   │       ├── tabs.tsx
│   │       └── ...
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-analytics-data.ts
│   │   ├── use-dashboard-data.ts
│   │   └── ...
│   │
│   ├── lib/                          # Utility libraries
│   │   ├── auth/                     # Authentication
│   │   │   ├── jwt.ts
│   │   │   └── session.ts
│   │   ├── cache/                    # Caching utilities
│   │   │   └── index.ts
│   │   ├── config/                   # Configuration
│   │   │   └── env.ts
│   │   ├── crypto/                   # Encryption utilities
│   │   │   └── encryption.ts
│   │   ├── hardware/                 # Hardware drivers
│   │   │   └── index.ts
│   │   ├── notifications/            # Notification system
│   │   │   └── index.ts
│   │   ├── rate-limit/               # Rate limiting
│   │   │   └── index.ts
│   │   ├── sync/                     # Offline sync
│   │   │   └── offline-queue.ts
│   │   ├── utils/                    # Helper utilities
│   │   │   ├── api.ts
│   │   │   └── currency.ts
│   │   ├── webhooks/                 # Webhook dispatcher
│   │   │   └── index.ts
│   │   ├── db.ts                     # Prisma client
│   │   └── logger.ts                 # Logging utility
│   │
│   ├── store/                        # State management
│   │   └── ...
│   │
│   └── __tests__/                    # Test files
│       ├── lib/
│       │   ├── jwt.test.ts
│       │   └── validators.test.ts
│       ├── utils/
│       │   └── currency.test.ts
│       └── setup.ts
│
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── migrations/                   # Database migrations
│
├── ai-pipeline/                      # Python AI service
│   └── src/
│       ├── pipeline.py
│       ├── camera.py
│       ├── detector.py
│       ├── anpr.py
│       └── optimization.py
│
├── public/                           # Static assets
├── .env.example                      # Environment template
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
├── vitest.config.ts                  # Test configuration
└── vercel.json                       # Vercel deployment config
```

---

## 4. Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 14+ (or Neon account)
- Python 3.8+ (for AI pipeline)
- FFmpeg 5+ (for camera streaming)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/sparking.git
cd sparking

# Install Node.js dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Generate Prisma client
npx prisma generate

# Push database schema (development)
npx prisma db push

# Or run migrations (production)
npx prisma migrate deploy

# Start development server
npm run dev
```

### Verify Installation

1. Open http://localhost:3000
2. Check API health: http://localhost:3000/api/health
3. Access dashboard: http://localhost:3000/dashboard

---

## 5. Environment Variables

### Required Variables

```env
# ===========================================
# REQUIRED - Application Core
# ===========================================

# Environment
NODE_ENV=development

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=SParking

# Database (PostgreSQL)
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgresql://postgres:password@localhost:5432/sparking?schema=public"

# Authentication (minimum 32 characters)
# Generate with: openssl rand -base64 32
JWT_SECRET="your-super-secure-jwt-secret-minimum-32-characters"

# AI Pipeline Detection API Key
# Generate with: openssl rand -hex 32
DETECTION_API_KEY="your-detection-api-key"
```

### Optional Variables

```env
# ===========================================
# OPTIONAL - Features
# ===========================================

# WebSocket
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Session Management
MAX_SESSIONS_PER_USER=5

# CORS Configuration (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# ===========================================
# OPTIONAL - Email
# ===========================================

# Provider: console (default), resend, sendgrid, smtp
EMAIL_PROVIDER=console
EMAIL_FROM=Sparking <noreply@sparking.app>

# SMTP (if EMAIL_PROVIDER=smtp)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-smtp-password

# Resend (if EMAIL_PROVIDER=resend)
RESEND_API_KEY=your-resend-api-key

# SendGrid (if EMAIL_PROVIDER=sendgrid)
SENDGRID_API_KEY=your-sendgrid-api-key

# ===========================================
# OPTIONAL - SMS
# ===========================================

# Provider: twilio, msg91
SMS_PROVIDER=twilio

# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# MSG91 (India)
MSG91_AUTH_KEY=your-msg91-auth-key
MSG91_SENDER_ID=SPARKN
MSG91_TEMPLATE_ID=your-template-id

# ===========================================
# OPTIONAL - Payment Gateway
# ===========================================

# Razorpay
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ===========================================
# OPTIONAL - File Storage
# ===========================================

# Provider: local, s3
STORAGE_PROVIDER=local

# AWS S3 (if STORAGE_PROVIDER=s3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=sparking-uploads

# ===========================================
# OPTIONAL - AI Pipeline
# ===========================================

AI_PIPELINE_ENABLED=true
AI_PIPELINE_DEVICE=CPU
AI_PIPELINE_CONFIDENCE_THRESHOLD=0.5

# MQTT (for AI pipeline communication)
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_TOPIC_PREFIX=sparking/detection

# ===========================================
# OPTIONAL - Rate Limiting
# ===========================================

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# ===========================================
# OPTIONAL - Security
# ===========================================

# Encryption key for sensitive data
# Generate with: openssl rand -base64 32
ENCRYPTION_KEY=your-encryption-key-min-32-chars

# Cron job secret
CRON_SECRET=your-cron-secret

# ===========================================
# OPTIONAL - Logging
# ===========================================

LOG_LEVEL=info
LOG_FORMAT=json
```

---

## 6. Database Schema

### Core Models Overview

```
Organization
├── OrganizationSettings
├── Users
├── Wallets
└── ParkingLots
    ├── Zones
    │   └── Slots
    ├── Cameras
    ├── Gates
    ├── Displays
    └── Tokens
        └── Transactions
```

### Key Models

#### Organization
```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  logo      String?

  settings    OrganizationSettings?
  users       User[]
  parkingLots ParkingLot[]
  wallets     Wallet[]
}
```

#### ParkingLot
```prisma
model ParkingLot {
  id           String           @id @default(cuid())
  name         String
  slug         String           @unique
  address      String?
  city         String?
  state        String?
  country      String           @default("India")
  timezone     String           @default("Asia/Kolkata")
  currency     String           @default("INR")
  totalSlots   Int              @default(0)
  venueType    VenueType        @default(MALL)
  status       ParkingLotStatus @default(ACTIVE)
  hasEvCharging   Boolean       @default(false)
  hasValetService Boolean       @default(false)
  operatingHours  Json?

  zones        Zone[]
  cameras      Camera[]
  gates        Gate[]
  displays     Display[]
  tokens       Token[]
}
```

#### Token (Parking Session)
```prisma
model Token {
  id             String      @id @default(cuid())
  tokenNumber    String      @unique
  licensePlate   String?
  vehicleType    VehicleType?
  entryTime      DateTime    @default(now())
  exitTime       DateTime?
  status         TokenStatus @default(ACTIVE)
  entryType      EntryType   @default(QR)

  parkingLotId   String
  parkingLot     ParkingLot  @relation(fields: [parkingLotId])
  allocatedSlotId String?
  allocatedSlot  Slot?       @relation(fields: [allocatedSlotId])
  vehicleId      String?
  vehicle        Vehicle?    @relation(fields: [vehicleId])

  transactions   Transaction[]
}
```

#### Slot
```prisma
model Slot {
  id          String     @id @default(cuid())
  slotNumber  String
  slotType    SlotType   @default(STANDARD)
  vehicleType VehicleType @default(CAR)
  status      SlotStatus @default(AVAILABLE)
  hasEvCharger Boolean   @default(false)
  isAccessible Boolean   @default(false)

  zoneId      String
  zone        Zone       @relation(fields: [zoneId])
  cameraId    String?
  camera      Camera?    @relation(fields: [cameraId])

  tokens      Token[]
}
```

### Enums

```prisma
enum ParkingLotStatus {
  ACTIVE
  MAINTENANCE
  CLOSED
}

enum TokenStatus {
  ACTIVE
  COMPLETED
  EXPIRED
  LOST
  CANCELLED
}

enum SlotStatus {
  AVAILABLE
  OCCUPIED
  RESERVED
  MAINTENANCE
  BLOCKED
}

enum VehicleType {
  CAR
  SUV
  MOTORCYCLE
  BUS
  TRUCK
  VAN
}

enum ZoneType {
  GENERAL
  VIP
  EV_CHARGING
  DISABLED
  STAFF
  VISITOR
  SHORT_TERM
  LONG_TERM
  TWO_WHEELER
  VALET
  RESERVED
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum PaymentMethod {
  CASH
  UPI
  CARD
  WALLET
  BANK_TRANSFER
}
```

### Database Commands

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (WARNING: destroys data)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Seed database
npx prisma db seed
```

---

## 7. API Reference

### Authentication

All protected endpoints require JWT token:

```bash
# Login
POST /api/auth/login
Content-Type: application/json
{
  "email": "user@example.com",
  "password": "password123"
}

# Response
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "ADMIN"
    }
  }
}

# Use token in subsequent requests
Authorization: Bearer <token>
```

### Complete API Endpoint Reference

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |

#### Parking Lots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/parking-lots` | List parking lots |
| POST | `/api/parking-lots` | Create parking lot |
| GET | `/api/parking-lots/:id` | Get parking lot |
| PATCH | `/api/parking-lots/:id` | Update parking lot |
| DELETE | `/api/parking-lots/:id` | Delete parking lot |
| GET | `/api/parking-lots/:id/status` | Get lot status |
| GET | `/api/parking-lots/:id/stats` | Get lot statistics |

#### Zones
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/zones` | List zones |
| POST | `/api/zones` | Create zone |
| GET | `/api/zones/:id` | Get zone |
| PATCH | `/api/zones/:id` | Update zone |
| DELETE | `/api/zones/:id` | Delete zone |

#### Slots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/slots` | List slots (with filters) |
| POST | `/api/slots` | Create slots (bulk) |
| GET | `/api/slots/:id` | Get slot |
| PATCH | `/api/slots/:id` | Update slot |
| DELETE | `/api/slots/:id` | Delete slot |

#### Cameras
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cameras` | List cameras |
| POST | `/api/cameras` | Add camera |
| GET | `/api/cameras/:id` | Get camera |
| PATCH | `/api/cameras/:id` | Update camera |
| DELETE | `/api/cameras/:id` | Delete camera |
| GET | `/api/cameras/:id/stream` | MJPEG live stream |
| GET | `/api/cameras/:id/snapshot` | Capture snapshot |

#### Gates
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gates` | List gates |
| POST | `/api/gates` | Add gate |
| GET | `/api/gates/:id` | Get gate |
| PATCH | `/api/gates/:id` | Update gate |
| DELETE | `/api/gates/:id` | Delete gate |
| POST | `/api/gates/:id/open` | Open gate |
| POST | `/api/gates/:id/close` | Close gate |

#### Tokens
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tokens` | List tokens |
| POST | `/api/tokens` | Create token (entry) |
| GET | `/api/tokens/:id` | Get token |
| PATCH | `/api/tokens/:id` | Update token |
| POST | `/api/tokens/:id/exit` | Process exit |

#### Vehicles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vehicles` | List vehicles |
| POST | `/api/vehicles` | Register vehicle |
| GET | `/api/vehicles/:id` | Get vehicle |
| PATCH | `/api/vehicles/:id` | Update vehicle |
| DELETE | `/api/vehicles/:id` | Delete vehicle |
| GET | `/api/find-car` | Search vehicle |

#### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments` | List payments |
| POST | `/api/payments` | Create payment |
| POST | `/api/payments/parking` | Pay for parking |
| POST | `/api/payments/deposit` | Add money to wallet |
| POST | `/api/payments/withdraw` | Withdraw to bank |
| POST | `/api/payments/transfer` | Wallet transfer |
| POST | `/api/payments/verify` | Verify payment |
| POST | `/api/payments/webhook` | Payment webhook |
| GET | `/api/payments/request` | List payment requests |
| POST | `/api/payments/request` | Create payment request |
| GET | `/api/payments/request/:id` | Get payment request |
| POST | `/api/payments/request/:id/pay` | Pay request |

#### Wallet
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet` | List wallets |
| POST | `/api/wallet` | Create wallet |
| GET | `/api/wallet/:id` | Get wallet |
| PATCH | `/api/wallet/:id` | Update wallet |
| GET | `/api/wallet/:id/balance` | Get balance |
| GET | `/api/wallet/:id/transactions` | Get transactions |

#### Bank Accounts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bank-accounts` | List accounts |
| POST | `/api/bank-accounts` | Add account |
| GET | `/api/bank-accounts/:id` | Get account |
| PATCH | `/api/bank-accounts/:id` | Update account |
| DELETE | `/api/bank-accounts/:id` | Delete account |
| POST | `/api/bank-accounts/:id/verify` | Verify account |

#### Analytics & Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics` | Get analytics |
| GET | `/api/analytics/predictive` | Predictive analytics |
| GET | `/api/reports` | List reports |
| POST | `/api/reports` | Generate report |
| POST | `/api/reports/export` | Export report |

#### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get settings |
| PATCH | `/api/settings` | Update settings |
| GET | `/api/users` | List users |
| POST | `/api/users` | Create user |
| PATCH | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| GET | `/api/alerts` | List alerts |
| POST | `/api/alerts` | Create alert |
| GET | `/api/notifications` | List notifications |
| GET | `/api/metrics` | System metrics |
| GET | `/api/health` | Health check |

#### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Create webhook |
| GET | `/api/webhooks/:id` | Get webhook |
| PATCH | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook |

#### Real-time & Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/realtime/detection` | Detection events |
| POST | `/api/sync` | Offline sync |

#### Displays
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/displays` | List displays |
| POST | `/api/displays` | Add display |
| GET | `/api/displays/:id` | Get display |
| PATCH | `/api/displays/:id` | Update display |
| DELETE | `/api/displays/:id` | Delete display |

#### Sandbox (Testing)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sandbox/payment` | Test payment |
| POST | `/api/sandbox/simulate` | Simulate scenarios |

### Standard Response Format

```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}

// Error Response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}

// Paginated Response
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

---

## 8. Frontend Architecture

### Page Structure

```
/                              # Landing page
/dashboard                     # Main dashboard
/dashboard/live                # Live monitoring
/dashboard/parking-lots        # Parking lot management
/dashboard/zones               # Zone management
/dashboard/slots               # Slot management
/dashboard/cameras             # Camera management
/dashboard/tokens              # Token/ticket management
/dashboard/vehicles            # Vehicle registry
/dashboard/transactions        # Transaction history
/dashboard/wallet              # Digital wallet
/dashboard/wallet/bank-accounts# Bank accounts
/dashboard/wallet/transfer     # Money transfers
/dashboard/wallet/request      # Payment requests
/dashboard/wallet/transactions # Wallet transactions
/dashboard/analytics           # Analytics dashboard
/dashboard/reports             # Reports
/dashboard/settings            # Settings
/dashboard/settings/users      # User management
/pay/:ref                      # Payment page (public)
```

### Component Patterns

#### Using shadcn/ui Components
```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Enter name" />
        </div>
        <Button>Submit</Button>
      </CardContent>
    </Card>
  )
}
```

#### Data Fetching Pattern
```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface DataItem {
  id: string
  name: string
}

export default function DataPage() {
  const [data, setData] = useState<DataItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/resource')
      if (!response.ok) throw new Error('Failed to fetch')
      const json = await response.json()
      setData(json.data || [])
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return <TableSkeleton />
  }

  return (
    <div>
      {/* Render data */}
    </div>
  )
}
```

#### Using Custom Hooks
```tsx
// src/hooks/use-dashboard-data.ts
import { useState, useEffect, useCallback } from 'react'

export function useDashboardData() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/stats')
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { stats, loading, error, refresh }
}
```

#### Skeleton Loading States
```tsx
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { StatsSkeleton } from '@/components/ui/stats-skeleton'
import { CardSkeleton } from '@/components/ui/card-skeleton'

// In your component
if (loading) {
  return (
    <div className="space-y-6">
      <StatsSkeleton count={4} />
      <CardSkeleton />
      <TableSkeleton rows={5} columns={4} />
    </div>
  )
}
```

#### Empty States
```tsx
import { EmptyState } from '@/components/ui/empty-state'

if (data.length === 0) {
  return (
    <EmptyState
      title="No vehicles found"
      description="Register your first vehicle to get started"
      actionLabel="Add Vehicle"
      onAction={() => setShowAddDialog(true)}
    />
  )
}
```

### Adding a New Dashboard Page

1. Create the page file:
```tsx
// src/app/dashboard/my-feature/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function MyFeaturePage() {
  const [data, setData] = useState([])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Feature</h1>
          <p className="text-muted-foreground">Manage your features</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add New
        </Button>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>Feature List</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Content here */}
        </CardContent>
      </Card>
    </div>
  )
}
```

2. Add to sidebar navigation in `src/components/dashboard/sidebar-nav.tsx`

---

## 9. Authentication & Authorization

### JWT Token Structure

```typescript
interface JWTPayload {
  userId: string
  email: string
  role: UserRole
  organizationId: string
  iat: number  // Issued at
  exp: number  // Expiration
}
```

### Getting Current User

```typescript
// In API routes
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // User is authenticated
  // user.id, user.email, user.role available
}
```

### Role-Based Access Control

```typescript
// Check role in API route
if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| SUPER_ADMIN | System administrator | Full access |
| ADMIN | Organization admin | All except system settings |
| MANAGER | Operations manager | Operations, reports, no users |
| OPERATOR | Day-to-day operator | Entry/exit, tokens, payments |
| FINANCE | Finance role | Payments, reports |
| VIEWER | Read-only | Dashboard view only |

---

## 10. AI Pipeline

### Overview

The AI pipeline is a Python service that:
1. Captures RTSP video streams from cameras
2. Runs vehicle detection using YOLOv8
3. Performs license plate recognition (ANPR)
4. Publishes detection events to the Next.js API

### Running the Pipeline

```bash
cd ai-pipeline

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run with configuration
python -m src.pipeline --config config.json

# Run with mock cameras (testing)
python -m src.pipeline --mock --log-level DEBUG
```

### Configuration

```json
{
  "cameras": [
    {
      "id": "cam-entry-1",
      "name": "Entry Camera 1",
      "rtsp_url": "rtsp://admin:password@192.168.1.100:554/stream",
      "parking_lot_id": "lot-1",
      "zone_id": "zone-entry",
      "enabled": true
    }
  ],
  "api_endpoint": "http://localhost:3000/api/realtime/detection",
  "api_key": "your-detection-api-key",
  "device": "CPU",
  "confidence_threshold": 0.5,
  "inference_interval": 5,
  "batch_size": 1
}
```

### Detection API Endpoint

```bash
POST /api/realtime/detection
Authorization: Bearer <DETECTION_API_KEY>
Content-Type: application/json

{
  "cameraId": "cam-entry-1",
  "timestamp": "2026-01-31T12:00:00Z",
  "detections": [
    {
      "type": "vehicle",
      "confidence": 0.95,
      "boundingBox": [100, 100, 300, 200],
      "licensePlate": "MH01AB1234",
      "plateConfidence": 0.89,
      "vehicleType": "CAR"
    }
  ],
  "frameId": 12345
}
```

---

## 11. Hardware Integration

### Gate Controller

```typescript
import { HardwareManager, GateProtocol } from '@/lib/hardware'

// Get hardware manager singleton
const manager = HardwareManager.getInstance()

// Initialize hardware for a parking lot
await manager.initialize(parkingLotId)

// Get a specific gate
const gate = manager.getGate('gate-entry-1')

// Control gate
await gate.open(5000)  // Open for 5 seconds
await gate.close()
const status = await gate.getStatus()
```

### Display Controller

```typescript
const display = manager.getDisplay('display-1')

// Show custom message
await display.showMessage('Welcome!')

// Update availability count
await display.updateAvailability(45, 100)

// Show directional arrow
await display.showDirectionalArrow('LEFT', 'Zone A')

// Update all displays with current availability
await manager.updateAllDisplays(parkingLotId)
```

### Supported Protocols

| Protocol | Gate | Display | Printer |
|----------|------|---------|---------|
| HTTP/REST | ✓ | ✓ | ✓ |
| RS485 | ✓ | ✓ | - |
| MQTT | ✓ | ✓ | - |
| Relay/GPIO | ✓ | - | - |
| UDP | - | ✓ | - |
| Serial | - | ✓ | ✓ |
| ESC/POS | - | - | ✓ |

### Ticket Printer

```typescript
import { TicketPrinter } from '@/lib/hardware'

const printer = new TicketPrinter('printer-1', '192.168.1.200:9100', 'NETWORK')

await printer.printTicket({
  tokenNumber: 'TKN-001',
  entryTime: new Date(),
  vehiclePlate: 'MH01AB1234',
  parkingLotName: 'Main Parking',
  qrCodeData: 'https://sparking.app/token/TKN-001',
  instructions: [
    'Keep this ticket safe',
    'Pay before exit'
  ]
})
```

---

## 12. Payment System

### Payment Flow

```
Entry → Token Created → Parking → Exit Request → Fee Calculated → Payment → Token Completed → Gate Opens
```

### Processing Parking Payment

```typescript
// In API route
import prisma from '@/lib/db'

const payment = await prisma.transaction.create({
  data: {
    tokenId: token.id,
    amount: calculatedFee,
    currency: 'INR',
    paymentMethod: 'CASH', // or UPI, CARD, WALLET
    paymentStatus: 'COMPLETED',
    parkingLotId: token.parkingLotId,
  }
})

// Update token status
await prisma.token.update({
  where: { id: token.id },
  data: {
    status: 'COMPLETED',
    exitTime: new Date()
  }
})

// Release slot
await prisma.slot.update({
  where: { id: token.allocatedSlotId },
  data: { status: 'AVAILABLE' }
})
```

### Wallet Operations

```typescript
// Deposit to wallet
await prisma.$transaction([
  prisma.wallet.update({
    where: { id: walletId },
    data: { balance: { increment: amount } }
  }),
  prisma.walletTransaction.create({
    data: {
      walletId,
      type: 'DEPOSIT',
      amount,
      status: 'COMPLETED'
    }
  })
])

// Transfer between wallets
await prisma.$transaction([
  prisma.wallet.update({
    where: { id: fromWalletId },
    data: { balance: { decrement: amount } }
  }),
  prisma.wallet.update({
    where: { id: toWalletId },
    data: { balance: { increment: amount } }
  }),
  prisma.walletTransaction.create({
    data: {
      walletId: fromWalletId,
      type: 'TRANSFER_OUT',
      amount,
      referenceWalletId: toWalletId
    }
  })
])
```

### Fee Calculation

```typescript
function calculateParkingFee(
  entryTime: Date,
  exitTime: Date,
  pricingRule: PricingRule
): number {
  const durationMs = exitTime.getTime() - entryTime.getTime()
  const hours = Math.ceil(durationMs / (1000 * 60 * 60))

  let fee = pricingRule.baseRate

  if (pricingRule.pricingModel === 'HOURLY') {
    fee += hours * pricingRule.hourlyRate
  } else if (pricingRule.pricingModel === 'SLAB') {
    // Apply slab-based pricing
    fee = calculateSlabFee(hours, pricingRule.slabs)
  }

  // Apply daily maximum
  if (pricingRule.dailyMaxRate && fee > pricingRule.dailyMaxRate) {
    fee = pricingRule.dailyMaxRate
  }

  return fee
}
```

---

## 13. Camera System

### Adding a Camera

```bash
POST /api/cameras
{
  "parkingLotId": "lot-1",
  "zoneId": "zone-entry",
  "name": "Entry Camera 1",
  "rtspUrl": "rtsp://admin:password@192.168.1.100:554/stream",
  "onvifUrl": "http://192.168.1.100:80/onvif/device_service",
  "username": "admin",
  "password": "password",
  "position": "Entry gate, facing incoming traffic",
  "coverageSlots": 10,
  "hasInfrared": true,
  "hasPtz": false
}
```

### Camera Stream Component

```tsx
import { CameraStream } from '@/components/camera/CameraStream'

<CameraStream
  cameraId="cam-1"
  cameraName="Entry Camera"
  status="ONLINE"
  autoPlay={true}
  onError={(error) => console.error(error)}
/>
```

### Stream Endpoints

```bash
# MJPEG live stream (browser-compatible)
GET /api/cameras/:id/stream
Content-Type: multipart/x-mixed-replace

# Single snapshot
GET /api/cameras/:id/snapshot
Content-Type: image/jpeg
```

### Requirements
- FFmpeg must be installed on the server
- Camera must be network-accessible from server
- RTSP URL must be correctly formatted

---

## 14. Notification System

### Sending Notifications

```typescript
import { sendNotification } from '@/lib/notifications'

// Send email
await sendNotification({
  channel: 'email',
  to: 'user@example.com',
  subject: 'Parking Receipt',
  template: 'parking-receipt',
  data: {
    tokenNumber: 'TKN-001',
    amount: 150,
    duration: '2 hours'
  }
})

// Send SMS
await sendNotification({
  channel: 'sms',
  to: '+919876543210',
  message: 'Your parking token TKN-001 has been created.'
})

// In-app notification
await sendNotification({
  channel: 'in-app',
  userId: 'user-id',
  title: 'Payment Received',
  body: 'Payment of ₹150 received for parking.'
})
```

### Notification Channels

| Channel | Provider | Configuration |
|---------|----------|---------------|
| Email | Console (dev) | Default, logs to console |
| Email | Resend | RESEND_API_KEY |
| Email | SendGrid | SENDGRID_API_KEY |
| Email | SMTP | SMTP_HOST, SMTP_PORT, etc. |
| SMS | Twilio | TWILIO_* env vars |
| SMS | MSG91 | MSG91_* env vars |
| In-App | Database | Stored in notifications table |
| Webhook | HTTP | Configured per webhook |

---

## 15. Caching & Rate Limiting

### Caching

```typescript
import { cache, getCached, invalidateCache } from '@/lib/cache'

// Cache with TTL
await cache('parking-lot:stats:lot-1', stats, 60) // 60 seconds

// Get cached value
const cached = await getCached('parking-lot:stats:lot-1')

// Invalidate cache
await invalidateCache('parking-lot:stats:lot-1')
await invalidateCache('parking-lot:*') // Pattern invalidation
```

### Rate Limiting

```typescript
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'

  const { success, remaining, reset } = await rateLimit(ip, {
    limit: 100,
    window: 60000 // 1 minute
  })

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString()
        }
      }
    )
  }

  // Process request
}
```

---

## 16. Real-time Features

### WebSocket Integration

```typescript
// Client-side
import { io } from 'socket.io-client'

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL)

socket.on('detection', (data) => {
  console.log('New detection:', data)
})

socket.on('gate-event', (data) => {
  console.log('Gate event:', data)
})

socket.on('balance-update', (data) => {
  console.log('Balance updated:', data)
})
```

### Webhook Dispatching

```typescript
import { dispatchWebhook } from '@/lib/webhooks'

await dispatchWebhook('vehicle.entry', {
  tokenId: token.id,
  licensePlate: token.licensePlate,
  entryTime: token.entryTime,
  parkingLotId: token.parkingLotId
})
```

### Webhook Events

| Event | Trigger |
|-------|---------|
| `vehicle.entry` | Vehicle enters parking |
| `vehicle.exit` | Vehicle exits parking |
| `payment.completed` | Payment successful |
| `payment.failed` | Payment failed |
| `alert.triggered` | Alert condition met |
| `camera.offline` | Camera goes offline |
| `gate.opened` | Gate opened |
| `gate.closed` | Gate closed |

---

## 17. Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/__tests__/lib/jwt.test.ts

# Run in watch mode
npm run test:watch
```

### Test Structure

```
src/__tests__/
├── lib/
│   ├── jwt.test.ts
│   └── validators.test.ts
├── utils/
│   └── currency.test.ts
├── api/
│   └── (API route tests)
└── setup.ts
```

### Writing Tests

```typescript
// src/__tests__/lib/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

describe('MyFunction', () => {
  beforeEach(() => {
    // Setup
  })

  it('should do something', () => {
    const result = myFunction('input')
    expect(result).toBe('expected')
  })

  it('should handle errors', () => {
    expect(() => myFunction(null)).toThrow('Invalid input')
  })
})
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## 18. Deployment

### Vercel Deployment

1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

```bash
# Manual deployment
vercel

# Production deployment
vercel --prod
```

### Environment Variables on Vercel

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Authentication secret
- `DETECTION_API_KEY` - AI pipeline key

### Database Migrations

```bash
# Before deployment, run migrations
npx prisma migrate deploy
```

### Vercel Configuration

```json
// vercel.json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### Docker Deployment (AI Pipeline)

```dockerfile
# ai-pipeline/Dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY config.json .

CMD ["python", "-m", "src.pipeline", "--config", "config.json"]
```

```bash
# Build and run
docker build -t sparking-ai-pipeline ./ai-pipeline
docker run -d --name ai-pipeline sparking-ai-pipeline
```

---

## 19. Common Tasks

### Adding a New API Endpoint

```typescript
// src/app/api/my-feature/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { successResponse, handleApiError } from '@/lib/utils/api'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await prisma.myModel.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createSchema.parse(body)

    const created = await prisma.myModel.create({
      data: {
        ...data,
        organizationId: user.organizationId,
      },
    })

    return successResponse(created, 'Created successfully', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
```

### Adding a New Database Model

1. Update Prisma schema:
```prisma
// prisma/schema.prisma
model MyModel {
  id             String   @id @default(cuid())
  name           String
  description    String?
  organizationId String
  organization   Organization @relation(fields: [organizationId])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId])
}
```

2. Generate and migrate:
```bash
npx prisma generate
npx prisma migrate dev --name add_my_model
```

### Adding a New Dashboard Page

1. Create the page
2. Add to sidebar navigation
3. Create API endpoints if needed
4. Add tests

---

## 20. Error Handling

### API Error Handling

```typescript
import { handleApiError } from '@/lib/utils/api'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // ... your code
  } catch (error) {
    logger.error('Operation failed:', error instanceof Error ? error : undefined)
    return handleApiError(error)
  }
}
```

### Error Response Utility

```typescript
// src/lib/utils/api.ts
export function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation error', details: error.errors },
      { status: 400 }
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Record already exists' },
        { status: 409 }
      )
    }
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
```

### Frontend Error Boundaries

```tsx
// src/app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

---

## 21. Security Best Practices

### Input Validation

Always validate input using Zod:
```typescript
const schema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
  licensePlate: z.string().regex(/^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/),
})
```

### SQL Injection Prevention

Prisma ORM handles parameterized queries automatically. Never use raw SQL with user input.

### XSS Prevention

React automatically escapes content. Never use `dangerouslySetInnerHTML` with user content.

### Authentication

- JWT tokens expire after configured time
- Refresh tokens for long sessions
- Rate limit login attempts
- Hash passwords with bcrypt

### Sensitive Data

```typescript
// Encrypt sensitive data
import { encrypt, decrypt } from '@/lib/crypto/encryption'

const encrypted = encrypt(sensitiveData)
const decrypted = decrypt(encrypted)
```

### CORS Configuration

```typescript
// next.config.ts
const corsOrigin = process.env.NODE_ENV === 'production'
  ? process.env.NEXT_PUBLIC_APP_URL
  : 'http://localhost:3000'
```

### Environment Variables

- Never commit `.env` files
- Use `.env.example` as template
- Validate required env vars on startup

---

## 22. Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

#### Build Errors
```bash
# Clear cache
rm -rf .next node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

#### TypeScript Errors
```bash
# Regenerate Prisma types
npx prisma generate

# Check for type errors
npx tsc --noEmit
```

#### Camera Stream Not Working
1. Verify FFmpeg installation: `ffmpeg -version`
2. Test RTSP URL: `ffplay "rtsp://..."`
3. Check camera network accessibility
4. Review camera credentials

#### Payment Webhook Issues
1. Verify webhook secret
2. Check webhook URL accessibility
3. Review webhook logs
4. Test with sandbox mode

### Logging

```typescript
import { logger } from '@/lib/logger'

logger.debug('Debug message')
logger.info('Info message')
logger.warn('Warning message')
logger.error('Error message', error instanceof Error ? error : undefined)
```

### Debug Mode

```bash
# Run with debug logging
LOG_LEVEL=debug npm run dev
```

---

## 23. Contributing

### Development Workflow

1. Create feature branch from `main`
2. Follow existing code patterns
3. Write tests for new features
4. Update documentation
5. Submit pull request

### Code Style

- Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful commit messages

### Commit Message Format

```
type(scope): description

feat(api): add payment webhook endpoint
fix(auth): handle expired tokens correctly
docs(readme): update installation steps
test(payments): add unit tests for fee calculation
```

### Pull Request Checklist

- [ ] Tests pass
- [ ] TypeScript compiles without errors
- [ ] Documentation updated
- [ ] No console.log statements (use logger)
- [ ] Environment variables documented
- [ ] Database migrations included

---

## License

Proprietary - All rights reserved.

---

## Support

For issues and questions:
- Create GitHub issue
- Contact development team
- Review existing documentation

---

*Last updated: January 2026*
*Version: 2.0*
