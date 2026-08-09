import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class TaskVerificationModel extends Model {
  static table = 'task_verifications';

  @field('daily_report_id') dailyReportId!: string;
  @field('team_entry_index') teamEntryIndex!: number;
  @field('verified_by') verifiedBy!: string;
  @field('verified_at') verifiedAt!: string;
  @field('notes') notes!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
