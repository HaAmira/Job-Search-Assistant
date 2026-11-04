export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  experience_required: string;
  skills: string[];
  description: string;
  source: string;
  source_link: string;
  employment_type: string;
}

export interface MatchResult {
  job: Job;
  matchPercentage: number;
  matchingSkills: string[];
  missingSkills: string[];
  matchReason: string;
}

export interface JobFilters {
  location?: string;
  remoteOnly?: boolean;
  minMatchPercentage?: number;
  skills?: string[];
  role?: string;
  experience?: string;
}

