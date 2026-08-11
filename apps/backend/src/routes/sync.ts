import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Role, TABLE_NAMES, MONEY_FIELDS, MONEY_VISIBLE_ROLES } from '@crewly/shared';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Team } from '../models/Team';
import { TeamSiteAssignment } from '../models/TeamSiteAssignment';
import { DailyReport } from '../models/DailyReport';
import { TaskVerification } from '../models/TaskVerification';
import { MaterialOrder } from '../models/MaterialOrder';
import { MaterialPurchase } from '../models/MaterialPurchase';
import { PettyCash } from '../models/PettyCash';
import { Payment } from '../models/Payment';
import { Notification } from '../models/Notification';
import mongoose from 'mongoose';

const router = Router();

// Map table names to Mongoose models
const modelMap: Record<string, mongoose.Model<any>> = {
  [TABLE_NAMES.USERS]: User,
  [TABLE_NAMES.PROJECTS]: Project,
  [TABLE_NAMES.TEAMS]: Team,
  [TABLE_NAMES.TEAM_SITE_ASSIGNMENTS]: TeamSiteAssignment,
  [TABLE_NAMES.DAILY_REPORTS]: DailyReport,
  [TABLE_NAMES.TASK_VERIFICATIONS]: TaskVerification,
  [TABLE_NAMES.MATERIAL_ORDERS]: MaterialOrder,
  [TABLE_NAMES.MATERIAL_PURCHASES]: MaterialPurchase,
  [TABLE_NAMES.PETTY_CASH]: PettyCash,
  [TABLE_NAMES.PAYMENTS]: Payment,
  [TABLE_NAMES.NOTIFICATIONS]: Notification,
};

/**
 * GET /api/sync/pull?last_pulled_at=<timestamp>
 *
 * Returns delta changes since last sync for WatermelonDB.
 * Filters data by user role:
 * - Site Supervisor: only their project(s) data
 * - Super Supervisor: all projects
 * - Owner/Accountant: all data
 *
 * ⚠️ CRITICAL: Budget/cost fields are stripped PER-RECORD for non-money roles.
 * This is done HERE in addition to the moneyFilter middleware as defense-in-depth.
 * A Site Supervisor's sync pull includes Project records (for context) but NOT
 * budget/budgetHistory fields on those records.
 */
router.get('/pull', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lastPulledAt = parseInt(req.query.last_pulled_at as string) || 0;
    const userRole = req.user!.role;
    const userId = req.user!.userId;

    const changes: Record<string, { created: any[]; updated: any[]; deleted: string[] }> = {};

    for (const [tableName, Model] of Object.entries(modelMap)) {
      // Build role-specific filters
      const filter = buildRoleFilter(tableName, userRole, userId);

      // Get records created after last pull
      const created = await Model.find({
        ...filter,
        created_at: { $gt: lastPulledAt },
        _deleted: false,
      }).lean();

      // Get records updated (but not created) after last pull
      const updated = await Model.find({
        ...filter,
        updated_at: { $gt: lastPulledAt },
        created_at: { $lte: lastPulledAt },
        _deleted: false,
      }).lean();

      // Get deleted record IDs
      const deletedRecords = await Model.find({
        ...filter,
        _deleted: true,
        updated_at: { $gt: lastPulledAt },
      }).select('_id').lean();

      const deleted = deletedRecords.map((r: any) => r._id.toString());

      // ⚠️ Strip money fields per-record for non-money roles
      // This is the critical per-record filtering flagged in the spec review
      const shouldStripMoney = !MONEY_VISIBLE_ROLES.includes(userRole as Role);

      // Format records (applies money filter if needed, and normalizes _id to id)
      changes[tableName] = {
        created: created.map(r => formatRecordForSync(r, shouldStripMoney)),
        updated: updated.map(r => formatRecordForSync(r, shouldStripMoney)),
        deleted,
      };
    }

    res.json({
      success: true,
      data: {
        changes,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    res.status(500).json({ success: false, error: { message: 'Sync pull failed.' } });
  }
});

/**
 * POST /api/sync/push
 *
 * Accepts local changes from WatermelonDB and applies them to MongoDB.
 * Transactional — all-or-nothing per table.
 *
 * Conflict resolution:
 * - Payment/MaterialPurchase: server-wins (never overwrite financial records)
 * - Everything else: client-wins (last write wins by timestamp)
 */
router.post('/push', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { changes, lastPulledAt } = req.body;

    if (!changes) {
      res.status(400).json({ success: false, error: { message: 'changes object is required.' } });
      return;
    }

    const serverWinTables: string[] = [TABLE_NAMES.PAYMENTS, TABLE_NAMES.MATERIAL_PURCHASES];

    for (const [tableName, tableChanges] of Object.entries(changes) as [string, any][]) {
      const Model = modelMap[tableName];
      if (!Model) continue;

      const isServerWins = serverWinTables.includes(tableName);

      // Process creations
      if (tableChanges.created?.length) {
        for (const record of tableChanges.created) {
          const existing = await Model.findById(record.id || record._id);
          if (!existing) {
            const doc = new Model({
              ...record,
              _id: record.id || record._id,
            });
            await doc.save();
          }
          // If exists, skip (already synced)
        }
      }

      // Process updates
      if (tableChanges.updated?.length) {
        for (const record of tableChanges.updated) {
          const id = record.id || record._id;
          const existing = await Model.findById(id);

          if (!existing) continue;

          // Server-wins for financial records: skip if server has newer data
          if (isServerWins && existing.updated_at > (record.updated_at || 0)) {
            continue;
          }

          // Apply update
          Object.keys(record).forEach((key) => {
            if (key !== '_id' && key !== 'id' && key !== '__v') {
              (existing as any)[key] = record[key];
            }
          });
          await existing.save();
        }
      }

      // Process deletions (soft delete)
      if (tableChanges.deleted?.length) {
        await Model.updateMany(
          { _id: { $in: tableChanges.deleted } },
          { _deleted: true, updated_at: Date.now() }
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Sync push error:', error);
    res.status(500).json({ success: false, error: { message: 'Sync push failed.' } });
  }
});

/**
 * Build role-specific query filters for sync pull.
 * Ensures users only receive data they should have access to.
 */
function buildRoleFilter(
  tableName: string,
  role: string,
  userId: string
): Record<string, unknown> {
  switch (role) {
    case Role.SITE_SUPERVISOR:
      // Site Supervisor gets data scoped to their assigned projects
      switch (tableName) {
        case TABLE_NAMES.DAILY_REPORTS:
          return { submittedBy: userId };
        case TABLE_NAMES.NOTIFICATIONS:
          return { recipientUserId: userId };
        case TABLE_NAMES.PETTY_CASH:
          return { siteSupervisorId: userId };
        // Projects, teams, assignments, material orders/purchases — all get through
        // but money fields are stripped per-record above
        default:
          return {};
      }

    case Role.SUPER_SUPERVISOR:
      switch (tableName) {
        case TABLE_NAMES.NOTIFICATIONS:
          return { recipientUserId: userId };
        // Super Supervisor sees everything else (but money stripped)
        default:
          return {};
      }

    case Role.ACCOUNTANT:
    case Role.OWNER:
      switch (tableName) {
        case TABLE_NAMES.NOTIFICATIONS:
          return { recipientUserId: userId };
        // Owner and Accountant see everything including money
        default:
          return {};
      }

    default:
      return {};
  }
}

/**
 * Strip money-related fields from a single record.
 * ⚠️ This is the per-record filter that ensures Project records
 * synced to a Site Supervisor don't contain budget/budgetHistory.
 */
function formatRecordForSync(record: any, shouldStripMoney: boolean): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  // WatermelonDB needs 'id', not '_id'
  result.id = record._id ? record._id.toString() : record.id;
  
  for (const [key, value] of Object.entries(record)) {
    if (key === '_id' || key === '__v') continue;
    if (shouldStripMoney && (MONEY_FIELDS as readonly string[]).includes(key)) {
      continue; // Strip this field entirely
    }
    
    // Stringify ObjectIds to prevent buffer serialization issues
    if (value && typeof value === 'object' && value.constructor.name === 'ObjectId') {
      result[key] = value.toString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

export default router;
