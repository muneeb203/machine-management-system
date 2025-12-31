import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Default error
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = error.code || 'INTERNAL_ERROR';

  // Handle specific error types
  if (error.message.includes('duplicate key')) {
    statusCode = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_RESOURCE';
  }

  if (error.message.includes('foreign key')) {
    statusCode = 400;
    message = 'Invalid reference to related resource';
    code = 'INVALID_REFERENCE';
  }

  if (error.message.includes('not found')) {
    statusCode = 404;
    message = 'Resource not found';
    code = 'NOT_FOUND';
  }

  if (error.message.includes('validation')) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  }

  res.status(statusCode).json({
    error: {
      message,
      code,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};