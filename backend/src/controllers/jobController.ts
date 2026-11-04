import { Request, Response, NextFunction } from 'express';
import { JobService } from '../services/jobService';
import { JobMatchingAgent } from '../agents/jobMatchingAgent';
import { SessionService } from '../services/sessionService';

export const handleGetJobs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.sessionId;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

    const filters: any = {};
    if (req.query.location) filters.location = String(req.query.location);
    if (req.query.remoteOnly === 'true') filters.remoteOnly = true;
    if (req.query.role) filters.role = String(req.query.role);
    if (req.query.minMatchPercentage) {
      filters.minMatchPercentage = parseInt(req.query.minMatchPercentage as string, 10);
    }
    if (req.query.skills) {
      filters.skills = Array.isArray(req.query.skills)
        ? (req.query.skills as string[])
        : String(req.query.skills).split(',').map((s) => s.trim());
    }

    let candidateProfile: any = null;
    if (sessionId) {
      const session = await SessionService.getOrCreateSession(sessionId);
      candidateProfile = session.resumeData;
    }

    if (!candidateProfile || !candidateProfile.skills || candidateProfile.skills.length === 0) {
      // Default profile if candidate hasn't uploaded a resume
      candidateProfile = {
        name: 'Guest',
        skills: filters.skills || ['JavaScript', 'React', 'Node.js'],
        yearsOfExperience: 1,
        designation: filters.role || 'Software Engineer',
      };
    }

    const matchedJobs = JobMatchingAgent.recommendJobs(candidateProfile, filters, 2000);

    const total = matchedJobs.length;
    const startIndex = (page - 1) * limit;
    const paginated = matchedJobs.slice(startIndex, startIndex + limit);

    return res.status(200).json({
      success: true,
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const handleGetJobById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const jobId = Array.isArray(req.params.jobId)
      ? req.params.jobId[0]
      : String(req.params.jobId);
    const job = JobService.getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { message: `Job with ID "${jobId}" not found`, statusCode: 404 },
      });
    }

    return res.status(200).json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};
