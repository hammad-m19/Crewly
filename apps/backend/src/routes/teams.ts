import { Router, Response } from 'express';
import { Team } from '../models/Team';
import { TeamSiteAssignment } from '../models/TeamSiteAssignment';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role } from '@crewly/shared';

const router = Router();

/** GET /api/teams — list all teams */
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teams = await Team.find({ _deleted: false }).sort({ trade: 1, name: 1 }).lean();
    res.json({ success: true, data: teams });
  } catch (error) {
    console.error('List teams error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/** POST /api/teams — Owner creates a team */
router.post('/', requireRole(Role.OWNER), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, trade, defaultPaymentType, contactPhone } = req.body;
    if (!name || !trade) {
      res.status(400).json({ success: false, error: { message: 'name and trade are required.' } });
      return;
    }
    const team = new Team({ name, trade, defaultPaymentType, contactPhone });
    await team.save();
    res.status(201).json({ success: true, data: team.toObject() });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * PATCH /api/teams/:id — Owner manages team details; Accountant can also
 * update the daily rate used for wage suggestions.
 */
router.patch('/:id', requireRole(Role.OWNER, Role.ACCOUNTANT),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const team = await Team.findById(req.params.id);
      if (!team || team._deleted) {
        res.status(404).json({ success: false, error: { message: 'Team not found.' } });
        return;
      }

      const { name, trade, defaultPaymentType, contactPhone, isActive, dailyRate } = req.body;

      if (dailyRate !== undefined) {
        if (dailyRate !== null && (typeof dailyRate !== 'number' || dailyRate < 0)) {
          res.status(400).json({ success: false, error: { message: 'dailyRate must be a positive number or null.' } });
          return;
        }
        team.dailyRate = dailyRate;
      }

      // Non-financial fields are Owner-only.
      if (req.user!.role === Role.OWNER) {
        if (name !== undefined) team.name = name;
        if (trade !== undefined) team.trade = trade;
        if (defaultPaymentType !== undefined) team.defaultPaymentType = defaultPaymentType;
        if (contactPhone !== undefined) team.contactPhone = contactPhone;
        if (isActive !== undefined) team.isActive = Boolean(isActive);
      }

      await team.save();
      res.json({ success: true, data: team.toObject() });
    } catch (error) {
      console.error('Update team error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

/** GET /api/teams/assignments?projectId=X — get team assignments for a project */
router.get('/assignments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, teamId } = req.query;
    const filter: Record<string, unknown> = { _deleted: false, unassignedDate: null };
    if (projectId) filter.projectId = projectId;
    if (teamId) filter.teamId = teamId;

    const assignments = await TeamSiteAssignment.find(filter)
      .populate('teamId', 'name trade')
      .populate('projectId', 'name location')
      .lean();
    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error('List assignments error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * POST /api/teams/assign — Super Supervisor or Owner assigns a team to a site.
 * This is the "quick coordination" action that replaces phone calls.
 */
router.post('/assign',
  requireRole(Role.OWNER, Role.SUPER_SUPERVISOR),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { projectId, teamId, paymentType, agreedTotal } = req.body;

      if (!projectId || !teamId || !paymentType) {
        res.status(400).json({ success: false, error: { message: 'projectId, teamId, paymentType required.' } });
        return;
      }

      // Check if already assigned (active)
      const existing = await TeamSiteAssignment.findOne({
        projectId, teamId, unassignedDate: null, _deleted: false,
      });

      if (existing) {
        res.status(409).json({ success: false, error: { message: 'Team is already assigned to this project.' } });
        return;
      }

      const assignment = new TeamSiteAssignment({
        projectId,
        teamId,
        paymentType,
        assignedDate: new Date().toISOString().split('T')[0],
        agreedTotal: paymentType === 'lump_sum' ? agreedTotal : null,
        assignmentHistory: [{
          action: 'assigned',
          newValue: { projectId, paymentType },
          changedBy: req.user!.userId,
          changedAt: new Date().toISOString(),
        }],
      });

      await assignment.save();
      res.status(201).json({ success: true, data: assignment.toObject() });
    } catch (error) {
      console.error('Assign team error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

/** POST /api/teams/unassign — remove a team from a site */
router.post('/unassign',
  requireRole(Role.OWNER, Role.SUPER_SUPERVISOR),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { assignmentId } = req.body;
      const assignment = await TeamSiteAssignment.findById(assignmentId);

      if (!assignment || assignment._deleted) {
        res.status(404).json({ success: false, error: { message: 'Assignment not found.' } });
        return;
      }

      assignment.unassignedDate = new Date().toISOString().split('T')[0];
      assignment.assignmentHistory.push({
        action: 'unassigned',
        changedBy: req.user!.userId,
        changedAt: new Date().toISOString(),
      });
      await assignment.save();

      res.json({ success: true, data: assignment.toObject() });
    } catch (error) {
      console.error('Unassign team error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

export default router;
