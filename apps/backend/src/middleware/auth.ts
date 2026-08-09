import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';
import { Role } from '@crewly/shared';

/** Payload stored in JWT */
export interface JwtPayload {
  userId: string;
  role: Role;
  email: string;
}

/** Extended Request with authenticated user data */
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches `req.user` with userId, role, and email.
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required. Provide a Bearer token.' },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: { message: 'Token expired. Please refresh or log in again.', code: 'TOKEN_EXPIRED' },
      });
      return;
    }
    res.status(401).json({
      success: false,
      error: { message: 'Invalid token.' },
    });
  }
};
