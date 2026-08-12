import mongoose, { Schema, Document } from 'mongoose';
import { Trade, PaymentType } from '@crewly/shared';

export interface ITeam extends Document {
  name: string;
  trade: Trade;
  defaultPaymentType: PaymentType;
  contactPhone?: string;
  /** Per person per day, used to suggest daily-wage payments. Money-gated. */
  dailyRate: number | null;
  isActive: boolean;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    trade: {
      type: String,
      required: true,
      enum: Object.values(Trade),
    },
    defaultPaymentType: {
      type: String,
      required: true,
      enum: Object.values(PaymentType),
      default: PaymentType.DAILY_WAGE,
    },
    contactPhone: { type: String, trim: true },
    dailyRate: { type: Number, default: null, min: 0 },
    isActive: { type: Boolean, default: true },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

teamSchema.index({ trade: 1 });
teamSchema.index({ updated_at: 1 });

teamSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const Team = mongoose.model<ITeam>('Team', teamSchema);
