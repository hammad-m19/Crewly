import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class PaymentModel extends Model {
  static table = 'payments';

  @field('project_id') projectId: string;
  @field('team_id') teamId: string | null;
  @field('type') type: string;
  @field('amount') amount: number;
  @field('date') paymentDate: string;
  @field('paid_by') paidBy: string;
  @field('linked_daily_report_id') linkedDailyReportId: string | null;
  @field('linked_team_site_assignment_id') linkedTeamSiteAssignmentId: string | null;
  @field('notes') notes: string;
  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
}
