import mongoose, { Schema, Document } from 'mongoose';
import { FloatIssuance, PettyCashExpense } from '@crewly/shared';

export interface IPettyCash extends Document {
  siteSupervisorId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  floatIssued: FloatIssuance[];
  expenses: (PettyCashExpense & { _id?: string })[];
  reconciled: boolean;
  currentBalance: number;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const floatIssuanceSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    issuedDate: { type: String, required: true },
    issuedBy: { type: String, required: true },
  },
  { _id: false }
);

const pettyCashExpenseSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    receiptPhoto: { type: String },
    description: { type: String, required: true },
  },
  { _id: false }
);

const pettyCashSchema = new Schema<IPettyCash>(
  {
    siteSupervisorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    floatIssued: {
      type: [floatIssuanceSchema],
      default: [],
    },
    expenses: {
      type: [pettyCashExpenseSchema],
      default: [],
    },
    /** Must be reconciled before a new float can be issued */
    reconciled: { type: Boolean, default: false },
    /** Computed: total float issued - total expenses */
    currentBalance: { type: Number, default: 0 },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

pettyCashSchema.index({ siteSupervisorId: 1 });
pettyCashSchema.index({ projectId: 1 });
pettyCashSchema.index({ reconciled: 1 });
pettyCashSchema.index({ updated_at: 1 });

// Recompute currentBalance before save
pettyCashSchema.pre('save', function (next) {
  this.updated_at = Date.now();

  const totalFloat = this.floatIssued.reduce((sum, f) => sum + f.amount, 0);
  const totalExpenses = this.expenses.reduce((sum, e) => sum + e.amount, 0);
  this.currentBalance = totalFloat - totalExpenses;

  next();
});

export const PettyCash = mongoose.model<IPettyCash>('PettyCash', pettyCashSchema);
