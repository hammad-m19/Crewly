import mongoose, { Schema, Document } from 'mongoose';
import { Role, NotificationPreferences } from '@crewly/shared';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  phone?: string;
  role: Role;
  assignedSites: mongoose.Types.ObjectId[];
  fcmToken?: string;
  /** Per-notification-type opt in/out. Missing keys default to enabled. */
  notificationPrefs: NotificationPreferences;
  isActive: boolean;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
    role: {
      type: String,
      required: true,
      enum: Object.values(Role),
    },
    assignedSites: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
    fcmToken: { type: String },
    notificationPrefs: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    // WatermelonDB sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  {
    timestamps: false, // We manage created_at/updated_at manually for sync compatibility
  }
);

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ updated_at: 1 }); // For sync pull queries

// Pre-save: update timestamp
userSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const User = mongoose.model<IUser>('User', userSchema);
