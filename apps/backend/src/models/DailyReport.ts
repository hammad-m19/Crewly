import mongoose, { Schema, Document } from 'mongoose';
import { AttendanceStatus, IdleReason, SyncStatus } from '@crewly/shared';

/** A single team's entry in a daily report */
export interface ITeamEntry {
  teamId: mongoose.Types.ObjectId | null;
  isLocalLabor: boolean;
  headcountPresent: number;
  attendanceStatus: AttendanceStatus;
  idleReason: IdleReason | null;
  idleReasonNotes: string;
  linkedMaterialOrderId: mongoose.Types.ObjectId | null;
  taskWorkedOn: string;
  taskCompleted: boolean;
  remainingWorkNotes: string;
  photos: string[];
}

export interface IDailyReport extends Document {
  projectId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  submittedBy: mongoose.Types.ObjectId;
  teamEntries: ITeamEntry[];
  syncStatus: SyncStatus;
  created_at: number;
  updated_at: number;
  _deleted: boolean;
}

const teamEntrySchema = new Schema(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    isLocalLabor: { type: Boolean, default: false },
    headcountPresent: { type: Number, required: true, min: 0 },
    attendanceStatus: {
      type: String,
      required: true,
      enum: Object.values(AttendanceStatus),
    },
    idleReason: {
      type: String,
      enum: [...Object.values(IdleReason), null],
      default: null,
    },
    idleReasonNotes: { type: String, default: '' },
    linkedMaterialOrderId: { type: Schema.Types.ObjectId, ref: 'MaterialOrder', default: null },
    taskWorkedOn: { type: String, default: '' },
    taskCompleted: { type: Boolean, default: false },
    remainingWorkNotes: { type: String, default: '' },
    photos: { type: [String], default: [] },
  },
  { _id: false }
);

const dailyReportSchema = new Schema<IDailyReport>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD format
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamEntries: {
      type: [teamEntrySchema],
      default: [],
      validate: {
        validator: function (entries: ITeamEntry[]) {
          // Validate: if a team has a no_show or idle status, idle reason must be provided
          return entries.every((entry) => {
            if (
              entry.attendanceStatus === AttendanceStatus.NO_SHOW ||
              entry.headcountPresent === 0
            ) {
              return entry.idleReason !== null;
            }
            return true;
          });
        },
        message: 'Idle reason is required when team is not working or has a no-show',
      },
    },
    syncStatus: {
      type: String,
      enum: Object.values(SyncStatus),
      default: SyncStatus.SYNCED,
    },
    // Sync fields
    created_at: { type: Number, default: () => Date.now() },
    updated_at: { type: Number, default: () => Date.now() },
    _deleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

dailyReportSchema.index({ projectId: 1, date: -1 });
dailyReportSchema.index({ submittedBy: 1 });
dailyReportSchema.index({ date: -1 });
dailyReportSchema.index({ updated_at: 1 });
// Unique constraint: one report per project per day
dailyReportSchema.index({ projectId: 1, date: 1 }, { unique: true });

dailyReportSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

export const DailyReport = mongoose.model<IDailyReport>('DailyReport', dailyReportSchema);
