import { Application, IApplication, ApplicationStatus } from '../models/Application';
import { logger } from '../utils/logger';

export class TrackingAgent {
  /**
   * Retrieve applications for a session with optional search or status filter
   */
  public static async getApplications(
    sessionId: string,
    filters?: {
      search?: string;
      status?: ApplicationStatus | string;
    }
  ): Promise<IApplication[]> {
    try {
      const query: any = { sessionId };

      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.search && filters.search.trim()) {
        const regex = new RegExp(filters.search.trim(), 'i');
        query.$or = [{ jobTitle: regex }, { company: regex }, { jobId: regex }];
      }

      const applications = await Application.find(query).sort({ appliedAt: -1 });
      return applications;
    } catch (err: any) {
      logger.error('Error fetching applications in TrackingAgent:', err);
      return [];
    }
  }

  /**
   * Retrieve single application by ID
   */
  public static async getApplicationById(
    sessionId: string,
    applicationId: string
  ): Promise<IApplication | null> {
    try {
      return await Application.findOne({ sessionId, _id: applicationId });
    } catch (err: any) {
      logger.error('Error fetching application by ID:', err);
      return null;
    }
  }

  /**
   * Format application history into natural conversational markdown
   */
  public static formatApplicationsMarkdown(
    applications: IApplication[],
    searchKeyword?: string
  ): string {
    if (applications.length === 0) {
      if (searchKeyword) {
        return `No applications found matching "${searchKeyword}".`;
      }
      return `You have not applied to any jobs yet in this session.\n\nBrowse recommended jobs and simply say **"Apply to job 1"** or **"Apply to [Job ID]"** to submit your application.`;
    }

    let markdown = `### Your Application History (${applications.length} total)\n\n`;

    applications.forEach((app, idx) => {
      const dateStr = new Date(app.appliedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const statusBadge = getStatusEmoji(app.status);

      markdown += `${idx + 1}. **${app.jobTitle}** at **${app.company}**\n`;
      markdown += `   - **Job ID:** \`${app.jobId}\`\n`;
      markdown += `   - **Applied Date:** ${dateStr}\n`;
      markdown += `   - **Status:** ${statusBadge} **${app.status}**\n`;
      if (app.location) {
        markdown += `   - **Location:** ${app.location}\n`;
      }
      markdown += `\n`;
    });

    markdown += `*All applications are stored safely in your session database. Duplicate applications are prevented.*`;
    return markdown;
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'Submitted':
      return '📝';
    case 'Under Review':
      return '🔍';
    case 'Interview Scheduled':
      return '📅';
    case 'Accepted':
      return '🎉';
    case 'Rejected':
      return '❌';
    default:
      return '📌';
  }
}

