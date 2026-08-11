# Gotchas, Pitfalls & Critical Rules

> Things that will bite you if you don't know about them. Read this before making changes.

---

## 🔴 Critical: API Response Format

**Every endpoint MUST return:**
```json
{ "success": true, "data": { ... } }
// or
{ "success": false, "error": { "message": "...", "code": "..." } }
```

The mobile `apiFetch()` client checks `result.success`. If you return raw data without the wrapper, the client treats it as a failure. This exact bug already happened with the sync pull endpoint (Aug 2026).

---

## 🔴 Critical: Money Field Security

Two independent layers enforce financial data hiding. **Never remove or weaken either:**

1. `moneyFilter` middleware on `res.json()` — response-level stripping
2. `formatRecordForSync()` in sync pull — per-record stripping

If you add a new money-related field, you MUST add it to `MONEY_FIELDS` in `packages/shared/src/index.ts`.

---

## 🔴 Critical: Sync Model Registration

When adding a new data model, you must update ALL of these locations:
1. `packages/shared/src/index.ts` → `TABLE_NAMES`
2. `apps/backend/src/models/` → new Mongoose model
3. `apps/backend/src/routes/sync.ts` → `modelMap`
4. `apps/mobile/src/db/schema.ts` → new table in `appSchema`
5. `apps/mobile/src/db/models/` → new WatermelonDB model
6. `apps/mobile/src/db/models/index.ts` → re-export
7. `apps/mobile/src/db/index.ts` → `modelClasses` array

Missing any one of these causes silent sync failures or crashes.

---

## ⚠️ WatermelonDB Schema Versioning

- Current version: **1**
- If you add/remove/rename columns, you MUST:
  1. Bump the version number in `schema.ts`
  2. Add a migration step in `migrations.ts`
  3. Test on a device that has the old schema installed
- If you don't do this, the app will crash on existing installations

---

## ⚠️ JSON String Columns in WatermelonDB

WatermelonDB (SQLite) doesn't support nested objects or arrays. These are stored as JSON strings:
- `teamEntries` → `string` (array of TeamEntry objects)
- `assignmentHistory` → `string` (array of ChangeRecord)
- `statusHistory` → `string` (array of StatusChange)
- `budget` → `string` (BudgetBreakdown object)
- `floatIssued` → `string` (array of FloatIssuance)
- `expenses` → `string` (array of PettyCashExpense)
- `assignedSites` → `string` (array of project IDs)
- `metadata` → `string` (notification metadata)

Always `JSON.parse()` when reading and `JSON.stringify()` when writing.

---

## ⚠️ MongoDB `_id` vs WatermelonDB `id`

- MongoDB uses `_id` (ObjectId)
- WatermelonDB uses `id` (string UUID)
- The sync layer converts `_id → id` in `formatRecordForSync()`
- When pushing changes, the backend maps `record.id || record._id`
- Never assume one format — always handle both

---

## ⚠️ Sync Conflict Resolution

- **Server-wins tables:** `payments`, `material_purchases` — if server has newer `updated_at`, client changes are dropped
- **Client-wins tables:** everything else — last write wins

This is critical for financial integrity. Never change the conflict strategy for financial tables.

---

## ⚠️ `_deleted` Soft Deletes

MongoDB records are never physically deleted. Instead, `_deleted: true` is set. The sync pull includes deleted record IDs so WatermelonDB can mark them locally. Always include `_deleted: false` in queries.

---

## ⚠️ Adding Fields to Mongoose Models That Sync

Extra fields on a Mongoose model are safe: sync pull sends them, and WatermelonDB
discards keys that aren't declared in its table schema (this is why `passwordHash`,
`fcmToken`, and `notificationPrefs` never reach the device tables). You only need a
schema version bump + migration when you want a field **stored on the device**.

---

## ⚠️ Expo Router: New Screens Break `tsc` Until Types Regenerate

Typed routes are on, so route strings are checked against
`apps/mobile/.expo/types/router.d.ts`, which only the dev server regenerates. After
adding a screen, `npx tsc --noEmit` reports "not assignable" for the new path until
`npx expo start` has run once. Also remember new files in a tab group become tabs
unless declared with `options={{ href: null }}`.

---

## ⚠️ Photo Queue Persistence

The `PhotoSyncQueue` in `lib/photoSync.ts` is **in-memory only**. If the app is killed during upload, pending photos are lost. This is a known limitation to be fixed in Phase 9.

---

## ⚠️ Auth Token Handling

- `apiFetch()` auto-handles token refresh on 401 + `TOKEN_EXPIRED`
- If you add a new auth-required endpoint, DON'T handle auth manually — let `apiFetch()` do it
- For endpoints that skip auth (login, refresh), pass `{ skipAuth: true }`

---

## ⚠️ Route Order in `server.ts`

Route mounting order matters:
1. Health check (public) must come first
2. Auth routes must come before the global authenticate middleware usage
3. All other routes use `authenticate` middleware

Don't rearrange without understanding the implications.

---

## ⚠️ iOS Simulator vs Physical Device API URL

- iOS Simulator: `localhost:3000` works (shares host network)
- Android Emulator: must use `10.0.2.2:3000` (emulator → host mapping)
- Physical device: must use your machine's LAN IP (e.g., `192.168.x.x:3000`)

This is handled in `lib/api.ts` → `getDevApiBaseUrl()`, but only for simulators. Physical device testing requires manually setting the IP.
