import { Router, Response } from 'express';
import { PettyCash } from '../models/PettyCash';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role } from '@crewly/shared';

const router = Router();

/** GET /api/petty-cash?projectId=X or ?siteSupervisorId=X */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { _deleted: false };
    const { projectId, siteSupervisorId } = req.query;
    if (projectId) filter.projectId = projectId;
    if (siteSupervisorId) filter.siteSupervisorId = siteSupervisorId;

    // Site Supervisor sees only their own petty cash
    if (req.user!.role === Role.SITE_SUPERVISOR) {
      filter.siteSupervisorId = req.user!.userId;
    }

    const records = await PettyCash.find(filter).sort({ created_at: -1 }).lean();
    res.json({ success: true, data: records });
  } catch (error) {
    console.error('List petty cash error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * POST /api/petty-cash/issue-float — Accountant issues float to a Site Supervisor.
 * Blocked if previous batch is unreconciled.
 */
router.post('/issue-float', requireRole(Role.ACCOUNTANT, Role.OWNER),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { siteSupervisorId, projectId, amount } = req.body;
      if (!siteSupervisorId || !projectId || !amount) {
        res.status(400).json({ success: false, error: { message: 'siteSupervisorId, projectId, amount required.' } });
        return;
      }

      // Check for unreconciled batch
      let record = await PettyCash.findOne({
        siteSupervisorId,
        projectId,
        reconciled: false,
        _deleted: false,
      });

      if (record) {
        // Existing unreconciled record — block new float
        res.status(409).json({
          success: false,
          error: { message: 'Previous petty cash batch is not reconciled. Reconcile first before issuing a new float.' },
        });
        return;
      }

      // Create new petty cash record with this float
      record = new PettyCash({
        siteSupervisorId,
        projectId,
        floatIssued: [{
          amount,
          issuedDate: new Date().toISOString().split('T')[0],
          issuedBy: req.user!.userId,
        }],
        expenses: [],
        reconciled: false,
      });

      await record.save();
      res.status(201).json({ success: true, data: record.toObject() });
    } catch (error) {
      console.error('Issue float error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

/** POST /api/petty-cash/:id/expense — Site Supervisor logs an expense */
router.post('/:id/expense', requireRole(Role.SITE_SUPERVISOR),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { amount, date, description, receiptPhoto } = req.body;
      if (!amount || !date || !description) {
        res.status(400).json({ success: false, error: { message: 'amount, date, description required.' } });
        return;
      }

      const record = await PettyCash.findById(req.params.id);
      if (!record || record._deleted) {
        res.status(404).json({ success: false, error: { message: 'Petty cash record not found.' } });
        return;
      }

      if (record.siteSupervisorId.toString() !== req.user!.userId) {
        res.status(403).json({ success: false, error: { message: 'This petty cash record belongs to another supervisor.' } });
        return;
      }

      if (record.reconciled) {
        res.status(400).json({ success: false, error: { message: 'Cannot add expenses to a reconciled batch.' } });
        return;
      }

      record.expenses.push({ amount, date, description, receiptPhoto });
      await record.save(); // pre-save hook recomputes currentBalance

      res.json({ success: true, data: record.toObject() });
    } catch (error) {
      console.error('Add expense error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

/** POST /api/petty-cash/:id/reconcile — Accountant reconciles a batch */
router.post('/:id/reconcile', requireRole(Role.ACCOUNTANT),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const record = await PettyCash.findById(req.params.id);
      if (!record || record._deleted) {
        res.status(404).json({ success: false, error: { message: 'Petty cash record not found.' } });
        return;
      }

      record.reconciled = true;
      await record.save();
      res.json({ success: true, data: record.toObject() });
    } catch (error) {
      console.error('Reconcile error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

export default router;
