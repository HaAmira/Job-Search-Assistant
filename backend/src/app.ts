import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chatRoutes';
import resumeRoutes from './routes/resumeRoutes';
import jobRoutes from './routes/jobRoutes';
import applicationRoutes from './routes/applicationRoutes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { sessionAccess } from './middleware/sessionAuth';
import { SessionService } from './services/sessionService';
import { JobService } from './services/jobService';

const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

// CORS configuration
const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === 'production' && configuredOrigins.length === 0) {
  throw new Error('CLIENT_URL must contain the deployed frontend origin in production.');
}
const productionOrigins = configuredOrigins.map((origin) => {
  const parsed = new URL(origin);
  if (parsed.origin !== origin || (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:')) {
    throw new Error('CLIENT_URL entries must be exact origins; production origins must use HTTPS.');
  }
  return parsed.origin;
});

const allowedOrigins = [
  ...productionOrigins,
  ...(process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173']),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiter
app.use('/api', rateLimiter());

// Pre-load jobs cache
JobService.loadJobs();

// Routes
app.use('/api/chat', sessionAccess(), chatRoutes);
app.use('/api/resume', sessionAccess(), resumeRoutes);
app.use('/api/jobs', sessionAccess(false), jobRoutes);
app.use('/api/applications', sessionAccess(), applicationRoutes);

// Session endpoint
app.get('/api/session', sessionAccess(), async (req, res, next) => {
  try {
    const session = await SessionService.getOrCreateSession(req.sessionId!);
    return res.status(200).json({
      success: true,
      data: session,
    });
  } catch (err) {
    next(err);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    jobsLoaded: JobService.count(),
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    jobsLoaded: JobService.count(),
  });
});

// Centralized error handler
app.use(errorHandler);

export default app;
