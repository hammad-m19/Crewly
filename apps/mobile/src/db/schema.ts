import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * WatermelonDB Schema — mirrors the MongoDB collections but adapted for SQLite.
 *
 * Key differences from MongoDB:
 * - No nested objects/arrays as columns — those are stored as JSON strings
 * - Relations are handled via foreign key columns
 * - _status and _changed are managed by WatermelonDB for sync
 * - All tables have created_at and updated_at for sync delta queries
 */
export const schema = appSchema({
  version: 1,
  tables: [
    // ── Users ─────────────────────────────────────────────
    tableSchema({
      name: 'users',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'role', type: 'string' },
        { name: 'assigned_sites', type: 'string' }, // JSON array of project IDs
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Projects ──────────────────────────────────────────
    tableSchema({
      name: 'projects',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'location', type: 'string' },
        { name: 'start_date', type: 'string' },
        { name: 'expected_end_date', type: 'string' },
        { name: 'status', type: 'string' }, // ProjectStatus enum
        { name: 'budget', type: 'string' }, // JSON object — stripped for non-money roles
        { name: 'budget_history', type: 'string' }, // JSON array — stripped for non-money roles
        { name: 'site_supervisor_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Teams ─────────────────────────────────────────────
    tableSchema({
      name: 'teams',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'trade', type: 'string' }, // Trade enum
        { name: 'default_payment_type', type: 'string' }, // PaymentType enum
        { name: 'contact_phone', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Team-Site Assignments ─────────────────────────────
    tableSchema({
      name: 'team_site_assignments',
      columns: [
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'team_id', type: 'string', isIndexed: true },
        { name: 'payment_type', type: 'string' }, // PaymentType enum
        { name: 'assigned_date', type: 'string' },
        { name: 'unassigned_date', type: 'string', isOptional: true },
        { name: 'agreed_total', type: 'number', isOptional: true }, // Lump-sum only
        { name: 'assignment_history', type: 'string' }, // JSON array
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Daily Reports ─────────────────────────────────────
    tableSchema({
      name: 'daily_reports',
      columns: [
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'date', type: 'string', isIndexed: true }, // YYYY-MM-DD
        { name: 'submitted_by', type: 'string' },
        { name: 'team_entries', type: 'string' }, // JSON array of TeamEntry objects
        { name: 'sync_status', type: 'string' }, // SyncStatus enum
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Task Verifications ────────────────────────────────
    tableSchema({
      name: 'task_verifications',
      columns: [
        { name: 'daily_report_id', type: 'string', isIndexed: true },
        { name: 'team_entry_index', type: 'number' },
        { name: 'verified_by', type: 'string' },
        { name: 'verified_at', type: 'string' },
        { name: 'notes', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Material Orders ───────────────────────────────────
    tableSchema({
      name: 'material_orders',
      columns: [
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'requested_by', type: 'string' },
        { name: 'material', type: 'string' },
        { name: 'quantity', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true }, // MaterialOrderStatus enum
        { name: 'status_history', type: 'string' }, // JSON array
        { name: 'ordered_date', type: 'string', isOptional: true },
        { name: 'expected_delivery_date', type: 'string', isOptional: true },
        { name: 'received_date', type: 'string', isOptional: true },
        { name: 'notes', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Material Purchases ────────────────────────────────
    tableSchema({
      name: 'material_purchases',
      columns: [
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'purchased_by', type: 'string' },
        { name: 'material', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'date', type: 'string' }, // Date of actual purchase
        { name: 'logged_at', type: 'number' }, // When entered into app
        { name: 'receipt_photo_url', type: 'string', isOptional: true },
        { name: 'linked_material_order_id', type: 'string', isOptional: true },
        { name: 'verified', type: 'boolean' },
        { name: 'flagged_late', type: 'boolean' },
        { name: 'notes', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Petty Cash ────────────────────────────────────────
    tableSchema({
      name: 'petty_cash',
      columns: [
        { name: 'site_supervisor_id', type: 'string', isIndexed: true },
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'float_issued', type: 'string' }, // JSON array
        { name: 'expenses', type: 'string' }, // JSON array
        { name: 'reconciled', type: 'boolean' },
        { name: 'current_balance', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Payments ──────────────────────────────────────────
    tableSchema({
      name: 'payments',
      columns: [
        { name: 'project_id', type: 'string', isIndexed: true },
        { name: 'team_id', type: 'string', isOptional: true },
        { name: 'type', type: 'string' }, // PaymentRecordType enum
        { name: 'amount', type: 'number' },
        { name: 'date', type: 'string' },
        { name: 'paid_by', type: 'string' },
        { name: 'linked_daily_report_id', type: 'string', isOptional: true },
        { name: 'linked_team_site_assignment_id', type: 'string', isOptional: true },
        { name: 'notes', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Notifications ─────────────────────────────────────
    tableSchema({
      name: 'notifications',
      columns: [
        { name: 'recipient_user_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' }, // NotificationType enum
        { name: 'project_id', type: 'string', isOptional: true },
        { name: 'title', type: 'string' },
        { name: 'message', type: 'string' },
        { name: 'metadata', type: 'string' }, // JSON
        { name: 'is_read', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
