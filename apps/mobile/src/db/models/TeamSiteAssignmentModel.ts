import { Model } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';

export default class TeamSiteAssignmentModel extends Model {
  static table = 'team_site_assignments';

  @field('project_id') projectId!: string;
  @field('team_id') teamId!: string;
  @field('payment_type') paymentType!: string;
  @field('assigned_date') assignedDate!: string;
  @field('unassigned_date') unassignedDate!: string | null;
  @field('agreed_total') agreedTotal!: number | null;
  @field('assignment_history') assignmentHistoryRaw!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('projects', 'project_id') project: any;
  @relation('teams', 'team_id') team: any;

  get assignmentHistory(): Array<Record<string, unknown>> {
    try {
      return JSON.parse(this.assignmentHistoryRaw || '[]');
    } catch {
      return [];
    }
  }
}
