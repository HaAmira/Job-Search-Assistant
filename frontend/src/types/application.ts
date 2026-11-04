export type ApplicationStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Interview Scheduled'
  | 'Rejected'
  | 'Accepted';

export interface Application {
  _id: string;
  sessionId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  location?: string;
  sourceLink?: string;
  appliedAt: string;
  status: ApplicationStatus;
  notes?: string;
}

