import mongoose, { Schema, Document } from 'mongoose';
import { LATE_PURCHASE_THRESHOLD_DAYS } from '@crewly/shared';

export interface IMaterialPurchase extends Document {
  projectId: mongoose.Types.ObjectId;
  purchasedBy: mongoose.Types.ObjectId;
  material: string;
  amount: number;
  /** Date of actual purchase (may differ from when it was logged) */
  date: string;
  /** When the purchase was entered into the app */
  loggedAt: number;
  receiptPhotoUrl: string | null;
  linkedMaterialOrderId: mongoose.Types.ObjectId | null;
  /** Auto-set if receiptPhotoUrl is missing */
  verified: boolean;
  /** Auto-set if loggedAt - date > LATE_PURCHASE_THRESHOLD_DAYS */
  flaggedLate: boolean;
  notes: string;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const materialPurchaseSchema = new Schema<IMaterialPurchase>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    purchasedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    material: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    loggedAt: { type: Number, default: () => Date.now() },
    receiptPhotoUrl: { type: String, default: null },
    linkedMaterialOrderId: { type: Schema.Types.ObjectId, ref: 'MaterialOrder', default: null },
    verified: { type: Boolean, default: false },
    flaggedLate: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

materialPurchaseSchema.index({ projectId: 1 });
materialPurchaseSchema.index({ verified: 1 });
materialPurchaseSchema.index({ flaggedLate: 1 });
materialPurchaseSchema.index({ updated_at: 1 });

// Auto-compute flaggedLate and verified status before save
materialPurchaseSchema.pre('save', function (next) {
  this.updated_at = Date.now();

  // Flag as unverified if no receipt photo
  if (!this.receiptPhotoUrl) {
    this.verified = false;
  }

  // Flag as late if logged more than threshold days after purchase
  if (this.date && this.loggedAt) {
    const purchaseDate = new Date(this.date).getTime();
    const diffDays = (this.loggedAt - purchaseDate) / (1000 * 60 * 60 * 24);
    this.flaggedLate = diffDays > LATE_PURCHASE_THRESHOLD_DAYS;
  }

  next();
});

export const MaterialPurchase = mongoose.model<IMaterialPurchase>(
  'MaterialPurchase',
  materialPurchaseSchema
);
