import mongoose, { Schema, Document } from 'mongoose';

export interface IResumeData {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
  skills: string[];
  workExperience: Array<{
    company: string;
    role: string;
    duration?: string;
    description?: string;
  }>;
  yearsOfExperience: number;
  education: Array<{
    degree: string;
    institution: string;
    year?: string;
  }>;
  projects: Array<{
    title: string;
    description?: string;
    technologies?: string[];
  }>;
  rawText?: string;
}

export interface IConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IJobFilter {
  role?: string;
  location?: string;
  remoteOnly?: boolean;
  minMatchPercentage?: number;
  skills?: string[];
  experience?: string;
}

export interface IUserSession extends Document {
  sessionId: string;
  resumeData?: IResumeData;
  conversationHistory: IConversationMessage[];
  currentFilters: IJobFilter;
  pendingApplicationJobId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema: Schema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    resumeData: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
      designation: { type: String },
      skills: [{ type: String }],
      workExperience: [
        {
          company: { type: String },
          role: { type: String },
          duration: { type: String },
          description: { type: String },
        },
      ],
      yearsOfExperience: { type: Number, default: 0 },
      education: [
        {
          degree: { type: String },
          institution: { type: String },
          year: { type: String },
        },
      ],
      projects: [
        {
          title: { type: String },
          description: { type: String },
          technologies: [{ type: String }],
        },
      ],
      rawText: { type: String },
    },
    conversationHistory: [
      {
        role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: Schema.Types.Mixed },
      },
    ],
    currentFilters: {
      role: { type: String },
      location: { type: String },
      remoteOnly: { type: Boolean, default: false },
      minMatchPercentage: { type: Number, default: 0 },
      skills: [{ type: String }],
      experience: { type: String },
    },
    pendingApplicationJobId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const UserSession = mongoose.model<IUserSession>('UserSession', UserSessionSchema);

