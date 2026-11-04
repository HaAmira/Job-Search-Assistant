export interface WorkExperience {
  company: string;
  role: string;
  duration?: string;
  description?: string;
}

export interface Education {
  degree: string;
  institution: string;
  year?: string;
}

export interface Project {
  title: string;
  description?: string;
  technologies?: string[];
}

export interface ResumeData {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
  skills: string[];
  workExperience: WorkExperience[];
  yearsOfExperience: number;
  education: Education[];
  projects: Project[];
  rawText?: string;
}

