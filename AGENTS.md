# Crewly — Agent Onboarding Guide

> **Read this file first.** It contains everything you need to understand the project, make changes, and continue development. You do NOT need to read every source file — this document covers architecture, patterns, conventions, and the current state of the project.

---

## What Is Crewly?

Crewly is a **construction company management app** — an offline-first mobile app (React Native/Expo) backed by a Node.js API (Express + MongoDB). It manages daily site operations: team attendance, material orders, payments, and cost tracking.

**The core idea:** Site Supervisors fill out daily reports on their phones (even offline). Data syncs to the server when connectivity returns. Super Supervisors verify work. Owners and Accountants see financials.

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| **Monorepo** | npm workspaces | `apps/*` + `packages/*` |
| **Mobile** | Expo SDK 57 + Expo Router | React Native 0.86, file-based routing |
| **Local DB** | WatermelonDB | SQLite adapter, offline-first with sync |
| **State** | Zustand | `authStore`, `syncStore` |
| **Backend** | Express 4 + TypeScript | `tsx watch` for dev |
| **Database** | MongoDB + Mongoose | 11 collections |
| **Auth** | JWT (access + refresh tokens) | `expo-secure-store` on mobile |
| **Shared** | `@crewly/shared` package | Enums, types, constants shared between mobile & backend |

---

## Project Structure

```
Crewly/
├── package.json                    # Monorepo root (npm workspaces)
├── tsconfig.json                   # Root TS config (references backend + shared)
├── PROGRESS.md                     # Phase-by-phase progress tracker
├── AGENTS.md                       # ← YOU ARE HERE
│
├── packages/
│   └── shared/                     # @crewly/shared — single source of truth
│       └── src/index.ts            # Enums, interfaces, constants, TABLE_NAMES, MONEY_FIELDS
│
├── apps/
│   ├── backend/                    # Express API server
│   │   ├── .env / .env.example     # Environment config
│   │   ├── package.json            # Dependencies (express, mongoose, jwt, etc.)
│   │   └── src/
│   │       ├── server.ts           # Express app + route mounting + middleware chain
│   │       ├── config/
│   │       │   ├── db.ts           # MongoDB connection (mongoose.connect)
│   │       │   ├── auth.ts         # JWT secrets, expiry, salt rounds
│   │       │   └── firebase.ts     # Optional Firebase Admin (FCM); no-op without creds
│   │       ├── services/
│   │       │   ├── notify.ts       # In-app Notification + optional FCM (respects prefs)
│   │       │   └── escalation.ts   # Hourly material-overdue + 24h idle/no-show → Owner
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT verification → req.user (AuthRequest)
│   │       │   ├── roleGuard.ts    # requireRole(Role.OWNER, ...) factory
│   │       │   └── moneyFilter.ts  # Strips budget/cost fields for non-Owner/Accountant
│   │       ├── models/             # Mongoose schemas (11 models)
│   │       │   ├── User.ts, Project.ts, Team.ts, TeamSiteAssignment.ts
│   │       │   ├── DailyReport.ts, TaskVerification.ts
│   │       │   ├── MaterialOrder.ts, MaterialPurchase.ts
│   │       │   ├── PettyCash.ts, Payment.ts, Notification.ts
│   │       │   └── index.ts       # Re-exports all models
│   │       ├── routes/             # API route handlers
│   │       │   ├── auth.ts         # POST /login, /register, /refresh
│   │       │   ├── sync.ts         # GET /pull, POST /push (WatermelonDB sync protocol)
│   │       │   ├── projects.ts, teams.ts, dailyReports.ts
│   │       │   ├── materialOrders.ts, materialPurchases.ts
│   │       │   ├── pettyCash.ts, verification.ts
│   │       │   ├── coordination.ts, notifications.ts
│   │       │   ├── owner.ts        # Dashboard aggregation + cost breakdown (Owner only)
│   │       │   ├── users.ts        # User management + notification prefs + FCM token
│   │       │   └── (each route is mounted in server.ts under /api/*)
│   │       └── scripts/
│   │           └── seed.ts         # Creates initial users + sample teams
│   │
│   └── mobile/                     # Expo + React Native app
│       ├── package.json            # Dependencies (expo, watermelondb, zustand, etc.)
│       ├── app.json                # Expo config (icon/splash still placeholder assets)
│       ├── eas.json                # EAS Build: development / preview / production
│       ├── babel.config.js         # Babel with decorators (for WatermelonDB)
│       └── src/
│           ├── app/                # Expo Router — file-based routing
│           │   ├── _layout.tsx     # Root: DatabaseProvider, auth guard, auto-sync, offline banner, push register
│           │   ├── index.tsx       # Redirect by role
│           │   ├── (auth)/         # Login screen
│           │   ├── (site)/         # Site Supervisor (tabs + hidden forms + Alerts)
│           │   ├── (super)/        # Super Supervisor (Live Board, Coordinate, Verify, Alerts)
│           │   ├── (owner)/        # Owner (3 tabs + hidden detail/alerts/prefs routes)
│           │   └── (accountant)/   # Accountant (Payments, Purchases, Reconcile, Reports, Alerts)
│           ├── db/
│           │   ├── index.ts        # WatermelonDB Database instance
│           │   ├── schema.ts       # SQLite schema (11 tables, mirrors MongoDB)
│           │   ├── migrations.ts   # Schema migrations (currently v1)
│           │   └── models/         # WatermelonDB Model classes (11 models)
│           ├── lib/
│           │   ├── api.ts          # apiFetch() — auth, token refresh, GET retry/backoff
│           │   ├── sync.ts         # performSync(), setupAutoSync() — WatermelonDB ↔ backend
│           │   ├── photoSync.ts    # Photo queue (compress + persist + upload)
│           │   └── pushNotifications.ts  # Permission + FCM/APNs token → PATCH /users/me/fcm-token
│           ├── hooks/
│           │   └── useConnectivity.ts    # Offline/last-sync helpers from syncStore
│           ├── store/
│           │   ├── authStore.ts    # Zustand — user, token, login/logout (SecureStore)
│           │   └── syncStore.ts    # Zustand — isSyncing, isOnline, lastSyncAt, errors
│           ├── theme/
│           │   ├── colors.ts       # Color palette (primary, semantic, background)
│           │   ├── typography.ts   # Font sizes, weights, line heights
│           │   └── spacing.ts      # Spacing scale
│           └── components/         # Shared UI: NotificationsFeed, ErrorState, EmptyState, LoadingSkeleton
```

---

## Four User Roles

Every feature is scoped to a role. The role determines which screens, data, and actions are available.

| Role | Dashboard Route | What They Do |
|------|----------------|--------------|
| **Owner** | `/(owner)/dashboard` | Create projects, set budgets, manage users, see cost breakdowns |
| **Super Supervisor** | `/(super)/live-board` | Monitor all sites, verify completed tasks, coordinate team assignments |
| **Site Supervisor** | `/(site)/daily-report` | Submit daily reports, request materials, manage petty cash |
| **Accountant** | `/(accountant)/payment-queue` | Process payments, reconcile petty cash, generate cost reports |

---

## Data Model (11 Collections/Tables)

All 11 entities exist as both **Mongoose models** (backend) and **WatermelonDB models** (mobile). The table names are defined once in `@crewly/shared` → `TABLE_NAMES`.

| Table | Purpose | Key Relations |
|-------|---------|---------------|
| `users` | App users with roles | — |
| `projects` | Construction sites | Has budget (money-gated) |
| `teams` | Contractor teams by trade | — |
| `team_site_assignments` | Which team is on which project | → project, → team |
| `daily_reports` | Daily attendance + work log | → project, has TeamEntry[] |
| `task_verifications` | Super Supervisor verification stamps | → daily_report |
| `material_orders` | Material request pipeline | → project |
| `material_purchases` | Actual material purchases + receipts | → project, → material_order |
| `petty_cash` | Float tracking per supervisor | → project, → user |
| `payments` | Payment records (wages, milestones) | → project, → team |
| `notifications` | In-app notifications | → user (recipient) |

---

## Critical Architectural Patterns

### 1. Money Field Security (Defense-in-Depth)

Financial fields (`budget`, `amount`, `currentBalance`, etc.) are **never** sent to Site Supervisors or Super Supervisors. This is enforced at **two independent layers**:

- **Layer 1 — `moneyFilter` middleware** (`middleware/moneyFilter.ts`): Intercepts `res.json()` and recursively strips fields listed in `MONEY_FIELDS` for non-`MONEY_VISIBLE_ROLES`.
- **Layer 2 — Sync pull per-record stripping** (`routes/sync.ts` → `formatRecordForSync()`): Independently strips money fields when building sync deltas.

**Rule:** Both layers must ALWAYS be present. Never remove one assuming the other will handle it.

### 2. Offline-First Sync (WatermelonDB Protocol)

```
Mobile (WatermelonDB/SQLite)  ←→  Backend (MongoDB)
         Pull: GET /api/sync/pull?last_pulled_at=<timestamp>
         Push: POST /api/sync/push { changes, lastPulledAt }
```

- **Pull:** Backend queries each collection for records created/updated/deleted since `last_pulled_at`, filtered by role.
- **Push:** Client sends local changes. Conflict resolution: **server-wins** for `payments` + `material_purchases` (financial data), **client-wins** for everything else.
- **Auto-sync** triggers on: app launch (after auth), network reconnection, manual pull-to-refresh.

### 3. API Response Format

**All endpoints MUST return this shape:**
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "message": "...", "code": "..." } }
```
The mobile `apiFetch()` client checks `result.success` — if your endpoint doesn't wrap the response, the client will treat it as a failure. (This exact bug was just fixed in the sync pull endpoint.)

### 4. Auth Flow

1. User logs in via `POST /api/auth/login` → gets JWT `token` + `refreshToken`
2. Tokens stored in `expo-secure-store` (encrypted on-device)
3. `apiFetch()` auto-injects `Authorization: Bearer <token>` header
4. On 401 with `TOKEN_EXPIRED` code → auto-refresh via `POST /api/auth/refresh`
5. If refresh fails → force logout
6. On app relaunch → `authStore.initialize()` restores tokens from SecureStore

### 5. Navigation Guard

`_layout.tsx` has a `useEffect` that watches auth state:
- Not logged in → redirect to `/(auth)/login`
- Logged in → redirect to role-specific dashboard (using `getRoleRoute()`)

---

## Running the Project

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally (default: `mongodb://localhost:27017/crewly`)
- Xcode (for iOS simulator)
- CocoaPods (for iOS native deps)

### Commands (from monorepo root)

```bash
# Install dependencies
npm install

# Seed the database (creates initial users + teams)
npm run backend:seed

# Start the backend (hot-reload with tsx)
npm run backend:dev

# Start the mobile app (Expo)
npm run mobile:start
```

### Seed Accounts (all use password: `crewly2024`)

| Email | Role |
|-------|------|
| `owner@crewly.com` | Owner |
| `super@crewly.com` | Super Supervisor |
| `site@crewly.com` | Site Supervisor |
| `accountant@crewly.com` | Accountant |

### Environment Variables

Copy `apps/backend/.env.example` → `apps/backend/.env`. Key vars:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — Change in production
- `PORT` — API port (default 3000)
- `FIREBASE_SERVICE_ACCOUNT_PATH` / `GOOGLE_APPLICATION_CREDENTIALS` — optional; without either, FCM is a no-op
- `DISABLE_ESCALATION` — set `true` in tests so the hourly loop does not run (scripts call `runEscalationCheck()` directly)

---

## What's Done vs. What's Next

### ✅ Completed (Phases 1–9)

| Phase | What |
|-------|------|
| 1 | Full monorepo setup, all data models (Mongoose + WatermelonDB), auth system, shared types |
| 2 | Site Supervisor daily report flow (multi-step form with team entries, attendance, photos) |
| 3 | Material orders pipeline, material purchases with receipts, petty cash management |
| 4 | WatermelonDB sync engine (pull/push with role filtering + money stripping) |
| 5 | Super Supervisor: live board, team coordination, task verification, notifications |
| 6 | Owner: dashboard with budget vs. actual, project CRUD with budget history, cost drill-down, user management, notification preferences |
| 7 | Accountant: payment queue (wages/milestones/lump-sums), purchases review, petty cash reconciliation, cost reports |
| 8 | Push notifications: optional FCM, `notify`/`notifyRole`, hourly escalation, in-app feed for all roles |
| 9 | Polish: photo compression + persistent queue, offline banner, GET retry, skeleton/error/empty states, EAS Build |

Phase 6 added two backend routers (`routes/owner.ts`, `routes/users.ts`) plus three new
mobile screens (`project-detail.tsx`, `users.tsx`, `notification-prefs.tsx`). Spend
figures are always derived from `payments` / `material_purchases` / `petty_cash` — see
`.agents/DATA_MODELS.md` → "Derived Values".

Phase 7 added `routes/payments.ts` and `routes/accountant.ts` (both Accountant/Owner,
mounted with `moneyFilter`), `Team.dailyRate` (money-gated, settable via
`PATCH /teams/:id`), the shared spend helper `src/lib/costs.ts` (used by owner AND
accountant routes — change it in one place), and built out all four
`(accountant)/` screens against those endpoints. Integration test:
`apps/backend/test-accountant-endpoints.ts` (needs the API + MongoDB running).

Phase 8 added `config/firebase.ts` (optional Admin SDK), `services/notify.ts` (in-app
row + FCM when creds and prefs allow), `services/escalation.ts` (hourly material
overdue + 24h idle/no-show to Owner, idempotent keys), `PATCH /users/me/fcm-token`,
and a shared `NotificationsFeed` on every role. Integration test:
`apps/backend/test-notifications.ts` (11 assertions; needs the API + MongoDB).

Phase 9 fixed photo upload (`expo-file-system/legacy` + AsyncStorage queue +
`expo-image-manipulator` 1200px JPEG 0.8), added `useConnectivity` + a global
offline banner, GET retry/backoff in `apiFetch`, shared Error/Empty/Skeleton
states on the main dashboards, and `eas.json` (dev/preview/production).

### Leftovers (not a new phase)

- Branded app icon + splash — `app.json` still points at Expo placeholder assets
- Real FCM on a physical device — needs Firebase service-account env vars on the API and an EAS/dev-client build (simulators skip; Expo Go is limited)

All planned phases (1–9) are complete.

---

## Known Issues & Recent Fixes

1. **Sync pull response format (FIXED 2026-08-11):** The backend `/api/sync/pull` was returning `{ changes, timestamp }` directly instead of `{ success: true, data: { changes, timestamp } }`. The mobile `apiFetch` client checks `result.success`, so sync always failed. Fixed by wrapping the response.

2. **`photoSync.ts` compile / persistence (FIXED Phase 9):** uploads use
   `expo-file-system/legacy` (`FileSystemUploadType.MULTIPART`). The queue is
   persisted in AsyncStorage (`@crewly/photo_upload_queue`) and hydrated from
   root `_layout.tsx` after auth. Photos are compressed (1200px long edge, JPEG 0.8)
   before enqueue. Mobile `tsc --noEmit` is clean.

3. **Accountant screens read money data:** Accountant is in `MONEY_VISIBLE_ROLES`,
   so the Phase 7 endpoints work without money-filter changes — but never widen
   that constant to add other roles. Note `/api/teams` is now mounted WITH
   `moneyFilter` because teams carry `dailyRate`; keep it that way.

4. **Seed account passwords can drift:** the Owner user-management screen (and its
   tests) can change seed passwords, and `seed.ts` skips existing users. Integration
   tests therefore create their own throwaway supervisor accounts
   (`*@crewly.test`) instead of logging in as `site@crewly.com`. If you need the
   seed logins manually and they fail, reset via the Owner users screen.

5. **Leftovers after Phase 9:** branded icon/splash still use Expo placeholder
   assets in `app.json`. Real FCM delivery needs Firebase credentials on the API
   and a physical device / EAS build (simulators skip registration; Expo Go is limited).

---

## Conventions & Rules

### Code Style
- **TypeScript everywhere** — strict mode, no `any` where avoidable
- **Enums and constants** in `@crewly/shared` — never hardcode role strings, table names, etc.
- **WatermelonDB decorators** — models use `@field`, `@readonly`, `@date` decorators (requires babel decorator plugin)

### File Naming
- Backend models: `PascalCase.ts` (e.g., `DailyReport.ts`)
- Mobile models: `PascalCaseModel.ts` (e.g., `DailyReportModel.ts`)
- Routes: `camelCase.ts` (e.g., `dailyReports.ts`)
- Screens: `kebab-case.tsx` (e.g., `daily-report.tsx`)

### API Patterns
- All routes in `routes/` export a Router
- Routes mounted in `server.ts` with middleware chain: `authenticate` → optional `moneyFilter` → router
- Use `requireRole()` inside route handlers for role-specific endpoints
- Always return `{ success: true/false, data/error }` format

### Mobile Patterns
- Screens in `src/app/(role)/screen-name.tsx` — Expo Router file-based routing
- Each role group has its own `_layout.tsx` with tab navigation
- Database reads: use WatermelonDB queries/observables
- API calls: always through `apiFetch()` from `lib/api.ts`
- State: Zustand stores for auth and sync state; WatermelonDB for all domain data

### Adding a New Data Model
1. Add enum/interface to `packages/shared/src/index.ts`
2. Add table name to `TABLE_NAMES`
3. Create Mongoose model in `apps/backend/src/models/`
4. Create WatermelonDB model in `apps/mobile/src/db/models/`
5. Add to schema in `apps/mobile/src/db/schema.ts`
6. Register in `apps/mobile/src/db/index.ts` (modelClasses array)
7. Add to sync `modelMap` in `apps/backend/src/routes/sync.ts`
8. Bump schema version + add migration if needed

