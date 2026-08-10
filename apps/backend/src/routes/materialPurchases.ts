import { Router, Response } from 'express';
import { MaterialPurchase } from '../models/MaterialPurchase';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role } from '@crewly/shared';

const router = Router();

/** POST /api/material-purchases — Log a purchase */
router.post('/', requireRole(Role.SITE_SUPERVISOR, Role.OWNER),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { projectId, material, amount, date, receiptPhotoUrl, linkedMaterialOrderId, notes } = req.body;

      if (!projectId || !material || amount === undefined || !date) {
        res.status(400).json({ success: false, error: { message: 'projectId, material, amount, date required.' } });
        return;
      }

      const purchase = new MaterialPurchase({
        projectId,
        purchasedBy: req.user!.userId,
        material,
        amount,
        date,
        loggedAt: Date.now(),
        receiptPhotoUrl: receiptPhotoUrl || null,
        linkedMaterialOrderId: linkedMaterialOrderId || null,
        notes: notes || '',
        // verified and flaggedLate are auto-computed in pre-save hook
      });

      await purchase.save();
      res.status(201).json({ success: true, data: purchase.toObject() });
    } catch (error) {
      console.error('Create material purchase error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

/** GET /api/material-purchases?projectId=X */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, verified, flaggedLate } = req.query;
    const filter: Record<string, unknown> = { _deleted: false };
    if (projectId) filter.projectId = projectId;
    if (verified !== undefined) filter.verified = verified === 'true';
    if (flaggedLate !== undefined) filter.flaggedLate = flaggedLate === 'true';

    const purchases = await MaterialPurchase.find(filter).sort({ date: -1 }).lean();
    res.json({ success: true, data: purchases });
  } catch (error) {
    console.error('List material purchases error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/** PATCH /api/material-purchases/:id/verify — Accountant verifies a purchase */
router.patch('/:id/verify', requireRole(Role.ACCOUNTANT),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const purchase = await MaterialPurchase.findById(req.params.id);
      if (!purchase || purchase._deleted) {
        res.status(404).json({ success: false, error: { message: 'Purchase not found.' } });
        return;
      }

      purchase.verified = true;
      await purchase.save();
      res.json({ success: true, data: purchase.toObject() });
    } catch (error) {
      console.error('Verify purchase error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

/** PATCH /api/material-purchases/:id/receipt — attach receipt photo after the fact */
router.patch('/:id/receipt', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { receiptPhotoUrl } = req.body;
    const purchase = await MaterialPurchase.findById(req.params.id);
    if (!purchase || purchase._deleted) {
      res.status(404).json({ success: false, error: { message: 'Purchase not found.' } });
      return;
    }
    purchase.receiptPhotoUrl = receiptPhotoUrl;
    await purchase.save();
    res.json({ success: true, data: purchase.toObject() });
  } catch (error) {
    console.error('Attach receipt error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
