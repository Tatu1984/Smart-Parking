# API Routes Migration Guide

## Current Status
This directory contains Next.js API routes that serve as the backend for the MVP phase.

## Architecture

### Current (MVP)
```
Frontend → Next.js API Routes → Prisma → PostgreSQL
```

### Future (Production)
```
Frontend → API Client Layer → Go/Python Backend → PostgreSQL
```

## Migration Path

### Phase 1: Abstraction (Current)
1. All API calls go through `src/lib/api/client.ts`
2. Endpoints are defined in `src/lib/api/endpoints.ts`
3. Services in `src/services/` consume the API client
4. Components use hooks that use services

### Phase 2: Backend Separation
1. Update `src/config/api.config.ts` to point to new backend URL
2. Set `NEXT_PUBLIC_USE_REAL_BACKEND=true` in environment
3. All existing code continues to work without changes
4. API routes in this directory can be removed

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/api/client.ts` | Base API client with interceptors |
| `src/lib/api/endpoints.ts` | All endpoint definitions |
| `src/services/*.service.ts` | Business logic layer |
| `src/hooks/*.ts` | React hooks for data fetching |
| `src/config/api.config.ts` | API configuration |

## Adding New Endpoints

1. Add endpoint to `src/lib/api/endpoints.ts`
2. Create or update service in `src/services/`
3. Create or update hook in `src/hooks/`
4. Create API route here (temporary for MVP)

## Environment Variables

```env
# Use Next.js API routes (default)
NEXT_PUBLIC_USE_REAL_BACKEND=false

# Use external backend
NEXT_PUBLIC_USE_REAL_BACKEND=true
NEXT_PUBLIC_API_URL=https://api.example.com
```
