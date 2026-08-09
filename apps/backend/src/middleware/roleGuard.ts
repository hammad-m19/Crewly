import { Response, NextFunction } from 'express';
import { Role } from '@crewly/shared';
import { AuthRequest } from './auth';

/**
 * Role-based access control middleware factory.
 * Usage: `router.get('/route', authenticate, requireRole(Role.OWNER, Role.ACCOUNTANT), handler)`
 *
 * Returns 403 if the authenticated user's role is not in the allowed list.
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required.' },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
        },
      });
      return;
    }

    next();
  };
};
