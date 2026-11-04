import Groq from 'groq-sdk';
import { logger } from '../utils/logger';

let groqClient: Groq | null = null;
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

export function summarizeGroqError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') {
    return { message: 'Unknown Groq API error' };
  }

  const value = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    error?: { code?: unknown; type?: unknown; message?: unknown };
  };
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const rawMessage = typeof value.error?.message === 'string'
    ? value.error.message
    : typeof value.message === 'string'
      ? value.message
      : 'Groq API request failed';
  const safeMessage = rawMessage
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/gsk_[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(apiKey || '\u0000', '[REDACTED]')
    .slice(0, 300);

  return {
    ...(typeof value.status === 'number' ? { status: value.status } : {}),
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
    ...(typeof value.error?.code === 'string' ? { apiCode: value.error.code } : {}),
    ...(typeof value.error?.type === 'string' ? { type: value.error.type } : {}),
    message: safeMessage,
  };
}

export const getGroqClient = (): Groq | null => {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || /^your_groq_api_key(?:_here)?$/i.test(apiKey)) {
    return null;
  }
  
  if (!groqClient) {
    try {
      groqClient = new Groq({ apiKey });
      logger.info('Groq SDK initialized successfully');
    } catch (err: any) {
      logger.error('Failed to initialize Groq SDK', summarizeGroqError(err));
      return null;
    }
  }
  return groqClient;
};

export const getGroqModel = (): string => {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
};
