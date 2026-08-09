import mongoose, { Schema, Document } from 'mongoose';
import { MaterialOrderStatus, StatusChange } from '@crewly/shared';

export interface IMaterialOrder extends Document {
  projectId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  material: string;
  quantity: string; // e.g. "500 kg", "20 bags" — free text, units vary
  status: MaterialOrderStatus;
  statusHistory: StatusChange[];
  orderedDate: string | null;
  expectedDeliveryDate: string | null;
  receivedDate: string | null;
  notes: string;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const statusChangeSchema = new Schema(
  {
    status: {
      type: String,
      required: true,
      enum: Object.values(MaterialOrderStatus),
    },
    changedAt: { type: String, required: true },
    changedBy: { type: String, required: true },
  },
  { _id: false }
);

const materialOrderSchema = new Schema<IMaterialOrder>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    material: { type: String, required: true, trim: true },
    quantity: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(MaterialOrderStatus),
      default: MaterialOrderStatus.NEEDED,
    },
    statusHistory: {
      type: [statusChangeSchema],
      default: [],
    },
    orderedDate: { type: String, default: null },
    expectedDeliveryDate: { type: String, default: null },
    receivedDate: { type: String, default: null },
    notes: { type: String, default: '' },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

materialOrderSchema.index({ projectId: 1 });
materialOrderSchema.index({ status: 1 });
materialOrderSchema.index({ projectId: 1, status: 1 });
materialOrderSchema.index({ updated_at: 1 });

materialOrderSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const MaterialOrder = mongoose.model<IMaterialOrder>(
  'MaterialOrder',
  materialOrderSchema
);
