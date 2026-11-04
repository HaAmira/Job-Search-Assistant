import { NextFunction, Request, Response } from 'express';
import { isValidSessionId } from '../utils/sessionId';

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

function reject(res: Response, statusCode: number, message: string) {
  return res.status(statusCode).json({
    success: false,
    error: { message, statusCode },
  });
}

export function sessionAccess(required = true) {
  return (req: Request, res: Response, next: NextFunction) => {
    const supplied: unknown[] = [];

    if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'sessionId')) {
      supplied.push(req.query.sessionId);
    }
    if (req.body && typeof req.body === 'object' &&
        Object.prototype.hasOwnProperty.call(req.body, 'sessionId')) {
      supplied.push(req.body.sessionId);
    }
    const header = req.headers['x-session-id'];
    if (header !== undefined) supplied.push(header);

    if (supplied.length === 0) {
      if (!required) return next();
      return reject(res, 400, 'A session bearer ID is required');
    }

    if (supplied.some((value) => !isValidSessionId(value))) {
      return reject(res, 400, 'Invalid session bearer ID');
    }

    const sessionId = supplied[0] as string;
    if (supplied.some((value) => value !== sessionId)) {
      return reject(res, 403, 'Conflicting session bearer IDs');
    }

    req.sessionId = sessionId;
    return next();
  };
}
