import express from 'express'; // Server entry point - Restarted for numbering fix
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
import { machinesRouter } from './routes/machines';
import { mastersRouter } from './routes/masters';
import { contractItemsRouter } from './routes/contractItems'; // Added // Added
import { analyticsRouter } from './routes/analytics';
import { dashboardRouter } from './routes/dashboard';
import { dailyProductionRouter } from './routes/dailyProduction'; // Added daily production master route
import clippingRouter from './routes/clipping';
import { clippingVendorsRouter } from './routes/clippingVendors';
import { optimizedBillsRouter } from './routes/optimizedBills';
import { settingsRouter } from './routes/settings';
import billsRouter from './routes/bills';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { logger } from '../utils/logger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(config.cors));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
app.use('/api/admin', adminRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/masters', mastersRouter);
app.use('/api/contract-items', contractItemsRouter); // Added
app.use('/api/clipping', clippingRouter);
app.use('/api/clipping-vendors', clippingVendorsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/production-master', dailyProductionRouter); // Register Daily Production Master Route
app.use('/api/settings', settingsRouter);
app.use('/api/bills', billsRouter);
app.use('/api/optimized-bills', optimizedBillsRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware
// Error handling middleware
app.use(errorHandler);

// Serve React static files in production
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  const path = require('path');
  // Adjust the path to where your client build is located relative to built server
  // e.g., dist/server/server.js -> ../../client/build
  app.use(express.static(path.join(__dirname, '../../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
  });
}


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