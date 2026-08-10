# Crewly — Project Progress Tracker

> Construction Company Management App — Offline-first mobile + backend
> Last updated: 2026-08-11

---

## Phase 1: Foundation (Auth + Data Models + Project Structure)
> **Status: ✅ COMPLETE**

### Monorepo Root
- [x] `package.json` — npm workspaces (`apps/*`, `packages/*`)
- [x] `tsconfig.json` — root TypeScript config
- [x] `.gitignore` — Node, Expo, iOS, Android artifacts

### Shared Types (`packages/shared/`)
- [x] `package.json`
- [x] `src/index.ts` — Roles, Trades, Enums, TABLE_NAMES, MONEY_FIELDS, MONEY_VISIBLE_ROLES

### Backend (`apps/backend/`)
- [x] `package.json` + dependencies (express, mongoose, bcryptjs, jsonwebtoken, etc.)
- [x] `src/server.ts` — Express app, middleware chain, route mounting
- [x] `src/config/db.ts` — MongoDB connection
- [x] `src/config/auth.ts` — JWT secret, token expiry
- [x] `src/middleware/auth.ts` — JWT verification, attaches `req.user`
- [x] `src/middleware/roleGuard.ts` — `requireRole(...roles)` factory
- [x] `src/middleware/moneyFilter.ts` — strips budget/cost fields for non-Owner/non-Accountant
- [x] Mongoose models (11 collections):
  - [x] `User.ts`, `Project.ts`, `Team.ts`, `TeamSiteAssignment.ts`
  - [x] `DailyReport.ts`, `TaskVerification.ts`, `MaterialOrder.ts`
  - [x] `MaterialPurchase.ts`, `PettyCash.ts`, `Payment.ts`, `Notification.ts`
- [x] Backend routes:
  - [x] `routes/auth.ts` — register, login, refresh
  - [x] `routes/projects.ts` — CRUD + budget history
  - [x] `routes/teams.ts` — CRUD + assignment management
  - [x] `routes/dailyReports.ts` — create/update/list
  - [x] `routes/materialOrders.ts` — CRUD + status transitions
  - [x] `routes/materialPurchases.ts` — create/list + flag management
  - [x] `routes/pettyCash.ts` — float issuance, expenses, reconciliation
- [x] Seed script (`src/scripts/seed.ts`) — Owner, Super, Site, Accountant users + 5 teams

### Mobile App (`apps/mobile/`)
- [x] Expo project setup + `app.config.ts`
- [x] WatermelonDB setup: `schema.ts`, `migrations.ts`, `index.ts`, `models/`
- [x] Theme system: `colors.ts`, `typography.ts`, `spacing.ts`
- [x] State management: `authStore.ts`, `syncStore.ts`
- [x] Navigation structure (Expo Router): all role-based layouts + auth screens
- [x] API client (`src/lib/api.ts`)

---

## Phase 2: Site Supervisor Core Flow (Daily Reports)
> **Status: ✅ COMPLETE**

### Backend
- [x] `POST /daily-reports` — create with team entries, attendance, idle reasons
- [x] `PATCH /daily-reports/:id` — update
- [x] `GET /daily-reports` — list reports

### Mobile
- [x] Daily report form (`(site)/daily-report.tsx`) — multi-step, per-team, attendance, tasks, photos
- [x] Report landing page with status

---

## Phase 3: Material Orders + Purchases + Petty Cash
> **Status: ✅ COMPLETE**

### Backend
- [x] Material order routes — CRUD + status transitions
- [x] Material purchase routes — create/list + flag management
- [x] Petty cash routes — float issuance, expenses, reconciliation

### Mobile
- [x] Materials hub (`(site)/materials.tsx`)
- [x] Material request form (`(site)/material-order.tsx`)
- [x] Material purchase form (`(site)/material-purchase.tsx`)
- [x] Petty cash dashboard (`(site)/petty-cash.tsx`)
- [x] Sync status screen (`(site)/sync-status.tsx`)

---

## Phase 4: Sync Engine
> **Status: ✅ COMPLETE**

### Backend
- [x] `GET /sync/pull` — delta changes, role-filtered, money-stripped
- [x] `POST /sync/push` — apply local changes, conflict resolution
- [x] Per-record money field stripping (defense-in-depth)
- [x] Integration test (`test-sync-money-filter.ts`) — verified

### Mobile
- [x] WatermelonDB `synchronize()` (`src/lib/sync.ts`)
- [x] Photo upload queue (`src/lib/photoSync.ts`)

---

## Phase 5: Super Supervisor Features
> **Status: ✅ COMPLETE**

### Backend
- [x] `routes/verification.ts` — Task verification endpoints (Super Supervisor only)
- [x] `routes/coordination.ts` — Team-to-site quick assignment + overview + unassign-check
- [x] `routes/notifications.ts` — List/mark-read/mark-all-read notifications
- [x] `server.ts` — Mounted all 3 new routes

### Mobile — Live Board (`(super)/live-board.tsx`)
- [x] Fetch and display all active projects with assigned teams + status
- [x] Status flags: idle (amber), no-show (red), material-blocked (orange), unverified (purple)
- [x] Tap project → expandable team details with status, task, headcount
- [x] "Last synced" indicator + auto-refresh on focus + 30s interval + pull-to-refresh
- [x] AppState-aware: pauses auto-refresh when app is in background

### Mobile — Quick Coordination (`(super)/coordinate.tsx`)
- [x] Team list with current assignment status (available/assigned to N sites)
- [x] One-tap assign: select project + payment type → confirm
- [x] Create `TeamSiteAssignment` + log `assignmentHistory` + notify Site Supervisor
- [x] Unassign guard: pre-check for open idle reasons or unverified tasks → warning alert

### Mobile — Task Verification (`(super)/verify.tsx`)
- [x] List tasks marked "completed" but not yet verified (enriched with team/project names)
- [x] One-tap quick verify ✅ + verify-with-notes modal
- [x] Creates `TaskVerification` record, optimistic UI removal
- [x] Empty state: "All Tasks Verified! 🎉"

### Mobile — Notifications (`(super)/notifications.tsx`)
- [x] In-app notification feed (chronological, paginated)
- [x] Mark-as-read (single tap) + mark-all-read button
- [x] Deep-linking: tap notification → navigates to relevant screen (live-board/coordinate)
- [x] Unread count badge + visual unread styling

---

## Phase 6: Owner Features
> **Status: 🔲 NOT STARTED**

### Mobile — Project Management
- [ ] Create project form (name, location, timeline, budget, team assignments)
- [ ] Edit project (budget history, team reassignments)
- [ ] Project detail view with cost breakdown + change history

### Mobile — Dashboard
- [ ] Live stat cards (active projects, teams, idle, pending actions)
- [ ] Budget vs. actual spend comparisons
- [ ] Drill-down to full cost breakdown

### Mobile — Settings
- [ ] Manage Users (create/edit with role assignment)
- [ ] Notification preferences

---

## Phase 7: Accountant Features
> **Status: 🔲 NOT STARTED**

### Mobile — Payment Queue
- [ ] Daily wages: attendance data → computed wages
- [ ] Milestone payments from completed tasks
- [ ] Lump-sum installment scheduling

### Mobile — Purchases
- [ ] All material purchases list
- [ ] Flag missing receipts & late entries

### Mobile — Reconciliation
- [ ] Petty cash per-supervisor view
- [ ] Reconcile batches before new floats

### Mobile — Cost Reports
- [ ] Per-project cost breakdown (labor vs. materials vs. budget)

---

## Phase 8: Notifications (FCM Push)
> **Status: 🔲 NOT STARTED**

- [ ] `src/config/firebase.ts` — FCM admin SDK
- [ ] Notification creation service (no-show, idle, overdue orders)
- [ ] Escalation engine: 24h cron → Owner notification
- [ ] Mobile FCM registration + permission handling
- [ ] In-app notification feed (all roles)

---

## Phase 9: Polish & Production Readiness
> **Status: 🔲 NOT STARTED**

- [ ] Photo compression (resize 1200px, JPEG 80%)
- [ ] Offline indicators throughout UI
- [ ] Error handling + retry logic
- [ ] Loading/empty/skeleton states
- [ ] App icon + splash screen
- [ ] EAS Build config (Android/iOS)
- [ ] Network connectivity hook (`useConnectivity`)

---

## Summary

| Phase | Description | Status |
|-------|-------------|--------|
| **1** | Foundation: monorepo, auth, data models, DB schemas | ✅ Done |
| **2** | Site Supervisor daily report flow | ✅ Done |
| **3** | Material orders + purchases + petty cash | ✅ Done |
| **4** | Sync engine (offline → server) | ✅ Done |
| **5** | Super Supervisor: live board, coordination, verification | ✅ Done |
| **6** | Owner: project management, dashboard, drill-down | 🔲 **Next** |
| **7** | Accountant: payment queue, reconciliation, cost reports | 🔲 Pending |
| **8** | Push notifications (FCM) | 🔲 Pending |
| **9** | Polish: compression, offline UX, error handling, build | 🔲 Pending |
