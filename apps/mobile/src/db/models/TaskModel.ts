import { Model } from '@nozbe/watermelondb';
import { field, readonly, date, text } from '@nozbe/watermelondb/decorators';
import { TABLE_NAMES } from '@crewly/shared';

/**
 * WatermelonDB Model for tasks.
 */
export default class TaskModel extends Model {
  static table = TABLE_NAMES.TASKS;

  @field('project_id') projectId!: string;
  @field('team_id') teamId!: string;
  @text('description') description!: string;
  @field('is_completed') isCompleted!: boolean;
  @field('created_by') createdBy!: string;
  
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('completed_at') completedAt?: Date | null;
}
