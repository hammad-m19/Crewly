# Crewly — Project Progress Tracker

> Construction Company Management App — Offline-first mobile + backend
> Last updated: 2026-08-12 (Phase 7 complete)

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
> **Status: ✅ COMPLETE**

### Backend
- [x] `routes/owner.ts` — Owner-only aggregation endpoints
  - [x] `GET /owner/dashboard` — company summary, pending actions, per-project budget vs. actual
  - [x] `GET /owner/projects/:id/cost-breakdown` — category/trade actuals, transactions, budget audit trail
- [x] `routes/users.ts` — user management + notification preferences
  - [x] `GET /users` (Owner), `POST /users` (Owner), `PATCH /users/:id` (Owner)
  - [x] `GET|PATCH /users/me/notification-prefs` (any role)
- [x] `models/User.ts` — added `notificationPrefs`
- [x] `packages/shared` — `NotificationPreferences` + `DEFAULT_NOTIFICATION_PREFERENCES`
- [x] `server.ts` — mounted `/api/owner` (with moneyFilter) and `/api/users`
- [x] Integration test (`test-owner-endpoints.ts`) — 31 assertions, verified

### Mobile — Dashboard (`(owner)/dashboard.tsx`)
- [x] Live stat cards (active projects, teams working, idle teams, pending actions)
- [x] Company-wide budget vs. actual with progress bar + over-budget count
- [x] "Needs Attention" panel (unverified tasks, overdue deliveries, missing receipts, unreconciled floats)
- [x] Per-project spend cards with status flags; active sites listed before inactive
- [x] Drill-down to full cost breakdown + pull-to-refresh + refresh on focus

### Mobile — Project Management (`(owner)/projects.tsx`)
- [x] Create project (name, location, timeline, status, supervisor, budget by category)
- [x] Edit project with live budget total; reason captured when the budget changes
- [x] Budget change count/date surfaced per project card
- [x] Validation: required fields, date format, end-after-start, positive amounts

### Mobile — Project Detail (`(owner)/project-detail.tsx`)
- [x] Budget vs. actual by category, plus labor split by trade
- [x] Labor / materials / petty cash split + petty cash on hand
- [x] Team assignments: assign (with lump-sum agreed total) and unassign
- [x] Recent transactions with review flags for missing receipts / late entries
- [x] Budget change history with author, date, and reason

### Mobile — Settings
- [x] Manage Users (`(owner)/users.tsx`) — create/edit, role assignment, site assignment,
      activate/deactivate, password reset; self-demotion and self-deactivation blocked
- [x] Notification preferences (`(owner)/notification-prefs.tsx`) — per-type toggles, optimistic save
- [x] `settings.tsx` wired to both screens; detail routes hidden from the tab bar

### Shared UI
- [x] `components/ui/ProgressBar.tsx` — budget bar that shifts green → amber → red
- [x] `lib/format.ts` — money, compact money, date, and label formatters

---

## Phase 7: Accountant Features
> **Status: ✅ COMPLETE**

### Backend
- [x] `models/Team.ts` — added `dailyRate` (money-gated; already listed in `MONEY_FIELDS`)
- [x] `routes/teams.ts` — `PATCH /teams/:id` (Owner manages details; Accountant may set `dailyRate`)
- [x] `routes/payments.ts` — `GET /payments` + `POST /payments` (Accountant/Owner)
  - [x] Duplicate guard: one payment per (report, team, type) → 409
  - [x] Lump-sum guard: installments cannot exceed the assignment's `agreedTotal`
- [x] `routes/accountant.ts` — aggregation endpoints (Accountant/Owner)
  - [x] `GET /accountant/payment-queue` — unpaid wages (headcount × dailyRate, half for half-days),
        verified-but-unpaid milestones, outstanding lump-sum balances (30-day report lookback)
  - [x] `GET /accountant/purchases` — purchases with names resolved + missing-receipt/late/unverified counts
  - [x] `GET /accountant/reconciliation` — petty cash batches per supervisor + float-form options
  - [x] `GET /accountant/cost-reports` — per-project labor/materials/petty cash vs. budget
- [x] `lib/costs.ts` — shared spend/budget helpers (used by both owner + accountant routes)
- [x] `server.ts` — mounted `/api/payments` + `/api/accountant`; added missing `moneyFilter` to `/api/teams`
- [x] Integration test (`test-accountant-endpoints.ts`) — 25 assertions, verified

### Mobile — Payment Queue (`(accountant)/payment-queue.tsx`)
- [x] Daily wages: attendance data → suggested amount (headcount × daily rate)
- [x] Milestone payments from verified completed tasks
- [x] Lump-sum installments with paid-so-far / remaining
- [x] Record-payment sheet (amount prefilled, date, notes) with server-side duplicate/overpay guards

### Mobile — Purchases (`(accountant)/purchases.tsx`)
- [x] All material purchases with project + purchaser names
- [x] Filters: missing receipts, late entries, unverified
- [x] One-tap verify per purchase

### Mobile — Reconciliation (`(accountant)/reconciliation.tsx`)
- [x] Petty cash batches per supervisor (float, spent, balance, expandable expenses)
- [x] Reconcile with confirmation; new float blocked until previous batch reconciled
- [x] Issue-float sheet (supervisor + project + amount)

### Mobile — Cost Reports (`(accountant)/cost-reports.tsx`)
- [x] Company totals with labor/materials/petty cash split
- [x] Per-project budget vs. actual with per-category progress bars

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
| **6** | Owner: project management, dashboard, drill-down | ✅ Done |
| **7** | Accountant: payment queue, reconciliation, cost reports | ✅ Done |
| **8** | Push notifications (FCM) | 🔲 **Next** |
| **9** | Polish: compression, offline UX, error handling, build | 🔲 Pending |
