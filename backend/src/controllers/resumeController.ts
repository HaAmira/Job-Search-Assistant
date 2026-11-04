import { Request, Response, NextFunction } from 'express';
import { ResumeAgent } from '../agents/resumeAgent';
import { SessionService } from '../services/sessionService';
import { logger } from '../utils/logger';

export const handleResumeUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.sessionId!;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { message: 'Please upload a PDF or DOCX file under key "resume"', statusCode: 400 },
      });
    }

    logger.info('Extracting text from uploaded resume');

    // Extract text from in-memory buffer
    const rawText = await ResumeAgent.extractTextFromBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    // Parse with Groq LLM or deterministic fallback
    const parsedData = await ResumeAgent.parseResume(rawText);

    // Uploads can be the first request for a session, so ensure it exists before saving.
    await SessionService.getOrCreateSession(sessionId);
    const savedProfile = await SessionService.updateResumeData(sessionId, parsedData);
    if (!savedProfile) {
      throw new Error('Unable to persist resume profile');
    }

    // Record welcome acknowledgment in chat history
    const introMessage = `I've successfully parsed your resume, **${parsedData.name || 'Candidate'}**!\n\n` +
      `Here is a summary of what I found:\n` +
      `- **Designation:** ${parsedData.designation || 'Software Engineer'}\n` +
      `- **Experience:** ~${parsedData.yearsOfExperience || 0} years\n` +
      `- **Key Skills (${parsedData.skills.length}):** ${parsedData.skills.slice(0, 8).join(', ')}${parsedData.skills.length > 8 ? '...' : ''}\n\n` +
      `You can now ask: *"Recommend jobs for me"*, *"Show only remote jobs"*, or *"Find jobs matching React and Node.js"*.`;

    await SessionService.addMessage(sessionId, 'assistant', introMessage, {
      intent: 'ANALYZE_RESUME',
      candidateProfile: parsedData,
    });

    return res.status(200).json({
      success: true,
      message: 'Resume parsed and profile updated successfully',
      data: parsedData,
    });
  } catch (err: any) {
    logger.error('Error in handleResumeUpload:', err);
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Failed to process resume', statusCode: 400 },
    });
  }
};

export const handleUpdateResume = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.sessionId!;

    const updates = req.body.resumeData || req.body;
    const session = await SessionService.getOrCreateSession(sessionId);

    const updatedProfile = ResumeAgent.correctResumeDetails(
      session.resumeData || {
        skills: [],
        workExperience: [],
        yearsOfExperience: 0,
        education: [],
        projects: [],
      },
      updates
    );

    await SessionService.updateResumeData(sessionId, updatedProfile);

    return res.status(200).json({
      success: true,
      message: 'Resume profile updated successfully',
      data: updatedProfile,
    });
  } catch (err) {
    next(err);
  }
};

export const handleGetResume = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.sessionId!;

    const session = await SessionService.getOrCreateSession(sessionId);
    return res.status(200).json({
      success: true,
      data: session.resumeData || null,
    });
  } catch (err) {
    next(err);
  }
};
