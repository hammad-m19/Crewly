import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class ProjectModel extends Model {
  static table = 'projects';

  @field('name') name: string;
  @field('location') location: string;
  @field('start_date') startDate: string;
  @field('expected_end_date') expectedEndDate: string;
  @field('status') status: string;
  @field('budget') budgetRaw: string; // JSON — may be empty for non-money roles
  @field('budget_history') budgetHistoryRaw: string; // JSON — may be empty for non-money roles
  @field('site_supervisor_id') siteSupervisorId: string | null;
  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;

  get budget(): Record<string, number> {
    try {
      return JSON.parse(this.budgetRaw || '{}');
    } catch {
      return {};
    }
  }

  get budgetHistory(): Array<Record<string, unknown>> {
    try {
      return JSON.parse(this.budgetHistoryRaw || '[]');
    } catch {
      return [];
    }
  }
}
