// ============================================================
// Crewly — Shared Types & Enums
// Single source of truth for both mobile app and backend.
// ============================================================

// ----------------------------------------------------------
// Enums
// ----------------------------------------------------------

/** User roles — determines dashboard, permissions, and data visibility */
export enum Role {
  OWNER = 'owner',
  SUPER_SUPERVISOR = 'super_supervisor',
  SITE_SUPERVISOR = 'site_supervisor',
  ACCOUNTANT = 'accountant',
}

/** Trade categories for teams */
export enum Trade {
  ELECTRIC = 'electric',
  PLUMBER = 'plumber',
  WOOD = 'wood',
  MASONRY = 'masonry',
  PAINTING = 'painting',
  TILING = 'tiling',
  HVAC = 'hvac',
  ROOFING = 'roofing',
  STEEL = 'steel',
  GLASS = 'glass',
  CEILING = 'ceiling',
  FLOORING = 'flooring',
  OTHER = 'other',
}

/** How a team gets paid on a specific site assignment */
export enum PaymentType {
  DAILY_WAGE = 'daily_wage',
  MILESTONE = 'milestone',
  LUMP_SUM = 'lump_sum',
}

/** Per-team attendance status in a daily report entry */
export enum AttendanceStatus {
  ON_TIME = 'on_time',
  HALF_DAY = 'half_day',
  EVENING_SHIFT = 'evening_shift',
  NO_SHOW = 'no_show',
}

/**
 * Morning roll-call — Site Supervisor marks who is physically on site
 * at the start of the day (separate from end-of-day AttendanceStatus).
 */
export enum MorningPresence {
  ON_SITE = 'on_site',
  NOT_ON_SITE = 'not_on_site',
  /** Scheduled for this site but not required today */
  NOT_NEEDED = 'not_needed',
}

/** Why a team isn't working — required when team is idle */
export enum IdleReason {
  MATERIAL_NOT_THERE = 'material_not_there',
  WAITING_ON_OTHER_TRADE = 'waiting_on_other_trade',
  NO_SHOW = 'no_show',
  WEATHER = 'weather',
  OTHER = 'other',
}

/** Material order status pipeline */
export enum MaterialOrderStatus {
  NEEDED = 'needed',
  ORDERED = 'ordered',
  WAITING_DELIVERY = 'waiting_delivery',
  RECEIVED_FULL = 'received_full',
  RECEIVED_PARTIAL = 'received_partial',
}

/** Project lifecycle */
export enum ProjectStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ON_HOLD = 'on_hold',
}

/** Offline sync status for locally-created records */
export enum SyncStatus {
  PENDING = 'pending',
  SYNCED = 'synced',
  CONFLICT = 'conflict',
}

/** Budget breakdown categories */
export enum BudgetCategory {
  LABOR = 'labor',
  MATERIALS = 'materials',
  EQUIPMENT = 'equipment',
  SUBCONTRACT = 'subcontract',
  OVERHEAD = 'overhead',
  CONTINGENCY = 'contingency',
}

/** Payment record types */
export enum PaymentRecordType {
  DAILY_WAGE = 'daily_wage',
  MILESTONE = 'milestone',
  LUMP_SUM_INSTALLMENT = 'lump_sum_installment',
  PETTY_CASH_TOPUP = 'petty_cash_topup',
}

/** Notification types */
export enum NotificationType {
  IDLE_TEAM = 'idle_team',
  NO_SHOW = 'no_show',
  MORNING_ABSENCE = 'morning_absence',
  MATERIAL_OVERDUE = 'material_overdue',
  ESCALATION_IDLE = 'escalation_idle',
  ESCALATION_NO_SHOW = 'escalation_no_show',
  TEAM_ASSIGNED = 'team_assigned',
  PETTY_CASH_RECONCILE = 'petty_cash_reconcile',
  OTHER = 'other',
}

// ----------------------------------------------------------
// Shared interfaces — used for API request/response contracts
// ----------------------------------------------------------

/** Budget broken down by category */
export interface BudgetBreakdown {
  [BudgetCategory.LABOR]?: number;
  [BudgetCategory.MATERIALS]?: number;
  [BudgetCategory.EQUIPMENT]?: number;
  [BudgetCategory.SUBCONTRACT]?: number;
  [BudgetCategory.OVERHEAD]?: number;
  [BudgetCategory.CONTINGENCY]?: number;
  /** Per-trade budgets (key = Trade enum value) */
  byTrade?: Partial<Record<Trade, number>>;
}

/** A single revision in budget or assignment history */
export interface ChangeRecord {
  previousValue: unknown;
  newValue: unknown;
  changedBy: string; // userId
  changedAt: string; // ISO date
  reason?: string;
}

/** A team entry within a daily report */
export interface TeamEntry {
  teamId: string | null; // null for local labor
  isLocalLabor: boolean;
  headcountPresent: number;
  attendanceStatus: AttendanceStatus;
  idleReason?: IdleReason | null;
  idleReasonNotes?: string;
  linkedMaterialOrderId?: string | null;
  taskWorkedOn: string;
  taskCompleted: boolean;
  remainingWorkNotes?: string;
  photos: string[]; // local URIs or remote URLs
  /** Start-of-day roll-call — who is physically on site right now */
  morningPresence?: MorningPresence | null;
  /** Headcount counted at morning check-in (when on site) */
  morningHeadcount?: number;
  /** Why absent / who to call — filled when not on site */
  morningNotes?: string;
  /** ISO timestamp when morning presence was last confirmed */
  morningCheckedAt?: string | null;
}

/** Float issuance record within PettyCash */
export interface FloatIssuance {
  amount: number;
  issuedDate: string; // ISO date
  issuedBy: string; // userId
}

/** Expense entry within PettyCash */
export interface PettyCashExpense {
  amount: number;
  date: string; // ISO date
  receiptPhoto?: string;
  description: string;
}

/** Material order status change record */
export interface StatusChange {
  status: MaterialOrderStatus;
  changedAt: string; // ISO date
  changedBy: string; // userId
}

/** Per-notification-type opt in/out, stored on the user record */
export type NotificationPreferences = Partial<Record<NotificationType, boolean>>;

/** Assignment history entry */
export interface AssignmentChange {
  action: 'assigned' | 'unassigned' | 'payment_type_changed';
  previousValue?: unknown;
  newValue?: unknown;
  changedBy: string; // userId
  changedAt: string; // ISO date
}

// ----------------------------------------------------------
// API request/response shapes
// ----------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    assignedSites: string[];
  };
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  assignedSites?: string[];
}

export interface ApiError {
  message: string;
  code?: string;
  field?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ----------------------------------------------------------
// Sync protocol types (WatermelonDB compatible)
// ----------------------------------------------------------

export interface SyncTableChanges {
  created: Record<string, unknown>[];
  updated: Record<string, unknown>[];
  deleted: string[];
}

export interface SyncPullResponse {
  changes: Record<string, SyncTableChanges>;
  timestamp: number;
}

export interface SyncPushRequest {
  changes: Record<string, SyncTableChanges>;
  lastPulledAt: number;
}

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

/** Fields that must be stripped from API responses for non-Owner/non-Accountant roles */
export const MONEY_FIELDS = [
  'budget',
  'budgetHistory',
  'amount',
  'agreedTotal',
  'amountPaidSoFar',
  'currentBalance',
  'floatIssued',
  'expenses', // PettyCash expenses contain amounts
  'dailyRate',
  'totalCost',
  'costBreakdown',
] as const;

/** Roles allowed to see financial data */
export const MONEY_VISIBLE_ROLES: Role[] = [Role.OWNER, Role.ACCOUNTANT];

/** Notification types are opt-in by default — used when a user has no saved preferences */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = Object.values(
  NotificationType
).reduce<NotificationPreferences>((acc, type) => {
  acc[type] = true;
  return acc;
}, {});

/** Threshold in days to flag a late material purchase entry */
export const LATE_PURCHASE_THRESHOLD_DAYS = 3;

/** Threshold in hours before escalating unresolved issues to Owner */
export const ESCALATION_THRESHOLD_HOURS = 24;

/** All WatermelonDB table names — single source of truth for sync */
export const TABLE_NAMES = {
  USERS: 'users',
  PROJECTS: 'projects',
  TEAMS: 'teams',
  TEAM_SITE_ASSIGNMENTS: 'team_site_assignments',
  DAILY_REPORTS: 'daily_reports',
  TASK_VERIFICATIONS: 'task_verifications',
  MATERIAL_ORDERS: 'material_orders',
  MATERIAL_PURCHASES: 'material_purchases',
  PETTY_CASH: 'petty_cash',
  PAYMENTS: 'payments',
  NOTIFICATIONS: 'notifications',
} as const;
