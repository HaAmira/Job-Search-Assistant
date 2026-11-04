import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${req.method}] ${req.url} - Error ${statusCode}: ${message}`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      details: process.env.NODE_ENV === 'development' ? err.details || err.stack : undefined,
    },
  });
};

