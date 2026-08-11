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
Returns `unreadCount`, `total`, `page`, and `limit` alongside `data` (not nested inside it).

### PATCH /api/notifications/:id/read
### PATCH /api/notifications/read-all

---

## Owner (Owner only)

Every route under `/api/owner` is gated by `requireRole(Role.OWNER)` at the router level.

### GET /api/owner/dashboard
Company-wide snapshot. Spend is derived, never stored:
- **labor** = `payments` of type `daily_wage`, `milestone`, `lump_sum_installment`
- **materials** = sum of `material_purchases.amount`
- **pettyCash** = sum of `petty_cash.expenses[].amount` (top-up payments are excluded from labor so they aren't counted twice)

```json
{
  "success": true,
  "data": {
    "summary": { "activeProjects": 2, "totalProjects": 3, "teamsWorking": 5, "idleTeams": 1, "noShowTeams": 0, "pendingActions": 4 },
    "pendingActions": { "unverifiedTasks": 1, "overdueOrders": 1, "missingReceipts": 1, "unreconciledFloats": 1 },
    "totals": { "totalBudget": 850000, "totalSpent": 325000, "totalRemaining": 525000, "percentUsed": 38, "projectsOverBudget": 0 },
    "projects": [{ "projectId": "...", "budgetTotal": 850000, "spent": { "labor": 200000, "materials": 100000, "pettyCash": 25000, "total": 325000 }, "percentUsed": 38, "flags": { "working": 1, "idle": 1, "noShow": 0, "unverified": 1 } }]
  }
}
```

Activity counts (`teamsWorking`, `idleTeams`) come from each project's **latest** daily
report and only include `active` projects.

### GET /api/owner/projects/:id/cost-breakdown
Drill-down for one project: `totals`, `categories` (budget vs. actual per
`BudgetCategory`, with `tracked: false` where no spend source exists yet), `trades`
(labor grouped by the paid team's trade), `transactions` (latest 30 payments +
purchases, `flagged` when a receipt is missing or the entry was late),
`budgetHistory` (resolved to user names), and `activeTeamCount`.

---

## Users

### GET /api/users?role=\<role\> — **Owner only**
Lists users without `passwordHash`, with `assignedSites` resolved to `{ projectId, name }`.

### POST /api/users — **Owner only**
Create a user. Same as `/auth/register` but also accepts `assignedSites`. Requires a password of 8+ characters.

### PATCH /api/users/:id — **Owner only**
Update `name`, `phone`, `role`, `assignedSites`, `isActive`, or `password`.
Owners cannot change their own role or deactivate themselves (400) — lockout guard.

### GET /api/users/me/notification-prefs — **Any authenticated role**
Returns a full map of `NotificationType` → boolean; types the user never set come back `true`.

### PATCH /api/users/me/notification-prefs — **Any authenticated role**
Body: `{ "preferences": { "no_show": false } }` — merged into the saved map.
Unknown notification types are rejected with 400.

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
/api/owner/*          → authenticate  → moneyFilter → ownerRoutes (router-level Owner guard)
/api/users/*          → authenticate  → userRoutes (per-route Owner guard)
```
