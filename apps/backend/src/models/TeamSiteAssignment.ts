import mongoose, { Schema, Document } from 'mongoose';
import { PaymentType, AssignmentChange } from '@crewly/shared';

export interface ITeamSiteAssignment extends Document {
  projectId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  paymentType: PaymentType;
  assignedDate: string;
  unassignedDate: string | null;
  /** Lump-sum only: total agreed amount for this scope */
  agreedTotal: number | null;
  assignmentHistory: AssignmentChange[];
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const assignmentChangeSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['assigned', 'unassigned', 'payment_type_changed'],
    },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    changedBy: { type: String, required: true },
    changedAt: { type: String, required: true },
  },
  { _id: false }
);

const teamSiteAssignmentSchema = new Schema<ITeamSiteAssignment>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    paymentType: {
      type: String,
      required: true,
      enum: Object.values(PaymentType),
    },
    assignedDate: { type: String, required: true },
    unassignedDate: { type: String, default: null },
    agreedTotal: { type: Number, default: null },
    assignmentHistory: {
      type: [assignmentChangeSchema],
      default: [],
    },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

teamSiteAssignmentSchema.index({ projectId: 1 });
teamSiteAssignmentSchema.index({ teamId: 1 });
teamSiteAssignmentSchema.index({ projectId: 1, teamId: 1 });
teamSiteAssignmentSchema.index({ updated_at: 1 });

teamSiteAssignmentSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const TeamSiteAssignment = mongoose.model<ITeamSiteAssignment>(
  'TeamSiteAssignment',
  teamSiteAssignmentSchema
);
