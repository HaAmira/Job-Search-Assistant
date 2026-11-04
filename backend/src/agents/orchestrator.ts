import { SessionService } from '../services/sessionService';
import { JobService, IJob } from '../services/jobService';
import { JobMatchingAgent, IMatchResult } from './jobMatchingAgent';
import { ApplicationAgent, ApplicationResponse } from './applicationAgent';
import { TrackingAgent } from './trackingAgent';
import { getGroqClient, getGroqModel, summarizeGroqError } from '../config/groq';
import { IJobFilter, IResumeData } from '../models/UserSession';
import { logger } from '../utils/logger';

export type IntentType =
  | 'GREETING'
  | 'UPLOAD_RESUME'
  | 'ANALYZE_RESUME'
  | 'FIND_JOBS'
  | 'FILTER_JOBS'
  | 'VIEW_JOB'
  | 'APPLY_JOB'
  | 'VIEW_APPLICATIONS'
  | 'APPLICATION_STATUS'
  | 'GENERAL_QUESTION';

export interface OrchestratorResult {
  intent: IntentType;
  message: string;
  jobs?: IMatchResult[];
  application?: any;
  requiresConfirmation?: boolean;
  filters?: IJobFilter;
  candidateProfile?: IResumeData;
}

export class Orchestrator {
  /**
   * Main entry point to process any incoming user chat message
   */
  public static async processMessage(
    sessionId: string,
    userMessage: string
  ): Promise<OrchestratorResult> {
    const session = await SessionService.getOrCreateSession(sessionId);
    const trimmed = userMessage.trim();

    // 1. Check for pending application confirmation ("yes", "confirm", "no", "cancel")
    if (session.pendingApplicationJobId) {
      const lower = trimmed.toLowerCase();
      const isAffirmative = /^(yes|y|yep|sure|confirm|apply|submit|ok|okay|do it|proceed)/i.test(lower);
      const isNegative = /^(no|n|nope|cancel|abort|stop|nevermind|don't)/i.test(lower);

      if (isAffirmative) {
        const appRes = await ApplicationAgent.confirmApplication(sessionId, session.pendingApplicationJobId);
        await SessionService.addMessage(sessionId, 'user', userMessage);
        await SessionService.addMessage(sessionId, 'assistant', appRes.message);
        return {
          intent: 'APPLY_JOB',
          message: appRes.message,
          application: appRes.application,
        };
      } else if (isNegative) {
        await SessionService.setPendingApplication(sessionId, null);
        const cancelMsg = 'Understood! I have cancelled the pending job application.';
        await SessionService.addMessage(sessionId, 'user', userMessage);
        await SessionService.addMessage(sessionId, 'assistant', cancelMsg);
        return {
          intent: 'APPLY_JOB',
          message: cancelMsg,
        };
      }
    }

    // 2. Identify Intent & Extract Parameters (via Groq LLM or deterministic rules)
    const { intent, params } = this.isClearAllJobsRequest(trimmed)
      ? { intent: 'FIND_JOBS' as IntentType, params: {} }
      : await this.detectIntent(userMessage, session);

    // 3. Dispatch to specialized agent / deterministic service
    let result: OrchestratorResult;

    switch (intent) {
      case 'GREETING':
        result = this.handleGreeting(session.resumeData);
        break;

      case 'UPLOAD_RESUME':
        result = this.handleUploadResumePrompt();
        break;

      case 'ANALYZE_RESUME':
        result = this.handleAnalyzeResume(session.resumeData);
        break;

      case 'FIND_JOBS':
      case 'FILTER_JOBS':
        result = await this.handleJobSearch(sessionId, session.resumeData, params);
        break;

      case 'VIEW_JOB':
        result = this.handleViewJob(params.jobId || userMessage);
        break;

      case 'APPLY_JOB':
        result = await this.handleApplyJob(sessionId, params.jobId || userMessage, session);
        break;

      case 'VIEW_APPLICATIONS':
      case 'APPLICATION_STATUS':
        result = await this.handleViewApplications(sessionId, params.search);
        break;

      case 'GENERAL_QUESTION':
      default:
        result = await this.handleGeneralQuestion(userMessage, session);
        break;
    }

    // 4. Record turn in conversation history
    await SessionService.addMessage(sessionId, 'user', userMessage);
    await SessionService.addMessage(sessionId, 'assistant', result.message, {
      intent: result.intent,
      requiresConfirmation: result.requiresConfirmation,
    });

    return result;
  }

  /**
   * Detect intent using Groq LLM with deterministic regex fallback
   */
  private static async detectIntent(
    userMessage: string,
    session: any
  ): Promise<{ intent: IntentType; params: any }> {
    const groq = getGroqClient();

    if (groq) {
      try {
        const prompt = `
Analyze the user's message in an AI Job Search Assistant and classify the intent.
Possible intents:
- GREETING: Hello, hi, welcome greetings.
- UPLOAD_RESUME: Asking how to upload or saying they want to upload a resume.
- ANALYZE_RESUME: Asking to view their resume profile, extracted skills, or review profile.
- FIND_JOBS: Asking for job recommendations, suitable roles, matches.
- FILTER_JOBS: Specific filters like "remote only", "jobs in Delhi", "React jobs", "match > 80%", "internships".
- VIEW_JOB: Asking for full details of a specific job ID.
- APPLY_JOB: User requesting to apply (e.g. "apply to job 3", "apply JOB0012").
- VIEW_APPLICATIONS: Asking to see applied jobs, submission history.
- APPLICATION_STATUS: Asking for status of applied jobs.
- GENERAL_QUESTION: Questions about career, interview prep, or general chat.

Recent conversation: ${JSON.stringify(
          (session.conversationHistory || []).slice(-8).map((entry: any) => ({
            role: entry.role,
            content: entry.content.slice(0, 1000),
          }))
        )}

Current user message: "${userMessage}"

Return the intent and extracted params in the structured JSON expected by the function tool.
`;

        const tools = [
          {
            type: 'function' as const,
            function: {
              name: 'classify_user_intent',
              description: 'Classify the user message and extract structured filter parameters for the Hidani job assistant.',
              parameters: {
                type: 'object',
                properties: {
                  intent: {
                    type: 'string',
                    enum: [
                      'GREETING',
                      'UPLOAD_RESUME',
                      'ANALYZE_RESUME',
                      'FIND_JOBS',
                      'FILTER_JOBS',
                      'VIEW_JOB',
                      'APPLY_JOB',
                      'VIEW_APPLICATIONS',
                      'APPLICATION_STATUS',
                      'GENERAL_QUESTION',
                    ],
                  },
                  params: {
                    type: 'object',
                    properties: {
                      jobId: { type: 'string' },
                      remoteOnly: { type: 'boolean' },
                      location: { type: 'string' },
                      skills: { type: 'array', items: { type: 'string' } },
                      role: { type: 'string' },
                      minMatchPercentage: { type: 'number' },
                      experience: { type: 'string' },
                      search: { type: 'string' },
                    },
                    additionalProperties: true,
                  },
                },
                required: ['intent'],
              },
            },
          },
        ];

        const res = await groq.chat.completions.create({
          model: getGroqModel(),
          messages: [{ role: 'user', content: prompt }],
          tools,
          tool_choice: 'auto',
          temperature: 0.1,
        });

        const message = res.choices[0]?.message;
        const toolCall = message?.tool_calls?.[0];
        if (toolCall && typeof toolCall.function?.arguments === 'string') {
          const parsed = JSON.parse(toolCall.function.arguments);
          if (parsed.intent) {
            return {
              intent: parsed.intent as IntentType,
              params: parsed.params || {},
            };
          }
        }

        const content = message?.content || '{}';
        const parsed = JSON.parse(content);
        if (parsed.intent) {
          return {
            intent: parsed.intent as IntentType,
            params: parsed.params || {},
          };
        }
      } catch (err: any) {
        const summary = summarizeGroqError(err);
        logger.warn('Groq intent detection failed; using deterministic intent parser', {
          ...summary,
          ...(summary.status === 429 ? { fallback: 'rate-limited' } : {}),
        });
      }
    }

    // Deterministic fallback intent classifier
    return this.fallbackDetectIntent(userMessage);
  }

  /**
   * Deterministic intent classification heuristics
   */
  public static fallbackDetectIntent(message: string): { intent: IntentType; params: any } {
    const msg = message.toLowerCase().trim();
    const params: any = {};

    if (this.isClearAllJobsRequest(msg)) {
      return { intent: 'FIND_JOBS', params };
    }

    // 1. Apply intent
    const applyMatch = msg.match(/\bapply\b(?:\s+(?:to|for))?\s*(?:job\s+)?([a-z0-9_-]+)?/i);
    if (applyMatch) {
      if (applyMatch[1]) params.jobId = applyMatch[1];
      return { intent: 'APPLY_JOB', params };
    }

    // 2. Applications / Status
    if (msg.includes('applied') || msg.includes('my application') || msg.includes('application history') || msg.includes('track')) {
      const searchMatch = msg.match(/(?:for|at)\s+([a-zA-Z0-9\s]+)$/);
      if (searchMatch) params.search = searchMatch[1].trim();
      return { intent: 'VIEW_APPLICATIONS', params };
    }
    if (msg.includes('status')) {
      return { intent: 'APPLICATION_STATUS', params };
    }

    // 3. Resume review / analysis
    if (
      msg.includes('my resume') ||
      msg.includes('my profile') ||
      msg.includes('analyze resume') ||
      msg.includes('extracted skills') ||
      msg.includes('show skills')
    ) {
      return { intent: 'ANALYZE_RESUME', params };
    }

    // 4. Upload resume prompt
    if (msg.includes('upload resume') || msg.includes('how to upload') || msg.includes('attach cv')) {
      return { intent: 'UPLOAD_RESUME', params };
    }

    // 5. Filter / Search jobs
    const isFilter =
      msg.includes('remote') ||
      msg.includes('filter') ||
      msg.includes('in ') ||
      msg.includes('requiring') ||
      msg.includes('score') ||
      msg.includes('%') ||
      msg.includes('fresher') ||
      msg.includes('intern');

    const isJobSearchRequest =
      /\b(?:find|search|show|list|recommend|browse)\b/.test(msg) &&
      /\b(?:jobs?|roles?|positions?|vacancies)\b/.test(msg);
    if (isFilter || isJobSearchRequest) {
      if (msg.includes('remote')) params.remoteOnly = true;

      const locMatch = message.match(/\bin\s+([a-zA-Z\s]+?)(?:\s+jobs?|$|\.)/i);
      if (locMatch && locMatch[1].trim().toLowerCase() !== 'remote') {
        params.location = locMatch[1].trim();
      }

      const scoreMatch = msg.match(/(?:more than|>|at least)\s*(\d+)\s*%/);
      if (scoreMatch) params.minMatchPercentage = parseInt(scoreMatch[1], 10);

      if (msg.includes('fresher') || msg.includes('intern')) params.experience = 'fresher';

      if (msg.includes('react')) params.skills = (params.skills || []).concat(['React']);
      if (msg.includes('node')) params.skills = (params.skills || []).concat(['Node.js']);
      if (msg.includes('mongo')) params.skills = (params.skills || []).concat(['MongoDB']);
      if (msg.includes('python')) params.skills = (params.skills || []).concat(['Python']);

      return { intent: isFilter ? 'FILTER_JOBS' : 'FIND_JOBS', params };
    }

    // 6. View single job
    const viewMatch = msg.match(/(?:view|details of|tell me about)\s+(?:job\s*)?([a-z0-9_-]+)/i);
    if (viewMatch) {
      params.jobId = viewMatch[1];
      return { intent: 'VIEW_JOB', params };
    }

    // 7. Greeting
    if (/^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))/i.test(msg)) {
      return { intent: 'GREETING', params };
    }

    return { intent: 'GENERAL_QUESTION', params };
  }

  private static isClearAllJobsRequest(message: string): boolean {
    return /\b(?:show|find|search|list|browse)\s+(?:me\s+)?all\s+(?:the\s+)?jobs?\b/i.test(message);
  }

  // ==========================================
  // HANDLERS
  // ==========================================

  private static handleGreeting(resumeData?: IResumeData): OrchestratorResult {
    let message = "Welcome! I'm your **AI Job Assistant**.\n\n";
    if (resumeData && resumeData.skills && resumeData.skills.length > 0) {
      message += `I have your profile active for **${resumeData.name || 'Candidate'}** (${resumeData.designation || 'Software Engineer'}).\n\n`;
      message += `You can ask me to:\n- **"Recommend jobs for me"**\n- **"Show only remote jobs"**\n- **"Find jobs with >80% match"**\n- **"Show my applications"**`;
    } else {
      message += `Upload your **PDF or DOCX resume** to get started. I'll automatically analyze your skills, find matching jobs from our verified database, and assist you in applying and tracking applications.`;
    }
    return { intent: 'GREETING', message };
  }

  private static handleUploadResumePrompt(): OrchestratorResult {
    return {
      intent: 'UPLOAD_RESUME',
      message:
        'You can upload your resume by clicking the **"Upload Resume"** button or dragging your **PDF / DOCX** file directly into the chat. I will parse your skills, experience, and education instantly!',
    };
  }

  private static handleAnalyzeResume(resumeData?: IResumeData): OrchestratorResult {
    if (!resumeData || !resumeData.skills || resumeData.skills.length === 0) {
      return {
        intent: 'ANALYZE_RESUME',
        message:
          'No resume has been uploaded yet for this session. Please upload your **PDF or DOCX resume** first so I can analyze your qualifications!',
      };
    }

    let msg = `### Candidate Profile Analysis\n\n`;
    msg += `- **Name:** ${resumeData.name || 'Not specified'}\n`;
    if (resumeData.email) msg += `- **Email:** ${resumeData.email}\n`;
    if (resumeData.phone) msg += `- **Phone:** ${resumeData.phone}\n`;
    msg += `- **Designation:** ${resumeData.designation || 'Software Engineer'}\n`;
    msg += `- **Estimated Experience:** ~${resumeData.yearsOfExperience || 0} years\n\n`;

    msg += `#### 🛠 Extracted Skills (${resumeData.skills.length})\n`;
    msg += `${resumeData.skills.join(', ')}\n\n`;

    if (resumeData.education && resumeData.education.length > 0) {
      msg += `#### 🎓 Education\n`;
      resumeData.education.forEach((edu) => {
        msg += `- ${edu.degree} - ${edu.institution} (${edu.year || ''})\n`;
      });
      msg += `\n`;
    }

    msg += `*Need to update anything? You can correct details by clicking the **Edit Profile** button in the sidebar or telling me directly (e.g. "Add Docker to my skills").*`;

    return {
      intent: 'ANALYZE_RESUME',
      message: msg,
      candidateProfile: resumeData,
    };
  }

  private static async handleJobSearch(
    sessionId: string,
    resumeData?: IResumeData,
    params: any = {}
  ): Promise<OrchestratorResult> {
    const updatedFilters: IJobFilter = {};
    if (typeof params.role === 'string' && params.role.trim()) updatedFilters.role = params.role.trim();
    if (typeof params.location === 'string' && params.location.trim()) updatedFilters.location = params.location.trim();
    if (params.remoteOnly === true) updatedFilters.remoteOnly = true;
    if (typeof params.minMatchPercentage === 'number') {
      updatedFilters.minMatchPercentage = params.minMatchPercentage;
    }
    if (Array.isArray(params.skills) && params.skills.length > 0) {
      updatedFilters.skills = params.skills.filter((skill: unknown): skill is string => typeof skill === 'string');
    }
    if (typeof params.experience === 'string' && params.experience.trim()) {
      updatedFilters.experience = params.experience.trim();
    }
    await SessionService.updateFilters(sessionId, updatedFilters);

    // Provide default fallback candidate profile if user searches before uploading resume
    const candidate: IResumeData = resumeData && resumeData.skills.length > 0
      ? resumeData
      : {
          name: 'Job Seeker',
          skills: params.skills && params.skills.length > 0 ? params.skills : ['React', 'Node.js', 'JavaScript', 'TypeScript', 'MongoDB'],
          yearsOfExperience: 1,
          designation: params.role || 'Software Engineer',
          workExperience: [],
          education: [],
          projects: [],
        };

    const results = JobMatchingAgent.recommendJobs(candidate, updatedFilters, 10);

    let message = '';
    if (results.length === 0) {
      message = `I couldn't find any jobs matching your current criteria (`;
      const activeCriteria: string[] = [];
      if (updatedFilters.remoteOnly) activeCriteria.push('Remote only');
      if (updatedFilters.location) activeCriteria.push(`in ${updatedFilters.location}`);
      if (updatedFilters.skills?.length) activeCriteria.push(`skills: ${updatedFilters.skills.join(', ')}`);
      if (updatedFilters.minMatchPercentage) activeCriteria.push(`>${updatedFilters.minMatchPercentage}% match`);
      message += `${activeCriteria.join(', ')}).\n\nTry relaxing some filters, e.g. "Show all remote jobs" or "Find React jobs".`;
      return {
        intent: 'FIND_JOBS',
        message,
        jobs: [],
        filters: updatedFilters,
      };
    }

    message = `Here are the top **${results.length} matching jobs** based on your profile and filters:\n\n`;
    results.slice(0, 3).forEach((r, idx) => {
      message += `**${idx + 1}. ${r.job.title}** at **${r.job.company}** (${r.job.location})\n`;
      message += `- **Match Score:** \`${r.matchPercentage}%\`\n`;
      message += `- **Why:** ${r.matchReason}\n`;
      if (r.missingSkills.length > 0) {
        message += `- **Skills to learn:** ${r.missingSkills.slice(0, 3).join(', ')}\n`;
      }
      message += `\n`;
    });

    message += `*Reply **"Apply to job 1"** (or use the card's **Apply** button) to submit an application.*`;

    return {
      intent: 'FIND_JOBS',
      message,
      jobs: results,
      filters: updatedFilters,
    };
  }

  private static handleViewJob(jobIdOrQuery: string): OrchestratorResult {
    const job = JobService.getJobById(jobIdOrQuery);
    if (!job) {
      return {
        intent: 'VIEW_JOB',
        message: `Sorry, I couldn't find a job with ID or title matching "${jobIdOrQuery}".`,
      };
    }

    let msg = `### ${job.title} - ${job.company}\n\n`;
    msg += `- **Job ID:** \`${job.id}\`\n`;
    msg += `- **Location:** ${job.location}\n`;
    msg += `- **Employment Type:** ${job.employment_type}\n`;
    msg += `- **Experience Required:** ${job.experience_required}\n`;
    msg += `- **Skills:** ${job.skills.join(', ')}\n`;
    msg += `- **Source:** [View Original Posting](${job.source_link})\n\n`;
    msg += `#### Job Description\n${job.description}\n\n`;
    msg += `To apply, simply say **"Apply to ${job.id}"**.`;

    return {
      intent: 'VIEW_JOB',
      message: msg,
    };
  }

  private static async handleApplyJob(
    sessionId: string,
    jobIdentifier: string,
    session: any
  ): Promise<OrchestratorResult> {
    // Get recent recommendations from last assistant message metadata or jobs service
    const appRes: ApplicationResponse = await ApplicationAgent.initiateApplication(
      sessionId,
      jobIdentifier,
      JobService.getAllJobs().slice(0, 10)
    );

    return {
      intent: 'APPLY_JOB',
      message: appRes.message,
      requiresConfirmation: appRes.requiresConfirmation,
    };
  }

  private static async handleViewApplications(
    sessionId: string,
    search?: string
  ): Promise<OrchestratorResult> {
    const apps = await TrackingAgent.getApplications(sessionId, { search });
    const formatted = TrackingAgent.formatApplicationsMarkdown(apps, search);

    return {
      intent: 'VIEW_APPLICATIONS',
      message: formatted,
      application: apps,
    };
  }

  private static async handleGeneralQuestion(
    userMessage: string,
    session: any
  ): Promise<OrchestratorResult> {
    const groq = getGroqClient();

    if (groq) {
      try {
        const candidateContext = session.resumeData?.name
          ? `Candidate Name: ${session.resumeData.name}, Skills: ${session.resumeData.skills?.join(', ')}, Designation: ${session.resumeData.designation}`
          : 'Candidate has not yet uploaded a resume.';

        const response = await groq.chat.completions.create({
          model: getGroqModel(),
          messages: [
            {
              role: 'system',
              content: `You are the Hidani Tech AI Job Chat Assistant. Help candidates with career advice, interview questions, resume improvements, and understanding job requirements. Be encouraging, concise, and professional. Current candidate context: ${candidateContext}`,
            },
            ...(session.conversationHistory || [])
              .slice(-8)
              .filter((entry: any) => entry.role === 'user' || entry.role === 'assistant')
              .map((entry: any) => ({
                role: entry.role,
                content: entry.content.slice(0, 1000),
              })),
            {
              role: 'user',
              content: userMessage,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        const reply = response.choices[0]?.message?.content || "I'm here to assist you with job recommendations, resume analysis, and application tracking!";
        return {
          intent: 'GENERAL_QUESTION',
          message: reply,
        };
      } catch (err: any) {
        logger.warn('Groq LLM general query failed:', err);
      }
    }

    return {
      intent: 'GENERAL_QUESTION',
      message:
        "I'm your AI Job Assistant! I can help you analyze your resume, recommend matched software engineering jobs, filter by location or tech stack, and submit applications. What would you like to explore?",
    };
  }
}
