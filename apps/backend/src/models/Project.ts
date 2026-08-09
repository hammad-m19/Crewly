import mongoose, { Schema, Document } from 'mongoose';
import { ProjectStatus, BudgetCategory, ChangeRecord } from '@crewly/shared';

export interface IProject extends Document {
  name: string;
  location: string;
  startDate: string;
  expectedEndDate: string;
  status: ProjectStatus;
  budget: Partial<Record<BudgetCategory, number>> & { byTrade?: Record<string, number> };
  budgetHistory: ChangeRecord[];
  siteSupervisorId: mongoose.Types.ObjectId | null;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const changeRecordSchema = new Schema(
  {
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    changedBy: { type: String, required: true },
    changedAt: { type: String, required: true },
    reason: { type: String },
  },
  { _id: false }
);

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    expectedEndDate: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.ACTIVE,
    },
    budget: {
      type: Schema.Types.Mixed,
      default: {},
    },
    budgetHistory: {
      type: [changeRecordSchema],
      default: [],
    },
    siteSupervisorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

projectSchema.index({ status: 1 });
projectSchema.index({ siteSupervisorId: 1 });
projectSchema.index({ updated_at: 1 });

projectSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const Project = mongoose.model<IProject>('Project', projectSchema);
