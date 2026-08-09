import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class UserModel extends Model {
  static table = 'users';

  @field('name') name!: string;
  @field('email') email!: string;
  @field('phone') phone!: string | null;
  @field('role') role!: string;
  @field('assigned_sites') assignedSitesRaw!: string; // JSON array
  @field('is_active') isActive!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  get assignedSites(): string[] {
    try {
      return JSON.parse(this.assignedSitesRaw || '[]');
    } catch {
      return [];
    }
  }
}
