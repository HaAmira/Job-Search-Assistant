import { Request, Response, NextFunction } from 'express';
import { ApplicationAgent } from '../agents/applicationAgent';
import { TrackingAgent } from '../agents/trackingAgent';

export const handleApply = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.sessionId!;
    const { jobId, confirm } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: { message: 'jobId is required to submit an application', statusCode: 400 },
      });
    }

    if (confirm === true) {
      const result = await ApplicationAgent.confirmApplication(sessionId, jobId);
      if (!result.success) {
        return res.status(409).json({
          success: false,
          error: { message: result.message, statusCode: 409 },
        });
      }
      return res.status(201).json({
        success: true,
        message: result.message,
        data: result.application,
      });
    }

    // Direct initiation / confirmation flow
    const result = await ApplicationAgent.initiateApplication(sessionId, jobId);
    return res.status(200).json({
      success: result.success,
      requiresConfirmation: result.requiresConfirmation,
      message: result.message,
      data: result.job,
    });
  } catch (err) {
    next(err);
  }
};

export const handleGetApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.sessionId!;

    const { search, status } = req.query;
    const applications = await TrackingAgent.getApplications(sessionId, {
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: applications,
      total: applications.length,
    });
  } catch (err) {
    next(err);
  }
};

export const handleGetApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sessionId = req.sessionId!;

    const applicationId = Array.isArray(req.params.applicationId)
      ? req.params.applicationId[0]
      : String(req.params.applicationId);

    const app = await TrackingAgent.getApplicationById(sessionId, applicationId);
    if (!app) {
      return res.status(404).json({
        success: false,
        error: { message: 'Application not found', statusCode: 404 },
      });
    }

    return res.status(200).json({
      success: true,
      data: app,
    });
  } catch (err) {
    next(err);
  }
};
