import { Router, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../database/connection';
import { config } from '../../config';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import Joi from 'joi';

const router = Router();

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'programmer', 'operator', 'inventory_clerk', 'auditor').required(),
});

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', asyncHandler(async (req: ExpressRequest, res: ExpressResponse) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { username, password } = req.body;

  // Find user
  const user = await db('users')
    .where({ username, is_active: true })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as any
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}));

/**
 * POST /api/auth/register
 * User registration (Admin only in production)
 */
router.post('/register', asyncHandler(async (req: ExpressRequest, res: ExpressResponse) => {
  const { error } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }

  const { username, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = await db('users')
    .where(function () {
      this.where('username', username).orWhere('email', email);
    })
    .whereNull('deleted_at')
    .first();

  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already exists' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);

  // Create user
  const [newUser] = await db('users')
    .insert({
      username,
      email,
      password_hash: passwordHash,
      role,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning(['id', 'username', 'email', 'role']);

  res.status(201).json({
    message: 'User created successfully',
    user: newUser,
  });
}));

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: ExpressResponse) => {
  res.json({ user: req.user });
}));

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: ExpressResponse) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  // Get current user with password
  const user = await db('users')
    .where('id', req.user!.id)
    .first();

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);

  // Update password
  await db('users')
    .where('id', req.user!.id)
    .update({
      password_hash: newPasswordHash,
      updated_at: new Date(),
    });

  res.json({ message: 'Password changed successfully' });
}));

export { router as authRouter };