import { Request, Response, NextFunction } from 'express';
import { Orchestrator } from '../agents/orchestrator';

export const handleChatMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { message } = req.body;
    const sessionId = req.sessionId!;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'message must be a non-empty string', statusCode: 400 },
      });
    }

    const result = await Orchestrator.processMessage(sessionId, message);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
