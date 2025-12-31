import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../config';
import { testConnection } from '../database/connection';
import { authRouter } from './routes/auth';
import { contractRouter } from './routes/contracts';
import { productionRouter } from './routes/production';
import { billingRouter } from './routes/billing';
import { gatePassRouter } from './routes/gatePasses';
import { reportsRouter } from './routes/reports';
import { adminRouter } from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { logger } from '../utils/logger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(config.cors));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/contracts', contractRouter);
app.use('/api/production', productionRouter);
app.use('/api/billing', billingRouter);
app.use('/api/gate-passes', gatePassRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }
    
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

export default app;