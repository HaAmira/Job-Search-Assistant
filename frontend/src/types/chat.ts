import { MatchResult } from './job';
import { ResumeData } from './resume';
import { Application } from './application';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  intent?: string;
  jobs?: MatchResult[];
  application?: Application | Application[];
  requiresConfirmation?: boolean;
  candidateProfile?: ResumeData;
}

