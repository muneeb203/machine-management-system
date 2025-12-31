import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { db } from '../../database/connection';
import { User } from '../../types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: number };
    
    // Get user from database
    const user = await db('users')
      .where({ id: decoded.userId, is_active: true })
      .whereNull('deleted_at')
      .first();

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireProgrammer = requireRole(['admin', 'programmer']);
export const requireOperator = requireRole(['admin', 'programmer', 'operator']);
export const requireInventoryClerk = requireRole(['admin', 'inventory_clerk']);
export const requireAuditor = requireRole(['admin', 'auditor']);