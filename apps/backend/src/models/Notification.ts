import mongoose, { Schema, Document } from 'mongoose';
import { NotificationType } from '@crewly/shared';

export interface INotification extends Document {
  recipientUserId: mongoose.Types.ObjectId;
  type: NotificationType;
  projectId: mongoose.Types.ObjectId | null;
  title: string;
  message: string;
  /** JSON-encoded metadata (e.g. teamId, dailyReportId) for deep-linking */
  metadata: string;
  read: boolean;
  createdAt: string;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(NotificationType),
    },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: String, default: '{}' },
    read: { type: Boolean, default: false },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

notificationSchema.index({ recipientUserId: 1, read: 1 });
notificationSchema.index({ recipientUserId: 1, created_at: -1 });
notificationSchema.index({ updated_at: 1 });

notificationSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
