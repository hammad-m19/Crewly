import { Router, Response } from 'express';
import { Payment } from '../models/Payment';
import { TeamSiteAssignment } from '../models/TeamSiteAssignment';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role, PaymentRecordType } from '@crewly/shared';

const router = Router();

/** All payment records are financial data — Accountant and Owner only. */
router.use(requireRole(Role.ACCOUNTANT, Role.OWNER));

const TEAM_PAYMENT_TYPES: string[] = [
  PaymentRecordType.DAILY_WAGE,
  PaymentRecordType.MILESTONE,
  PaymentRecordType.LUMP_SUM_INSTALLMENT,
];

/** GET /api/payments?projectId=X&teamId=Y&type=Z */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, teamId, type } = req.query;
    const filter: Record<string, unknown> = { _deleted: false };
    if (projectId) filter.projectId = projectId;
    if (teamId) filter.teamId = teamId;
    if (type) filter.type = type;

    const payments = await Payment.find(filter).sort({ date: -1, created_at: -1 }).lean();
    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('List payments error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * POST /api/payments — record a payment.
 *
 * Guards:
 * - daily_wage / milestone: one payment per (daily report, team, type) — a second
 *   attempt returns 409 so the queue can't double-pay a report entry.
 * - lump_sum_installment: must reference the team's assignment, and the running
 *   total may not exceed the agreed total for that assignment.
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      projectId,
      teamId,
      type,
      amount,
      date,
      linkedDailyReportId,
      linkedTeamSiteAssignmentId,
      notes,
    } = req.body;

    if (!projectId || !type || amount === undefined || !date) {
      res.status(400).json({
        success: false,
        error: { message: 'projectId, type, amount, date required.' },
      });
      return;
    }

    if (!Object.values(PaymentRecordType).includes(type)) {
      res.status(400).json({ success: false, error: { message: `Invalid payment type: ${type}` } });
      return;
    }

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, error: { message: 'amount must be a positive number.' } });
      return;
    }

    if (TEAM_PAYMENT_TYPES.includes(type) && !teamId) {
      res.status(400).json({ success: false, error: { message: `teamId is required for ${type} payments.` } });
      return;
    }

    // Double-payment guard for report-linked payments.
    if (
      (type === PaymentRecordType.DAILY_WAGE || type === PaymentRecordType.MILESTONE) &&
      linkedDailyReportId
    ) {
      const existing = await Payment.findOne({
        linkedDailyReportId,
        teamId,
        type,
        _deleted: false,
      });
      if (existing) {
        res.status(409).json({
          success: false,
          error: { message: 'A payment of this type already exists for this report and team.' },
        });
        return;
      }
    }

    if (type === PaymentRecordType.LUMP_SUM_INSTALLMENT) {
      if (!linkedTeamSiteAssignmentId) {
        res.status(400).json({
          success: false,
          error: { message: 'linkedTeamSiteAssignmentId is required for lump-sum installments.' },
        });
        return;
      }

      const assignment = await TeamSiteAssignment.findById(linkedTeamSiteAssignmentId).lean();
      if (!assignment || assignment._deleted) {
        res.status(404).json({ success: false, error: { message: 'Team site assignment not found.' } });
        return;
      }

      if (assignment.agreedTotal !== null) {
        const previous = await Payment.find({
          linkedTeamSiteAssignmentId,
          type: PaymentRecordType.LUMP_SUM_INSTALLMENT,
          _deleted: false,
        }).lean();
        const paidSoFar = previous.reduce((sum, p) => sum + p.amount, 0);
        if (paidSoFar + amount > assignment.agreedTotal) {
          res.status(400).json({
            success: false,
            error: {
              message: `Installment exceeds agreed total. Paid ${paidSoFar} of ${assignment.agreedTotal}; at most ${assignment.agreedTotal - paidSoFar} remaining.`,
            },
          });
          return;
        }
      }
    }

    const payment = new Payment({
      projectId,
      teamId: teamId || null,
      type,
      amount,
      date,
      paidBy: req.user!.userId,
      linkedDailyReportId: linkedDailyReportId || null,
      linkedTeamSiteAssignmentId: linkedTeamSiteAssignmentId || null,
      notes: notes || '',
    });

    await payment.save();
    res.status(201).json({ success: true, data: payment.toObject() });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
