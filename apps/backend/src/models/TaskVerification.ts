import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskVerification extends Document {
  dailyReportId: mongoose.Types.ObjectId;
  /** Index into the teamEntries array of the daily report */
  teamEntryIndex: number;
  verifiedBy: mongoose.Types.ObjectId;
  verifiedAt: string;
  notes: string;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const taskVerificationSchema = new Schema<ITaskVerification>(
  {
    dailyReportId: { type: Schema.Types.ObjectId, ref: 'DailyReport', required: true },
    teamEntryIndex: { type: Number, required: true, min: 0 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    verifiedAt: { type: String, required: true },
    notes: { type: String, default: '' },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

taskVerificationSchema.index({ dailyReportId: 1 });
taskVerificationSchema.index({ verifiedBy: 1 });
taskVerificationSchema.index({ updated_at: 1 });

taskVerificationSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const TaskVerification = mongoose.model<ITaskVerification>(
  'TaskVerification',
  taskVerificationSchema
);
