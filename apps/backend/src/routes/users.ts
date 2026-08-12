import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Role, NotificationType, DEFAULT_NOTIFICATION_PREFERENCES } from '@crewly/shared';
import { authConfig } from '../config/auth';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

const router = Router();

const NOTIFICATION_TYPES: string[] = Object.values(NotificationType);

/**
 * PATCH /api/users/me/fcm-token
 * Store (or clear) the device FCM token used for push notifications.
 */
router.patch('/me/fcm-token', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fcmToken } = req.body;

    if (fcmToken !== null && fcmToken !== undefined && typeof fcmToken !== 'string') {
      res.status(400).json({
        success: false,
        error: { message: 'fcmToken must be a string or null.' },
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { fcmToken: fcmToken || null, updated_at: Date.now() },
      { new: true }
    ).select('fcmToken');

    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found.' } });
      return;
    }

    res.json({
      success: true,
      data: { fcmToken: user.fcmToken || null },
    });
  } catch (error) {
    console.error('Update FCM token error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/users/me/notification-prefs
 * Any authenticated user reads their own preferences. Types the user has never
 * touched come back enabled.
 */
router.get('/me/notification-prefs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('notificationPrefs').lean();
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found.' } });
      return;
    }

    res.json({
      success: true,
      data: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(user.notificationPrefs || {}) },
    });
  } catch (error) {
    console.error('Get notification prefs error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * PATCH /api/users/me/notification-prefs
 * Accepts a partial map of notification type → enabled and merges it in.
 */
router.patch('/me/notification-prefs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const incoming = req.body?.preferences;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ success: false, error: { message: 'preferences object is required.' } });
      return;
    }

    const invalidKey = Object.keys(incoming).find((key) => !NOTIFICATION_TYPES.includes(key));
    if (invalidKey) {
      res.status(400).json({
        success: false,
        error: { message: `Unknown notification type: ${invalidKey}` },
      });
      return;
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found.' } });
      return;
    }

    const merged: Record<string, boolean> = { ...(user.notificationPrefs || {}) };
    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = Boolean(value);
    }

    user.notificationPrefs = merged;
    user.markModified('notificationPrefs');
    await user.save();

    res.json({
      success: true,
      data: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...merged },
    });
  } catch (error) {
    console.error('Update notification prefs error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/users
 * Owner-only: list all users with the names of the sites they're assigned to.
 */
router.get('/', requireRole(Role.OWNER), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { _deleted: false };
    if (req.query.role) filter.role = req.query.role;

    const [users, projects] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ role: 1, name: 1 }).lean(),
      Project.find({ _deleted: false }).select('name').lean(),
    ]);

    const projectNames = new Map(projects.map((p: any) => [p._id.toString(), p.name]));

    res.json({
      success: true,
      data: users.map((user: any) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        isActive: user.isActive,
        assignedSites: (user.assignedSites || []).map((siteId: any) => ({
          projectId: siteId.toString(),
          name: projectNames.get(siteId.toString()) || 'Unknown project',
        })),
        createdAt: user.created_at,
      })),
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * POST /api/users
 * Owner-only: create a user. Mirrors /auth/register but also accepts site
 * assignments so the Owner can onboard a supervisor in one step.
 */
router.post('/', requireRole(Role.OWNER), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, phone, assignedSites } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({
        success: false,
        error: { message: 'name, email, password, and role are required.' },
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

    if (String(password).length < 8) {
      res.status(400).json({
        success: false,
        error: { message: 'Password must be at least 8 characters.' },
      });
      return;
    }

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      res.status(409).json({
        success: false,
        error: { message: 'An account with this email already exists.' },
      });
      return;
    }

    const user = new User({
      name,
      email: String(email).toLowerCase(),
      passwordHash: await bcrypt.hash(password, authConfig.saltRounds),
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
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * PATCH /api/users/:id
 * Owner-only: update profile, role, site assignments, active state, or reset
 * the password.
 */
router.patch('/:id', requireRole(Role.OWNER), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user._deleted) {
      res.status(404).json({ success: false, error: { message: 'User not found.' } });
      return;
    }

    const { name, phone, role, assignedSites, isActive, password } = req.body;
    const isSelf = user._id.toString() === req.user!.userId;

    // Guard against an Owner locking themselves out of the app.
    if (isSelf && role && role !== Role.OWNER) {
      res.status(400).json({
        success: false,
        error: { message: 'You cannot change your own role.' },
      });
      return;
    }
    if (isSelf && isActive === false) {
      res.status(400).json({
        success: false,
        error: { message: 'You cannot deactivate your own account.' },
      });
      return;
    }

    if (role && !Object.values(Role).includes(role)) {
      res.status(400).json({
        success: false,
        error: { message: `Invalid role. Must be one of: ${Object.values(Role).join(', ')}` },
      });
      return;
    }

    if (password !== undefined) {
      if (String(password).length < 8) {
        res.status(400).json({
          success: false,
          error: { message: 'Password must be at least 8 characters.' },
        });
        return;
      }
      user.passwordHash = await bcrypt.hash(password, authConfig.saltRounds);
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) user.role = role;
    if (assignedSites !== undefined) user.assignedSites = assignedSites;
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        isActive: user.isActive,
        assignedSites: user.assignedSites.map((s) => s.toString()),
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
