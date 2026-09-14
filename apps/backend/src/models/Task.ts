import mongoose, { Schema, Document } from 'mongoose';
import { TABLE_NAMES } from '@crewly/shared';

export interface ITask extends Document {
  projectId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  description: string;
  isCompleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  completedAt?: Date | null;
}

const TaskSchema = new Schema<ITask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    description: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

export const Task = mongoose.model<ITask>(TABLE_NAMES.TASKS, TaskSchema);
