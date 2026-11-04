import { Application, IApplication } from '../models/Application';
import { UserSession } from '../models/UserSession';
import { IJob, JobService } from '../services/jobService';
import { SessionService } from '../services/sessionService';
import { logger } from '../utils/logger';

export interface ApplicationResponse {
  success: boolean;
  requiresConfirmation?: boolean;
  job?: IJob;
  application?: IApplication;
  message: string;
}

export class ApplicationAgent {
  /**
   * Resolve a job from user input (e.g. "JOB0123", "apply to job 3", "3")
   */
  public static resolveJob(
    jobIdentifier: string,
    recentRecommendations: IJob[] = []
  ): IJob | null {
    const raw = jobIdentifier.trim();

    // 1. Check exact job ID in JobService (e.g. JOB0001)
    const exactJob = JobService.getJobById(raw);
    if (exactJob) return exactJob;

    // 2. Extract numeric index from text like "job 2" or "2"
    const indexMatch = raw.match(/job\s*(\d+)/i) || raw.match(/^(\d+)$/);
    if (indexMatch && recentRecommendations.length > 0) {
      const idx = parseInt(indexMatch[1], 10) - 1; // 1-based index to 0-based
      if (idx >= 0 && idx < recentRecommendations.length) {
        return recentRecommendations[idx];
      }
    }

    // 3. Match by company name or title fragment in recent recommendations
    if (recentRecommendations.length > 0) {
      const lower = raw.toLowerCase();
      const match = recentRecommendations.find(
        (j) => lower.includes(j.company.toLowerCase()) || lower.includes(j.title.toLowerCase())
      );
      if (match) return match;
    }

    return null;
  }

  /**
   * Request confirmation from candidate before submitting an application
   */
  public static async initiateApplication(
    sessionId: string,
    jobIdentifier: string,
    recentRecommendations: IJob[] = []
  ): Promise<ApplicationResponse> {
    const job = this.resolveJob(jobIdentifier, recentRecommendations);

    if (!job) {
      return {
        success: false,
        message: `I couldn't identify which job you'd like to apply to. Please specify the Job ID (e.g., "${recentRecommendations[0]?.id || 'JOB0001'}") or reference the card number (e.g., "Apply to job 1").`,
      };
    }

    // Check if already applied
    const existing = await Application.findOne({ sessionId, jobId: job.id });
    if (existing) {
      return {
        success: false,
        job,
        message: `You have already applied for **${job.title}** at **${job.company}** on ${new Date(
          existing.appliedAt
        ).toLocaleDateString()}. Status: **${existing.status}**. Duplicate applications are prevented.`,
      };
    }

    // Set pending application job ID in session for two-step confirmation
    await SessionService.setPendingApplication(sessionId, job.id);

    return {
      success: true,
      requiresConfirmation: true,
      job,
      message: `Would you like to confirm your application for **${job.title}** at **${job.company}** (${job.location})?\n\n*Reply **"Yes"** or **"Confirm"** to submit your application.*`,
    };
  }

  /**
   * Finalize and store application after user confirms
   */
  public static async confirmApplication(
    sessionId: string,
    targetJobId?: string
  ): Promise<ApplicationResponse> {
    let jobId = targetJobId;

    if (!jobId) {
      const session = await UserSession.findOne({ sessionId });
      jobId = session?.pendingApplicationJobId || undefined;
    }

    if (!jobId) {
      return {
        success: false,
        message: 'No pending application found to confirm. Please select a job to apply for first.',
      };
    }

    const job = JobService.getJobById(jobId);
    if (!job) {
      await SessionService.setPendingApplication(sessionId, null);
      return {
        success: false,
        message: `Job ID "${jobId}" is no longer available.`,
      };
    }

    try {
      const newApp = new Application({
        sessionId,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        sourceLink: job.source_link,
        appliedAt: new Date(),
        status: 'Submitted',
      });

      await newApp.save();
      await SessionService.setPendingApplication(sessionId, null);

      logger.info(`Recorded application for job ${job.id}`);

      return {
        success: true,
        job,
        application: newApp,
        message: `Your application for **${job.title}** at **${job.company}** has been successfully recorded in your dashboard!\n\n*(Note: This application is tracked internally in our candidate portal. External employer systems are not contacted automatically.)*`,
      };
    } catch (err: any) {
      // Check for MongoDB unique compound index error
      if (err.code === 11000) {
        await SessionService.setPendingApplication(sessionId, null);
        return {
          success: false,
          job,
          message: `You have already submitted an application for **${job.title}** at **${job.company}**. Duplicate applications are not allowed.`,
        };
      }

      logger.error('Error recording application:', err);
      return {
        success: false,
        message: `An error occurred while saving your application: ${err.message}`,
      };
    }
  }
}
