import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDB = async (customUri?: string): Promise<typeof mongoose> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required. Set it in backend/.env or the deployment environment.');
  }
  
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB Connected successfully to ${conn.connection.host}`);
    return conn;
  } catch (error: any) {
    logger.error(`MongoDB Connection Error: ${error.message}`);
    // In dev or test environments, warn rather than crash immediately
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info('MongoDB Disconnected');
};

