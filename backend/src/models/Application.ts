import mongoose, { Schema, Document } from 'mongoose';

export type ApplicationStatus = 'Submitted' | 'Under Review' | 'Interview Scheduled' | 'Rejected' | 'Accepted';

export interface IApplication extends Document {
  sessionId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  location?: string;
  sourceLink?: string;
  matchScoreAtApply?: number;
  appliedAt: Date;
  status: ApplicationStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema: Schema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    jobTitle: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      default: 'Remote',
    },
    sourceLink: {
      type: String,
    },
    matchScoreAtApply: {
      type: Number,
      default: 0,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'Interview Scheduled', 'Rejected', 'Accepted'],
      default: 'Submitted',
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Prevent duplicate applications for the same session and job
ApplicationSchema.index({ sessionId: 1, jobId: 1 }, { unique: true });

export const Application = mongoose.model<IApplication>('Application', ApplicationSchema);

