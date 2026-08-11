# Mobile App Architecture — Crewly

> Detailed guide to the React Native / Expo mobile app internals.

---

## Navigation Structure (Expo Router)

File-based routing with role-based tab groups:

```
src/app/
├── _layout.tsx          # Root layout: DatabaseProvider, auth guard, auto-sync setup
├── index.tsx            # Entry redirect → role-based dashboard
│
├── (auth)/
│   ├── _layout.tsx      # Minimal layout (no tabs)
│   └── login.tsx        # Login form
│
├── (site)/              # Site Supervisor — Tab Navigator
│   ├── _layout.tsx      # Tab bar: Report, Materials, Petty Cash, Sync
│   ├── daily-report.tsx # ✅ BUILT — Multi-step daily report form
│   ├── materials.tsx    # ✅ BUILT — Materials hub (orders + purchases list)
│   ├── material-order.tsx    # ✅ BUILT — New material order form
│   ├── material-purchase.tsx # ✅ BUILT — New material purchase form
│   ├── petty-cash.tsx   # ✅ BUILT — Petty cash dashboard
│   └── sync-status.tsx  # ✅ BUILT — Manual sync trigger + status
│
├── (super)/             # Super Supervisor — Tab Navigator
│   ├── _layout.tsx      # Tab bar: Live Board, Coordinate, Verify, Notifications
│   ├── live-board.tsx   # ✅ BUILT — All projects + team status flags
│   ├── coordinate.tsx   # ✅ BUILT — Quick team-to-site assignment
│   ├── verify.tsx       # ✅ BUILT — Task verification queue
│   └── notifications.tsx # ✅ BUILT — In-app notification feed
│
├── (owner)/             # Owner — Tab Navigator (3 tabs + 3 hidden detail routes)
│   ├── _layout.tsx      # Tabs: Dashboard, Projects, Settings; detail routes use `href: null`
│   ├── dashboard.tsx    # ✅ BUILT — Stat cards, budget vs. actual, pending actions
│   ├── projects.tsx     # ✅ BUILT — Create/edit projects with budget breakdown
│   ├── project-detail.tsx    # ✅ BUILT — Cost drill-down + team assignments (hidden route)
│   ├── users.tsx        # ✅ BUILT — Manage users (hidden route)
│   ├── notification-prefs.tsx # ✅ BUILT — Per-type toggles (hidden route)
│   └── settings.tsx     # ✅ BUILT — Profile, links to users/notifications, sign out
│
└── (accountant)/        # Accountant — Tab Navigator
    ├── _layout.tsx      # Tab bar with placeholder screens
    ├── payment-queue.tsx    # 🔲 PLACEHOLDER
    ├── purchases.tsx        # 🔲 PLACEHOLDER
    ├── reconciliation.tsx   # 🔲 PLACEHOLDER
    └── cost-reports.tsx     # 🔲 PLACEHOLDER
```

---

## WatermelonDB Setup

### Database Instance (`db/index.ts`)
- Single `Database` instance with SQLite adapter
- JSI enabled for performance
- All 11 model classes registered

### Schema (`db/schema.ts`)
- Version 1 (initial)
- 11 tables mirroring MongoDB collections
- JSON arrays/objects stored as `string` type columns (parsed in models)
- Relations via foreign key columns (e.g., `project_id`, `team_id`)

### Models (`db/models/`)
- Each model extends `Model` from WatermelonDB
- Uses decorators: `@field`, `@readonly`, `@date`
- `static table = 'table_name'` must match schema and `TABLE_NAMES`

### Migrations (`db/migrations.ts`)
- Currently only version 1 (empty migration set)
- When adding columns: bump schema version AND add migration step

---

## State Management

### Auth Store (`store/authStore.ts`)
```typescript
interface AuthState {
  user: AuthUser | null;    // { id, name, email, role, assignedSites }
  token: string | null;     // JWT access token
  refreshToken: string | null;
  isInitialized: boolean;   // true after checking SecureStore
  isLoading: boolean;

  initialize(): Promise<void>;  // Called on app launch
  login(token, refreshToken, user): Promise<void>;
  logout(): Promise<void>;
  updateToken(token): Promise<void>;
}
```

Storage: `expo-secure-store` (encrypted, persists across app restarts)

### Sync Store (`store/syncStore.ts`)
```typescript
interface SyncState {
  pendingChangesCount: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
  isOnline: boolean;
  lastError: string | null;
}
```

---

## Sync Engine (`lib/sync.ts`)

### `performSync()`
1. Check connectivity via `NetInfo`
2. If offline → skip, set `isOnline: false`
3. Call `synchronize()` from WatermelonDB with:
   - **pullChanges:** `GET /api/sync/pull?last_pulled_at=<timestamp>` → returns delta
   - **pushChanges:** `POST /api/sync/push` → sends local changes
4. Update sync store on success/failure

### `setupAutoSync()`
- Listens to `NetInfo` connectivity events
- When transitioning from offline → online, triggers `performSync()`
- Called once from root `_layout.tsx` after auth is initialized

### Lifecycle
```
App Launch → _layout.tsx
  → authStore.initialize() (restore tokens from SecureStore)
  → if authenticated:
      → setupAutoSync() (listen for connectivity)
      → performSync() (initial sync)
  → if not authenticated:
      → redirect to login
```

---

## API Client (`lib/api.ts`)

```typescript
apiFetch<T>(endpoint, options?) → Promise<{ success, data?, error? }>
```

- Prepends base URL (localhost:3000/api for dev)
- Auto-injects auth header from `authStore`
- On 401 `TOKEN_EXPIRED`: auto-refresh token, retry request
- On refresh failure: force logout
- On network error: returns `{ success: false, error: { code: 'NETWORK_ERROR' } }`

**Base URL logic:**
- iOS simulator: `http://localhost:3000/api`
- Android emulator: `http://10.0.2.2:3000/api`
- Production: `https://api.crewly.app/api`

---

## Hidden Routes in Tab Groups

Expo Router turns every file in a group into a route, and by default each one gets a
tab. Detail screens that should only be reachable by navigation must be declared with
`href: null`:

```tsx
<Tabs.Screen name="project-detail" options={{ href: null, title: 'Project Costs' }} />
```

Typed routes are enabled (`app.json` → `experiments.typedRoutes`), so `.expo/types/router.d.ts`
is regenerated by the dev server. After adding a screen, `tsc --noEmit` will reject
`router.push('/(owner)/new-screen')` until the dev server has run once.

---

## Shared Helpers

### `lib/format.ts`
`formatMoney` ("Rs 1,250,000"), `formatMoneyCompact` ("Rs 1.3L"), `humanize`
(`daily_wage` → "Daily wage"), `formatDate`, `todayIso`, `isValidDateInput`.

### `components/ui/ProgressBar.tsx`
Budget bar plus `statusColor(percent)` — green under 85%, amber to 100%, red beyond.

---

## Theme System

### Colors (`theme/colors.ts`)
Primary palette, semantic colors (success, warning, danger, info), background shades, text colors.

### Typography (`theme/typography.ts`)
Font sizes, weights, line heights. System fonts (no custom fonts yet).

### Spacing (`theme/spacing.ts`)
Standard spacing scale (4, 8, 12, 16, 20, 24, 32, 40, 48).

---

## Photo Handling (`lib/photoSync.ts`)

- `PhotoSyncQueue` class with in-memory queue
- Tasks: `{ localUri, endpoint, metadata, status }`
- Uploads via `expo-file-system` `uploadAsync()` (multipart)
- ⚠️ Queue is in-memory only — does NOT survive app restarts
- Phase 9 TODO: persist queue + add retry logic
