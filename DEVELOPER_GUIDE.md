# Sparking - Developer Guide

## AI-Powered Smart Parking Management System

This comprehensive guide helps developers understand, modify, and extend the Sparking parking management system.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Getting Started](#4-getting-started)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Frontend Architecture](#7-frontend-architecture)
8. [AI Pipeline](#8-ai-pipeline)
9. [Hardware Integration](#9-hardware-integration)
10. [Payment System](#10-payment-system)
11. [Camera System](#11-camera-system)
12. [Common Tasks](#12-common-tasks)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Project Overview

Sparking is a comprehensive AI-powered parking management system that includes:

- **Real-time vehicle detection** using computer vision
- **Automatic license plate recognition (ANPR)**
- **Digital wallet and payment processing**
- **Hardware integration** (gates, displays, printers)
- **Analytics and reporting**
- **Multi-tenant parking lot management**

### Key Features

| Feature | Description |
|---------|-------------|
| Vehicle Detection | YOLOv8-based detection with <100ms latency |
| ANPR | License plate recognition using Intel OpenVINO |
| Payment Gateway | Stripe integration + digital wallet system |
| Hardware Control | Gates, LED displays, ticket printers |
| Analytics | Predictive occupancy, revenue reports |
| API | RESTful + GraphQL-like endpoints |

---

## 2. Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: shadcn/ui + Tailwind CSS
- **State Management**: React hooks + context
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js with Next.js API routes
- **ORM**: Prisma
- **Database**: PostgreSQL (Neon serverless)
- **Authentication**: JWT-based custom auth

### AI Pipeline
- **Language**: Python 3.8+
- **Detection**: YOLOv8 / Intel OpenVINO
- **Video Processing**: OpenCV + FFmpeg

### Infrastructure
- **Deployment**: Vercel (web) + Docker (AI pipeline)
- **Realtime**: Socket.io / MQTT

---

## 3. Project Structure

```
sparking/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── cameras/       # Camera management
│   │   │   ├── gates/         # Gate control
│   │   │   ├── graphql/       # GraphQL-like endpoint
│   │   │   ├── payments/      # Payment processing
│   │   │   ├── slots/         # Parking slot management
│   │   │   ├── tokens/        # Parking token management
│   │   │   ├── webhooks/      # Webhook system
│   │   │   └── ...
│   │   ├── dashboard/         # Admin dashboard pages
│   │   ├── find-car/          # Find My Car feature
│   │   ├── kiosk/             # Self-service kiosk
│   │   └── docs/              # API documentation
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── camera/           # Camera stream components
│   │   └── ...
│   ├── lib/                   # Utility libraries
│   │   ├── auth/             # Authentication
│   │   ├── db.ts             # Prisma client
│   │   ├── hardware/         # Hardware drivers
│   │   ├── payments/         # Stripe integration
│   │   ├── analytics/        # Predictive analytics
│   │   ├── export/           # PDF report generation
│   │   └── sync/             # Offline sync queue
│   └── hooks/                 # React hooks
├── ai-pipeline/               # Python AI service
│   └── src/
│       ├── pipeline.py       # Main detection pipeline
│       ├── camera.py         # RTSP stream capture
│       ├── detector.py       # Vehicle detection
│       ├── anpr.py           # License plate recognition
│       └── optimization.py   # Latency optimization
├── prisma/
│   └── schema.prisma         # Database schema
└── public/                    # Static assets
```

---

## 4. Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (or Neon account)
- Python 3.8+ (for AI pipeline)
- FFmpeg (for camera streaming)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sparking

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and secrets

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Authentication
JWT_SECRET="your-secret-key-min-32-chars"
NEXTAUTH_SECRET="your-nextauth-secret"

# Stripe (optional)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# AI Pipeline
DETECTION_API_ENDPOINT="http://localhost:3000/api/realtime/detection"
```

---

## 5. Database Schema

### Core Models

#### ParkingLot
```prisma
model ParkingLot {
  id           String   @id @default(cuid())
  name         String
  address      String?
  city         String?
  totalSlots   Int
  status       ParkingLotStatus @default(ACTIVE)
  zones        Zone[]
  cameras      Camera[]
  analytics    ParkingAnalytics[]
}
```

#### Token (Parking Session)
```prisma
model Token {
  id             String   @id @default(cuid())
  tokenNumber    String   @unique
  licensePlate   String?
  vehicleType    VehicleType?
  entryTime      DateTime
  exitTime       DateTime?
  status         TokenStatus
  allocatedSlotId String?
  allocatedSlot  Slot?    @relation(fields: [allocatedSlotId])
  transactions   Transaction[]
}
```

#### Slot
```prisma
model Slot {
  id          String   @id @default(cuid())
  slotNumber  String
  zoneId      String
  zone        Zone     @relation(fields: [zoneId])
  status      SlotStatus
  slotType    SlotType
  occupancies Occupancy[]
}
```

### Running Migrations

```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# Apply migrations to production
npx prisma migrate deploy

# Reset database (WARNING: destroys data)
npx prisma migrate reset
```

---

## 6. API Reference

### Authentication

All protected endpoints require a JWT token:

```bash
# Login
POST /api/auth/login
Body: { "email": "user@example.com", "password": "..." }
Response: { "token": "eyJ...", "user": {...} }

# Use token in requests
Authorization: Bearer <token>
```

### Core Endpoints

#### Parking Lots
```bash
GET    /api/parking-lots          # List all parking lots
POST   /api/parking-lots          # Create parking lot
GET    /api/parking-lots/:id      # Get parking lot
PATCH  /api/parking-lots/:id      # Update parking lot
DELETE /api/parking-lots/:id      # Delete parking lot
```

#### Tokens (Parking Sessions)
```bash
GET    /api/tokens                # List tokens
POST   /api/tokens                # Create token (vehicle entry)
GET    /api/tokens/:id            # Get token
PATCH  /api/tokens/:id            # Update token
POST   /api/tokens/:id/exit       # Process vehicle exit
```

#### Cameras
```bash
GET    /api/cameras               # List cameras
POST   /api/cameras               # Add camera
GET    /api/cameras/:id           # Get camera
PATCH  /api/cameras/:id           # Update camera
DELETE /api/cameras/:id           # Delete camera
GET    /api/cameras/:id/stream    # MJPEG live stream
GET    /api/cameras/:id/snapshot  # Capture snapshot
```

#### Gates
```bash
GET    /api/gates                 # List gates
POST   /api/gates/:id/open        # Open gate
POST   /api/gates/:id/close       # Close gate
GET    /api/gates/:id/status      # Get gate status
```

### GraphQL-like Endpoint

```bash
POST /api/graphql
Body: { "query": "parkingLots", "variables": {} }

# Available queries:
# - parkingLots, parkingLot(id)
# - zones, zone(id)
# - slots, availableSlots(parkingLotId)
# - tokens, token(id), activeTokens
# - payments
# - analytics(parkingLotId)
# - dashboardSummary
```

### API Documentation

Interactive Swagger documentation is available at:
- `/docs` - Swagger UI
- `/api/docs` - OpenAPI JSON spec

---

## 7. Frontend Architecture

### Page Structure

```
/                          # Landing page
/dashboard                 # Main dashboard
/dashboard/parking-lots    # Parking lot management
/dashboard/zones           # Zone management
/dashboard/slots           # Slot management
/dashboard/cameras         # Camera management
/dashboard/tokens          # Active parking sessions
/dashboard/analytics       # Analytics & reports
/dashboard/wallet          # Digital wallet
/find-car                  # Find My Car (public)
/kiosk                     # Self-service kiosk
```

### Component Patterns

#### Using shadcn/ui Components
```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click Me</Button>
      </CardContent>
    </Card>
  )
}
```

#### Data Fetching Pattern
```tsx
'use client'

import { useState, useEffect } from 'react'

export default function DataPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/resource')
        const json = await res.json()
        setData(json.data || [])
      } catch (error) {
        console.error('Failed to fetch:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div>Loading...</div>

  return <div>{/* Render data */}</div>
}
```

### Adding a New Dashboard Page

1. Create page file:
```tsx
// src/app/dashboard/my-feature/page.tsx
export default function MyFeaturePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Feature</h1>
      {/* Content */}
    </div>
  )
}
```

2. Add to sidebar navigation in `src/components/dashboard/sidebar.tsx`

---

## 8. AI Pipeline

### Overview

The AI pipeline is a Python service that:
1. Captures RTSP video streams
2. Runs vehicle detection (YOLOv8)
3. Performs license plate recognition
4. Publishes events to the Next.js API

### Running the Pipeline

```bash
cd ai-pipeline

# Install dependencies
pip install -r requirements.txt

# Run with config
python -m src.pipeline --config config.json

# Run with mock cameras (testing)
python -m src.pipeline --mock --log-level DEBUG
```

### Configuration

```json
{
  "cameras": [
    {
      "id": "cam-1",
      "name": "Entry Camera",
      "rtsp_url": "rtsp://192.168.1.100:554/stream",
      "parking_lot_id": "lot-1",
      "zone_id": "zone-1",
      "enabled": true
    }
  ],
  "api_endpoint": "http://localhost:3000/api/realtime/detection",
  "device": "CPU",
  "confidence_threshold": 0.5,
  "inference_interval": 5
}
```

### Adding Custom Detection Logic

```python
# ai-pipeline/src/detector.py

class VehicleDetector:
    def detect(self, frame: np.ndarray) -> List[Detection]:
        # Your custom detection logic
        pass
```

---

## 9. Hardware Integration

### Gate Controller

```typescript
// src/lib/hardware/index.ts

import { HardwareManager } from '@/lib/hardware'

// Get hardware manager instance
const manager = HardwareManager.getInstance()

// Register a gate
await manager.registerGate('gate-1', {
  protocol: 'HTTP',
  address: '192.168.1.50',
  port: 80
})

// Control gate
const gate = manager.getGate('gate-1')
await gate.open()
await gate.close()
```

### Display Controller

```typescript
const display = manager.getDisplay('display-1')

// Show message
await display.showMessage('Welcome!')

// Update availability
await display.updateAvailability(45, 100)

// Show directional arrow
await display.showDirectionalArrow('LEFT', 'Zone A')
```

### Supported Protocols

| Protocol | Gate | Display | Printer |
|----------|------|---------|---------|
| HTTP/REST | Yes | Yes | Yes |
| RS485 | Yes | Yes | No |
| Modbus | Yes | No | No |
| ESC/POS | No | No | Yes |

---

## 10. Payment System

### Stripe Integration

```typescript
// Create payment intent
import { createParkingPayment } from '@/lib/payments/stripe'

const payment = await createParkingPayment({
  amount: 5000,  // in paisa (INR) or cents (USD)
  currency: 'inr',
  tokenId: 'token-123',
  parkingLotId: 'lot-1'
})
```

### Wallet System

```typescript
// Transfer between wallets
await prisma.payment.create({
  data: {
    payerWalletId: 'wallet-1',
    payeeWalletId: 'wallet-2',
    amount: 1000,
    paymentType: 'TRANSFER',
    status: 'COMPLETED'
  }
})
```

---

## 11. Camera System

### Adding a Camera

1. Via Dashboard: Dashboard > Cameras > Add Camera
2. Via API:
```bash
POST /api/cameras
{
  "parkingLotId": "lot-1",
  "name": "Entry Camera",
  "rtspUrl": "rtsp://192.168.1.100:554/stream",
  "username": "admin",
  "password": "password"
}
```

### Viewing Live Stream

The system uses MJPEG proxy for browser-compatible streaming:

```typescript
// CameraStream component
import { CameraStream } from '@/components/camera'

<CameraStream
  cameraId="cam-1"
  cameraName="Entry Camera"
  status="ONLINE"
  autoPlay={true}
/>
```

### Stream Endpoint

```
GET /api/cameras/:id/stream
Returns: multipart/x-mixed-replace (MJPEG stream)

GET /api/cameras/:id/snapshot
Returns: image/jpeg
```

**Requirements:**
- FFmpeg must be installed on the server
- Camera must be accessible from server network

---

## 12. Common Tasks

### Adding a New API Endpoint

1. Create route file:
```typescript
// src/app/api/my-feature/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await prisma.myModel.findMany()
  return NextResponse.json({ data })
}
```

### Adding a New Database Model

1. Update schema:
```prisma
// prisma/schema.prisma
model MyModel {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
}
```

2. Generate client:
```bash
npx prisma generate
```

3. Apply migration:
```bash
npx prisma migrate dev --name add_my_model
```

### Generating PDF Reports

```typescript
import { generatePDFReport } from '@/lib/export/pdf'

const pdf = generatePDFReport(
  {
    type: 'transactions',
    title: 'Monthly Report',
    parkingLotName: 'Main Lot',
    dateRange: { start: new Date(), end: new Date() },
    generatedAt: new Date(),
    generatedBy: 'Admin'
  },
  reportData
)
```

### Setting Up Webhooks

```bash
# Register webhook
POST /api/webhooks
{
  "name": "My Webhook",
  "url": "https://example.com/webhook",
  "events": ["vehicle.entry", "vehicle.exit", "payment.completed"],
  "secret": "optional-secret"
}
```

---

## 13. Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database URL
echo $DATABASE_URL

# Test connection
npx prisma db pull
```

#### Build Errors
```bash
# Clear cache and rebuild
rm -rf .next node_modules/.cache
npm run build
```

#### Camera Stream Not Working
1. Check FFmpeg is installed: `ffmpeg -version`
2. Test RTSP URL: `ffplay rtsp://...`
3. Check camera status in dashboard
4. Verify network connectivity from server

#### TypeScript Errors
```bash
# Regenerate Prisma types
npx prisma generate

# Check for type errors
npx tsc --noEmit
```

### Logs

```bash
# Development server logs
npm run dev

# Production logs (Vercel)
vercel logs

# AI pipeline logs
python -m src.pipeline --log-level DEBUG
```

### Getting Help

- Check `/docs` for API documentation
- Review Prisma schema for database structure
- Check component examples in `/src/components/`

---

## Contributing

1. Create feature branch from `main`
2. Follow existing code patterns
3. Write tests for new features
4. Update documentation as needed
5. Submit pull request

---

## License

Proprietary - All rights reserved.
