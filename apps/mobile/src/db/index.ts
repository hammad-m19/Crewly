import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import {
  UserModel,
  ProjectModel,
  TeamModel,
  TeamSiteAssignmentModel,
  DailyReportModel,
  TaskVerificationModel,
  MaterialOrderModel,
  MaterialPurchaseModel,
  PettyCashModel,
  PaymentModel,
  NotificationModel,
} from './models';

/**
 * WatermelonDB database instance.
 *
 * This is the single source of truth for all local data.
 * The UI reads from and writes to this database directly.
 * Sync pushes/pulls changes to/from the remote MongoDB backend.
 */

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true, // Use JSI for better performance on supported platforms
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

const database = new Database({
  adapter,
  modelClasses: [
    UserModel,
    ProjectModel,
    TeamModel,
    TeamSiteAssignmentModel,
    DailyReportModel,
    TaskVerificationModel,
    MaterialOrderModel,
    MaterialPurchaseModel,
    PettyCashModel,
    PaymentModel,
    NotificationModel,
  ],
});

export default database;
