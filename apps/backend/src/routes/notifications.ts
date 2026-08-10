import { Router, Response } from 'express';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/notifications
 * List the authenticated user's notifications, most recent first.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '30', unreadOnly } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const filter: Record<string, unknown> = {
      recipientUserId: req.user!.userId,
      _deleted: false,
    };

    if (unreadOnly === 'true') {
      filter.read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ created_at: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        recipientUserId: req.user!.userId,
        _deleted: false,
        read: false,
      }),
    ]);

    res.json({
      success: true,
      data: notifications,
      total,
      unreadCount,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipientUserId: req.user!.userId,
      _deleted: false,
    });

    if (!notification) {
      res.status(404).json({ success: false, error: { message: 'Notification not found.' } });
      return;
    }

    notification.read = true;
    notification.updated_at = Date.now();
    await notification.save();

    res.json({ success: true, data: notification.toObject() });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all of the authenticated user's notifications as read.
 */
router.patch('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipientUserId: req.user!.userId, read: false, _deleted: false },
      { read: true, updated_at: Date.now() }
    );

    res.json({ success: true, data: { message: 'All notifications marked as read.' } });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
