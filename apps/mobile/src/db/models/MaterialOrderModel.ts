import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class MaterialOrderModel extends Model {
  static table = 'material_orders';

  @field('project_id') projectId: string;
  @field('requested_by') requestedBy: string;
  @field('material') material: string;
  @field('quantity') quantity: string;
  @field('status') status: string;
  @field('status_history') statusHistoryRaw: string;
  @field('ordered_date') orderedDate: string | null;
  @field('expected_delivery_date') expectedDeliveryDate: string | null;
  @field('received_date') receivedDate: string | null;
  @field('notes') notes: string;
  @readonly @date('created_at') createdAt: Date;
  @date('updated_at') updatedAt: Date;

  get statusHistory(): Array<Record<string, unknown>> {
    try {
      return JSON.parse(this.statusHistoryRaw || '[]');
    } catch {
      return [];
    }
  }
}
