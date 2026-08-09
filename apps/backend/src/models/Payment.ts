import mongoose, { Schema, Document } from 'mongoose';
import { PaymentRecordType } from '@crewly/shared';

export interface IPayment extends Document {
  projectId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId | null;
  type: PaymentRecordType;
  amount: number;
  date: string;
  paidBy: mongoose.Types.ObjectId;
  /** For daily_wage/milestone — links to the source daily report */
  linkedDailyReportId: mongoose.Types.ObjectId | null;
  /** For lump_sum — links to the team's site assignment */
  linkedTeamSiteAssignmentId: mongoose.Types.ObjectId | null;
  notes: string;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const paymentSchema = new Schema<IPayment>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    type: {
      type: String,
      required: true,
      enum: Object.values(PaymentRecordType),
    },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    linkedDailyReportId: { type: Schema.Types.ObjectId, ref: 'DailyReport', default: null },
    linkedTeamSiteAssignmentId: {
      type: Schema.Types.ObjectId,
      ref: 'TeamSiteAssignment',
      default: null,
    },
    notes: { type: String, default: '' },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

paymentSchema.index({ projectId: 1 });
paymentSchema.index({ teamId: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ paidBy: 1 });
paymentSchema.index({ updated_at: 1 });

paymentSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
