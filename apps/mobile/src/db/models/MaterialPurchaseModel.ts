import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class MaterialPurchaseModel extends Model {
  static table = 'material_purchases';

  @field('project_id') projectId!: string;
  @field('purchased_by') purchasedBy!: string;
  @field('material') material!: string;
  @field('amount') amount!: number;
  @field('date') purchaseDate!: string;
  @field('logged_at') loggedAt!: number;
  @field('receipt_photo_url') receiptPhotoUrl!: string | null;
  @field('linked_material_order_id') linkedMaterialOrderId!: string | null;
  @field('verified') verified!: boolean;
  @field('flagged_late') flaggedLate!: boolean;
  @field('notes') notes!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
