import app from './app';
import { connectDB } from './config/db';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Attempt database connection
    try {
      await connectDB();
      logger.info('MongoDB connection established successfully.');
    } catch (dbErr: any) {
      logger.warn(`Could not connect to MongoDB on startup (${dbErr.message}). The server is accepting requests, but database-backed features will fail until MongoDB is available.`);
    }

    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info('API routes mounted under /api');
    });

    const gracefulShutdown = () => {
      logger.info('Received shutdown signal, terminating server gracefully...');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error: any) {
    logger.error('Fatal Server Startup Error:', error);
    process.exit(1);
  }
};

startServer();
