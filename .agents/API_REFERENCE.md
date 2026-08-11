# API Reference — Crewly Backend

> Quick reference for all API endpoints. Base URL: `http://localhost:3000/api`

---

## Authentication

All endpoints except `/auth/login` and `/auth/refresh` require `Authorization: Bearer <token>` header.

### POST /auth/login
**Public** — No auth required
```json
// Request
{ "email": "owner@crewly.com", "password": "crewly2024" }

// Response (200)
{
  "success": true,
  "data": {
    "token": "jwt...",
    "refreshToken": "jwt...",
    "user": { "id": "...", "name": "Admin Owner", "email": "...", "role": "owner", "assignedSites": [] }
  }
}
```

### POST /auth/register
**Requires: Owner JWT** — Only owners can create new users
```json
// Request
{ "name": "...", "email": "...", "password": "...", "role": "site_supervisor", "phone": "...", "assignedSites": [] }
```

### POST /auth/refresh
**Public** — Uses refresh token
```json
// Request
{ "refreshToken": "jwt..." }
// Response
{ "success": true, "data": { "token": "new-jwt..." } }
```

---

## Sync (WatermelonDB Protocol)

### GET /sync/pull?last_pulled_at=\<timestamp\>
**Requires: Auth + moneyFilter**

Returns delta changes since last sync. Response is role-filtered:
- Site Supervisors: only their project data, money fields stripped
- Super Supervisors: all project data, money fields stripped
- Owner/Accountant: everything including money fields

```json
{
  "success": true,
  "data": {
    "changes": {
      "users": { "created": [...], "updated": [...], "deleted": ["id1", "id2"] },
      "projects": { "created": [...], "updated": [...], "deleted": [] },
      // ... all 11 tables
    },
    "timestamp": 1691234567890
  }
}
```

### POST /sync/push
**Requires: Auth + moneyFilter**

Applies local WatermelonDB changes to MongoDB.
```json
// Request
{
  "changes": {
    "daily_reports": {
      "created": [{ "id": "...", "project_id": "...", ... }],
      "updated": [],
      "deleted": []
    }
  },
  "lastPulledAt": 1691234567890
}

// Response
{ "success": true }
```

**Conflict resolution:**
- `payments`, `material_purchases` → **server-wins** (financial records never overwritten by client)
- Everything else → **client-wins** (last write wins)

---

## Projects

### GET /api/projects
### POST /api/projects (Owner only)
### PATCH /api/projects/:id (Owner only)

---

## Teams

### GET /api/teams
### POST /api/teams (Owner/Super)
### PATCH /api/teams/:id

---

## Daily Reports

### GET /api/daily-reports?project_id=\<id\>&date=\<YYYY-MM-DD\>
### POST /api/daily-reports
### PATCH /api/daily-reports/:id

---

## Material Orders

### GET /api/material-orders?project_id=\<id\>
### POST /api/material-orders
### PATCH /api/material-orders/:id (status transitions)

Status pipeline: `needed` → `ordered` → `waiting_delivery` → `received_full` / `received_partial`

---

## Material Purchases

### GET /api/material-purchases?project_id=\<id\>
### POST /api/material-purchases

---

## Petty Cash

### GET /api/petty-cash?project_id=\<id\>&supervisor_id=\<id\>
### POST /api/petty-cash/float (issue float)
### POST /api/petty-cash/expense (record expense)
### POST /api/petty-cash/reconcile

---

## Verifications (Super Supervisor)

### GET /api/verifications/pending
### POST /api/verifications

---

## Coordination (Super Supervisor)

### GET /api/coordination/overview
### POST /api/coordination/assign
### POST /api/coordination/unassign
### GET /api/coordination/unassign-check/:assignmentId

---

## Notifications

### GET /api/notifications
### PATCH /api/notifications/:id/read
### PATCH /api/notifications/read-all

---

## Middleware Chain (Order Matters)

```
Request → helmet → cors → json → rate-limit → route-specific:

/api/auth/*           → (no auth)     → authRoutes
/api/projects/*       → authenticate  → moneyFilter → projectRoutes
/api/teams/*          → authenticate  → teamRoutes
/api/daily-reports/*  → authenticate  → moneyFilter → dailyReportRoutes
/api/material-orders  → authenticate  → materialOrderRoutes
/api/material-purchases → authenticate → moneyFilter → materialPurchaseRoutes
/api/petty-cash/*     → authenticate  → moneyFilter → pettyCashRoutes
/api/sync/*           → authenticate  → moneyFilter → syncRoutes
/api/verifications/*  → authenticate  → verificationRoutes
/api/coordination/*   → authenticate  → coordinationRoutes
/api/notifications/*  → authenticate  → notificationRoutes
```
