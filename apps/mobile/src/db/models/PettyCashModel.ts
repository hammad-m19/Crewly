import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class PettyCashModel extends Model {
  static table = 'petty_cash';

  @field('site_supervisor_id') siteSupervisorId: string;
  @field('project_id') projectId: string;
  @field('float_issued') floatIssuedRaw: string;
  @field('expenses') expensesRaw: string;
  @field('reconciled') reconciled: boolean;
  @field('current_balance') currentBalance: number;
  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;

  get floatIssued(): Array<{ amount: number; issuedDate: string; issuedBy: string }> {
    try {
      return JSON.parse(this.floatIssuedRaw || '[]');
    } catch {
      return [];
    }
  }

  get expenses(): Array<{ amount: number; date: string; receiptPhoto?: string; description: string }> {
    try {
      return JSON.parse(this.expensesRaw || '[]');
    } catch {
      return [];
    }
  }
}
