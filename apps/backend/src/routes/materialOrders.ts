import { Router, Response } from 'express';
import { MaterialOrder } from '../models/MaterialOrder';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role, MaterialOrderStatus } from '@crewly/shared';

const router = Router();

/** POST /api/material-orders — Site Supervisor creates (no approval needed) */
router.post('/', requireRole(Role.SITE_SUPERVISOR, Role.SUPER_SUPERVISOR, Role.OWNER),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { projectId, material, quantity, notes } = req.body;
      if (!projectId || !material || !quantity) {
        res.status(400).json({ success: false, error: { message: 'projectId, material, quantity required.' } });
        return;
      }

      const order = new MaterialOrder({
        projectId,
        requestedBy: req.user!.userId,
        material,
        quantity,
        notes: notes || '',
        status: MaterialOrderStatus.NEEDED,
        statusHistory: [{
          status: MaterialOrderStatus.NEEDED,
          changedAt: new Date().toISOString(),
          changedBy: req.user!.userId,
        }],
      });

      await order.save();
      res.status(201).json({ success: true, data: order.toObject() });
    } catch (error) {
      console.error('Create material order error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

/** GET /api/material-orders?projectId=X */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, status } = req.query;
    const filter: Record<string, unknown> = { _deleted: false };
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;

    const orders = await MaterialOrder.find(filter).sort({ created_at: -1 }).lean();
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('List material orders error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/** PATCH /api/material-orders/:id/status — transition status */
router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, orderedDate, expectedDeliveryDate, receivedDate } = req.body;
    const order = await MaterialOrder.findById(req.params.id);

    if (!order || order._deleted) {
      res.status(404).json({ success: false, error: { message: 'Order not found.' } });
      return;
    }

    if (!Object.values(MaterialOrderStatus).includes(status)) {
      res.status(400).json({ success: false, error: { message: 'Invalid status.' } });
      return;
    }

    order.status = status;
    order.statusHistory.push({
      status,
      changedAt: new Date().toISOString(),
      changedBy: req.user!.userId,
    });

    if (orderedDate) order.orderedDate = orderedDate;
    if (expectedDeliveryDate) order.expectedDeliveryDate = expectedDeliveryDate;
    if (receivedDate) order.receivedDate = receivedDate;

    await order.save();
    res.json({ success: true, data: order.toObject() });
  } catch (error) {
    console.error('Update material order error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
