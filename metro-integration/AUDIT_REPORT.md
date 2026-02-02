# Metro AI Suite Integration - Audit Report

**Date:** 2026-02-02
**Auditor:** Claude Code
**Status:** Issues Identified and Critical Fixes Applied

---

## Executive Summary

A comprehensive audit was performed on the Metro AI Suite integration. Several issues were identified across different components:

| Category | Critical | High | Medium | Low | Fixed |
|----------|----------|------|--------|-----|-------|
| Docker Compose | 1 | 3 | 2 | 0 | 0 |
| Nginx Config | 0 | 0 | 4 | 2 | 0 |
| Prisma Schema | 0 | 0 | 0 | 0 | - |
| Python Services | 3 | 2 | 2 | 1 | 3 |
| TypeScript APIs | 1 | 5 | 4 | 2 | 1 |
| React Components | 2 | 2 | 4 | 1 | 3 |
| **TOTAL** | **7** | **12** | **16** | **6** | **7** |

---

## Critical Issues - FIXED

### 1. ✅ Python Logging Configuration (server.py)
**Issue:** `logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))` passed string instead of int
**Fix Applied:** Added `getattr(logging, ..., logging.INFO)` conversion

### 2. ✅ Unsafe Endpoint Parsing (milvus_utils.py)
**Issue:** `endpoint.split(":")` fails on IPv6 or malformed URLs
**Fix Applied:** Changed to `rsplit(":", 1)` with validation

### 3. ✅ Filter Expression Injection (milvus_utils.py)
**Issue:** Camera IDs not escaped in Milvus filter expressions
**Fix Applied:** Added quote escaping for camera IDs

### 4. ✅ TypeScript Type Error (ImageSearch.tsx)
**Issue:** `score: float` - JavaScript has no `float` type
**Fix Applied:** Changed to `score: number`

### 5. ✅ paginatedResponse Type Mismatch (images/route.ts)
**Issue:** Function expects array, received object
**Fix Applied:** Changed to `successResponse` with manual pagination

### 6. ✅ Memory Leak - Stats Interval (WebRTCStream.tsx)
**Issue:** `setInterval` never cleared on unmount
**Fix Applied:** Added ref tracking and cleanup in `stopStream`

### 7. ✅ Memory Leak - Object URL (ImageSearch.tsx)
**Issue:** Blob URLs not revoked on unmount
**Fix Applied:** Added `useEffect` cleanup and revoke on new selection

---

## Critical Issues - NOT FIXED (Require Manual Action)

### 1. ⚠️ Missing Health Check for `app` Service (docker-compose.yml)
**Impact:** Dependent services may start before app is ready
**Recommended Fix:**
```yaml
app:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 10s
    timeout: 5s
    retries: 5
```

---

## High Priority Issues - NOT FIXED

### Docker Compose

1. **Missing `DETECTION_API_KEY` default** - Service fails without explicit config
2. **Weak default passwords** - Security risk in production
3. **Missing health checks** for 10+ services

### TypeScript APIs

1. **Unsafe type casting** (`as any`) in webrtc/route.ts line 40
2. **Unvalidated PATCH body** in images/[imageId]/route.ts
3. **Silent error swallowing** (`.catch(() => null)`) in pipelines/route.ts
4. **Data consistency risk** - Milvus deletion fails silently
5. **Missing input validation** for dates and numeric parameters

### React Components

1. **useCallback dependency issue** - `retryCount` causes recreation on every retry
2. **Race condition** - Multiple concurrent searches possible

---

## Medium Priority Issues

### Nginx Configuration

1. **Missing CORS headers** on `/api/`, `/socket.io/`, `/metro-api/`, `/feature-api/`
2. **Missing proxy timeouts** on `/`, `/grafana/`, `/node-red/`
3. **Permissive CORS** (`Access-Control-Allow-Origin: "*"`) on `/stream/`
4. **Inconsistent WebSocket headers** across locations

### TypeScript APIs

1. **Inconsistent response types** - POST returns raw Response, others return JSON
2. **Missing pipelineName validation** against known pipelines
3. **Unvalidated Location header** forwarding

### React Components

1. **Accessibility issues** - Drop zone not keyboard accessible
2. **Missing error boundary** wrappers
3. **Generic error handling** - JSON parse without content-type check

---

## Low Priority Issues

1. SSL volume directory needs population for production
2. Model directories need manual download
3. Inconsistent quote styles in nginx config
4. Minor TypeScript style inconsistencies

---

## File-by-File Status

### Python Services

| File | Status | Notes |
|------|--------|-------|
| `mqtt-translator/translator.py` | ✅ Good | Minor: missing api_endpoint validation |
| `feature-matching/server.py` | ✅ Fixed | Logging config fixed |
| `feature-matching/milvus_utils.py` | ✅ Fixed | Endpoint parsing & injection fixed |

### TypeScript API Routes

| File | Status | Notes |
|------|--------|-------|
| `metro/pipelines/route.ts` | ⚠️ Review | Silent error catch |
| `metro/pipelines/[id]/route.ts` | ✅ Good | No issues |
| `metro/streams/[id]/webrtc/route.ts` | ⚠️ Review | Type cast, response inconsistency |
| `vehicles/search/route.ts` | ⚠️ Review | Unsafe `any` type |
| `vehicles/[id]/images/route.ts` | ✅ Fixed | paginatedResponse fixed |
| `vehicles/[id]/images/[imageId]/route.ts` | ⚠️ Review | Unvalidated body |

### React Components

| File | Status | Notes |
|------|--------|-------|
| `camera/WebRTCStream.tsx` | ✅ Fixed | Memory leak fixed |
| `vehicles/ImageSearch.tsx` | ✅ Fixed | Type + memory leak fixed |

### Configuration Files

| File | Status | Notes |
|------|--------|-------|
| `docker-compose.yml` | ⚠️ Review | Add health checks |
| `docker/nginx/nginx.conf` | ⚠️ Review | Add CORS, timeouts |
| `prisma/schema.prisma` | ✅ Good | VehicleFeatureIndex correct |
| `.env.example` | ✅ Good | All variables documented |

---

## Recommended Actions

### Immediate (Before Testing)

1. Add health check to `app` service in docker-compose.yml
2. Download OpenVINO models to `metro-integration/dlstreamer/models/`
3. Set `DETECTION_API_KEY` in environment
4. Review and update default passwords

### Before Production

1. Add CORS headers to all API locations in nginx
2. Add proxy timeouts to `/grafana/` and `/node-red/`
3. Add Zod schema validation to PATCH endpoints
4. Replace `as any` type casts with proper interfaces
5. Add health checks to all critical services
6. Configure SSL certificates

### Nice to Have

1. Add error boundaries to React components
2. Improve accessibility on ImageSearch drop zone
3. Add request deduplication for image search

---

## Testing Checklist

### Phase 1: MQTT Infrastructure
```bash
# Start services
docker compose up -d mqtt node-red mqtt-translator

# Verify Node-RED
curl http://localhost:1880

# Test message flow
docker exec sparking-mqtt mosquitto_pub -t "object_detection_1" \
  -m '{"metadata":{"objects":[{"detection":{"bounding_box":{"x_min":0.1,"y_min":0.2,"x_max":0.3,"y_max":0.4},"confidence":0.95,"label":"car"}}]}}'

# Check translator logs
docker logs sparking-mqtt-translator
```

### Phase 2: DL Streamer + WebRTC
```bash
# Start services
docker compose up -d dlstreamer-pipeline-server mediamtx grafana

# Start a pipeline
curl -X POST http://localhost/api/metro/pipelines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"pipelineName":"sparking_vehicle_detection","source":{"uri":"rtsp://camera:554/stream","type":"uri"}}'

# Check Grafana
curl http://localhost:3001/api/health
```

### Phase 3: Image Search
```bash
# Start services
docker compose up -d milvus-db feature-matching

# Wait for Milvus
curl http://localhost:9091/healthz

# Run migration
npx prisma migrate dev

# Test search
curl -X POST http://localhost/api/vehicles/search \
  -F "image=@test_car.jpg"
```

---

## Appendix: Commands for Fixes

### Apply Prisma Migration
```bash
cd /Users/sudipto/Desktop/projects/sparking
npx prisma migrate dev --name add_vehicle_feature_index
npx prisma generate
```

### Validate Docker Compose
```bash
docker compose config
```

### Check for TypeScript Errors
```bash
npx tsc --noEmit
```

### Run ESLint
```bash
npx eslint src/app/api/metro src/app/api/vehicles src/components/camera src/components/vehicles
```
