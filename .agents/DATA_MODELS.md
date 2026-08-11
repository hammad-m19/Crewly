# Data Models — Crewly

> Complete field reference for all 11 data models. Each exists as both a Mongoose schema (backend) and WatermelonDB model (mobile).

---

## Users

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Full name |
| `email` | string | Unique, used for login |
| `passwordHash` | string | bcrypt hash (backend only, never synced) |
| `phone` | string? | Optional |
| `role` | Role enum | `owner`, `super_supervisor`, `site_supervisor`, `accountant` |
| `assignedSites` | string[] | Project IDs (stored as JSON string in WatermelonDB) |
| `isActive` | boolean | Soft deactivation |
| `created_at` | number | Timestamp (ms) |
| `updated_at` | number | Timestamp (ms) |

---

## Projects

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Project name |
| `location` | string | Address/description |
| `startDate` | string | ISO date |
| `expectedEndDate` | string | ISO date |
| `status` | ProjectStatus | `active`, `completed`, `on_hold` |
| `budget` | BudgetBreakdown | 💰 JSON object — **MONEY-GATED** |
| `budgetHistory` | ChangeRecord[] | 💰 JSON array — **MONEY-GATED** |
| `siteSupervisorId` | string? | Assigned supervisor |
| `created_at` / `updated_at` | number | Timestamps |

---

## Teams

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Team name (e.g., "Umair's Electric Team") |
| `trade` | Trade enum | `electric`, `plumber`, `wood`, `masonry`, etc. |
| `defaultPaymentType` | PaymentType | `daily_wage`, `milestone`, `lump_sum` |
| `contactPhone` | string? | Team lead's phone |
| `isActive` | boolean | |
| `created_at` / `updated_at` | number | |

---

## Team Site Assignments

Links a team to a project (many-to-many with extra fields).

| Field | Type | Notes |
|-------|------|-------|
| `project_id` | string | FK → projects (indexed) |
| `team_id` | string | FK → teams (indexed) |
| `paymentType` | PaymentType | Can differ from team default |
| `assignedDate` | string | ISO date |
| `unassignedDate` | string? | Set when removed |
| `agreedTotal` | number? | 💰 Lump-sum only — **MONEY-GATED** |
| `assignmentHistory` | AssignmentChange[] | JSON array of changes |
| `created_at` / `updated_at` | number | |

---

## Daily Reports

| Field | Type | Notes |
|-------|------|-------|
| `project_id` | string | FK → projects (indexed) |
| `date` | string | YYYY-MM-DD (indexed) |
| `submittedBy` | string | FK → users |
| `teamEntries` | TeamEntry[] | JSON array — the core data |
| `syncStatus` | SyncStatus | `pending`, `synced`, `conflict` |
| `created_at` / `updated_at` | number | |

### TeamEntry (embedded in teamEntries)

```typescript
{
  teamId: string | null,        // null for local labor
  isLocalLabor: boolean,
  headcountPresent: number,
  attendanceStatus: AttendanceStatus,  // on_time, half_day, evening_shift, no_show
  idleReason?: IdleReason | null,      // material_not_there, waiting_on_other_trade, etc.
  idleReasonNotes?: string,
  linkedMaterialOrderId?: string | null,
  taskWorkedOn: string,
  taskCompleted: boolean,
  remainingWorkNotes?: string,
  photos: string[]              // Local URIs or uploaded URLs
}
```

---

## Task Verifications

| Field | Type | Notes |
|-------|------|-------|
| `daily_report_id` | string | FK → daily_reports (indexed) |
| `team_entry_index` | number | Index into teamEntries array |
| `verified_by` | string | FK → users (Super Supervisor) |
| `verified_at` | string | ISO datetime |
| `notes` | string | Optional verification notes |
| `created_at` / `updated_at` | number | |

---

## Material Orders

| Field | Type | Notes |
|-------|------|-------|
| `project_id` | string | FK → projects (indexed) |
| `requested_by` | string | FK → users |
| `material` | string | Material name/description |
| `quantity` | string | Quantity with unit (e.g., "50 bags") |
| `status` | MaterialOrderStatus | Pipeline: needed → ordered → waiting → received |
| `statusHistory` | StatusChange[] | JSON array |
| `orderedDate` | string? | When ordered |
| `expectedDeliveryDate` | string? | |
| `receivedDate` | string? | |
| `notes` | string | |
| `created_at` / `updated_at` | number | |

---

## Material Purchases

| Field | Type | Notes |
|-------|------|-------|
| `project_id` | string | FK → projects (indexed) |
| `purchased_by` | string | FK → users |
| `material` | string | What was purchased |
| `amount` | number | 💰 **MONEY-GATED** |
| `date` | string | Date of actual purchase |
| `logged_at` | number | When entered into app |
| `receipt_photo_url` | string? | Photo of receipt |
| `linked_material_order_id` | string? | FK → material_orders |
| `verified` | boolean | Accountant verified |
| `flagged_late` | boolean | Entry > 3 days after purchase |
| `notes` | string | |
| `created_at` / `updated_at` | number | |

**Sync conflict:** Server-wins (financial records never overwritten by client)

---

## Petty Cash

| Field | Type | Notes |
|-------|------|-------|
| `site_supervisor_id` | string | FK → users (indexed) |
| `project_id` | string | FK → projects (indexed) |
| `float_issued` | FloatIssuance[] | 💰 JSON array — **MONEY-GATED** |
| `expenses` | PettyCashExpense[] | 💰 JSON array — **MONEY-GATED** |
| `reconciled` | boolean | |
| `current_balance` | number | 💰 **MONEY-GATED** |
| `created_at` / `updated_at` | number | |

---

## Payments

| Field | Type | Notes |
|-------|------|-------|
| `project_id` | string | FK → projects (indexed) |
| `team_id` | string? | FK → teams |
| `type` | PaymentRecordType | `daily_wage`, `milestone`, `lump_sum_installment`, `petty_cash_topup` |
| `amount` | number | 💰 **MONEY-GATED** |
| `date` | string | |
| `paid_by` | string | FK → users |
| `linked_daily_report_id` | string? | For daily wage payments |
| `linked_team_site_assignment_id` | string? | For lump-sum installments |
| `notes` | string | |
| `created_at` / `updated_at` | number | |

**Sync conflict:** Server-wins (financial records never overwritten by client)

---

## Notifications

| Field | Type | Notes |
|-------|------|-------|
| `recipient_user_id` | string | FK → users (indexed) |
| `type` | NotificationType | `idle_team`, `no_show`, `material_overdue`, `team_assigned`, etc. |
| `project_id` | string? | Related project |
| `title` | string | |
| `message` | string | |
| `metadata` | string | JSON — extra context for deep linking |
| `is_read` | boolean | |
| `created_at` / `updated_at` | number | |

---

## 💰 Money-Gated Fields

These fields are listed in `MONEY_FIELDS` in `@crewly/shared`. They are **stripped** from API responses and sync data for users whose role is NOT in `MONEY_VISIBLE_ROLES` (Owner, Accountant).

```typescript
const MONEY_FIELDS = [
  'budget', 'budgetHistory', 'amount', 'agreedTotal',
  'amountPaidSoFar', 'currentBalance', 'floatIssued',
  'expenses', 'dailyRate', 'totalCost', 'costBreakdown'
];
```

---

## Field Naming: MongoDB vs WatermelonDB

MongoDB uses **camelCase** (`projectId`, `submittedBy`). WatermelonDB schema uses **snake_case** (`project_id`, `submitted_by`). The sync layer handles the mapping via `formatRecordForSync()` and WatermelonDB model `@field` decorators.
