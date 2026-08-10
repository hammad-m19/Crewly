import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class TeamModel extends Model {
  static table = 'teams';

  @field('name') name: string;
  @field('trade') trade: string;
  @field('default_payment_type') defaultPaymentType: string;
  @field('contact_phone') contactPhone: string | null;
  @field('is_active') isActive: boolean;
  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;
}
