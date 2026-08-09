import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@crewly/shared';
import { authConfig } from '../config/auth';
import { User } from '../models/User';
import { authenticate, AuthRequest, JwtPayload } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router = Router();

/**
 * POST /auth/login
 * Public — authenticates user and returns JWT tokens
 */
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Email and password are required.' },
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase(), _deleted: false });
    if (!user) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' },
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: { message: 'Account is deactivated. Contact your administrator.' },
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' },
      });
      return;
    }

    const payload: JwtPayload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    const token = jwt.sign(payload, authConfig.jwtSecret, {
      expiresIn: authConfig.jwtExpiresIn,
    });

    const refreshToken = jwt.sign(payload, authConfig.jwtRefreshSecret, {
      expiresIn: authConfig.jwtRefreshExpiresIn,
    });

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          assignedSites: user.assignedSites.map((s) => s.toString()),
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error.' },
    });
  }
});

/**
 * POST /auth/register
 * Owner-only — creates new user accounts
 * (In production, the first Owner account is seeded manually or via a setup script)
 */
router.post(
  '/register',
  authenticate,
  requireRole(Role.OWNER),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, email, password, role, phone, assignedSites } = req.body;

      if (!name || !email || !password || !role) {
        res.status(400).json({
          success: false,
          error: { message: 'Name, email, password, and role are required.' },
        });
        return;
      }

      if (!Object.values(Role).includes(role)) {
        res.status(400).json({
          success: false,
          error: { message: `Invalid role. Must be one of: ${Object.values(Role).join(', ')}` },
        });
        return;
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        res.status(409).json({
          success: false,
          error: { message: 'An account with this email already exists.' },
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, authConfig.saltRounds);

      const user = new User({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        phone,
        assignedSites: assignedSites || [],
      });

      await user.save();

      res.status(201).json({
        success: true,
        data: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Internal server error.' },
      });
    }
  }
);

/**
 * POST /auth/refresh
 * Public — exchanges a valid refresh token for a new access token
 */
router.post('/refresh', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: { message: 'Refresh token is required.' },
      });
      return;
    }

    const decoded = jwt.verify(refreshToken, authConfig.jwtRefreshSecret) as JwtPayload;

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive || user._deleted) {
      res.status(401).json({
        success: false,
        error: { message: 'User no longer active.' },
      });
      return;
    }

    const payload: JwtPayload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    const newToken = jwt.sign(payload, authConfig.jwtSecret, {
      expiresIn: authConfig.jwtExpiresIn,
    });

    res.json({
      success: true,
      data: { token: newToken },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid refresh token.' },
    });
  }
});

/**
 * POST /auth/fcm-token
 * Authenticated — stores the user's FCM device token for push notifications
 */
router.post('/fcm-token', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      res.status(400).json({
        success: false,
        error: { message: 'FCM token is required.' },
      });
      return;
    }

    await User.findByIdAndUpdate(req.user!.userId, { fcmToken });

    res.json({ success: true });
  } catch (error) {
    console.error('FCM token update error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error.' },
    });
  }
});

/**
 * GET /auth/me
 * Authenticated — returns current user's profile
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash');

    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found.' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        assignedSites: user.assignedSites.map((s) => s.toString()),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error.' },
    });
  }
});

export default router;
