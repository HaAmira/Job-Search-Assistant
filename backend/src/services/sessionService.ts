import { UserSession, IUserSession, IResumeData, IJobFilter } from '../models/UserSession';
import { logger } from '../utils/logger';
import { assertValidSessionId } from '../utils/sessionId';

export class SessionService {
  /**
   * Retrieve existing session or initialize a new one with the given sessionId
   */
  static async getOrCreateSession(sessionId: string): Promise<IUserSession> {
    assertValidSessionId(sessionId);
    let session = await UserSession.findOne({ sessionId });
    if (!session) {
      session = new UserSession({
        sessionId,
        conversationHistory: [],
        currentFilters: {},
      });
      await session.save();
      logger.info('Initialized new anonymous bearer session');
    }
    return session;
  }

  /**
   * Append a message to conversation history
   */
  static async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<IUserSession | null> {
    assertValidSessionId(sessionId);
    const session = await UserSession.findOneAndUpdate(
      { sessionId },
      {
        $push: {
          conversationHistory: {
            role,
            content,
            timestamp: new Date(),
            metadata,
          },
        },
      },
      { new: true, upsert: true }
    );
    return session;
  }

  /**
   * Update resume data for the session
   */
  static async updateResumeData(
    sessionId: string,
    resumeData: Partial<IResumeData>
  ): Promise<IUserSession | null> {
    assertValidSessionId(sessionId);
    const session = await UserSession.findOne({ sessionId });
    if (!session) return null;

    session.resumeData = {
      ...(session.resumeData || { skills: [], workExperience: [], education: [], projects: [], yearsOfExperience: 0 }),
      ...resumeData,
    };

    await session.save();
    logger.info('Updated resume profile for anonymous bearer session');
    return session;
  }

  /**
   * Update active job filters
   */
  static async updateFilters(
    sessionId: string,
    filters: IJobFilter
  ): Promise<IUserSession | null> {
    assertValidSessionId(sessionId);
    const session = await UserSession.findOne({ sessionId });
    if (!session) return null;

    session.currentFilters = filters;

    await session.save();
    return session;
  }

  /**
   * Clear or set pending application confirmation
   */
  static async setPendingApplication(
    sessionId: string,
    jobId: string | null
  ): Promise<void> {
    assertValidSessionId(sessionId);
    await UserSession.updateOne(
      { sessionId },
      { $set: { pendingApplicationJobId: jobId } }
    );
  }
}
