import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';
import { TeamEntry } from '@crewly/shared';

export default class DailyReportModel extends Model {
  static table = 'daily_reports';

  @field('project_id') projectId!: string;
  @field('date') date!: string; // YYYY-MM-DD
  @field('submitted_by') submittedBy!: string;
  @field('team_entries') teamEntriesRaw!: string; // JSON array
  @field('sync_status') reportSyncStatus!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  get teamEntries(): TeamEntry[] {
    try {
      return JSON.parse(this.teamEntriesRaw || '[]');
    } catch {
      return [];
    }
  }
}
