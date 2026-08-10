import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class NotificationModel extends Model {
  static table = 'notifications';

  @field('recipient_user_id') recipientUserId: string;
  @field('type') type: string;
  @field('project_id') projectId: string | null;
  @field('title') title: string;
  @field('message') message: string;
  @field('metadata') metadataRaw: string;
  @field('is_read') isRead: boolean;
  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;

  get metadata(): Record<string, unknown> {
    try {
      return JSON.parse(this.metadataRaw || '{}');
    } catch {
      return {};
    }
  }
}
