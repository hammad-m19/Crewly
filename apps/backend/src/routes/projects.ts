import { Router, Response } from 'express';
import { Project } from '../models/Project';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role } from '@crewly/shared';

const router = Router();

/**
 * POST /api/projects
 * Owner-only: create a new project.
 */
router.post('/', requireRole(Role.OWNER), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, location, startDate, expectedEndDate, budget, siteSupervisorId } = req.body;

    if (!name || !location || !startDate || !expectedEndDate) {
      res.status(400).json({ success: false, error: { message: 'name, location, startDate, expectedEndDate are required.' } });
      return;
    }

    const project = new Project({
      name,
      location,
      startDate,
      expectedEndDate,
      budget: budget || {},
      siteSupervisorId: siteSupervisorId || null,
    });

    await project.save();
    res.status(201).json({ success: true, data: project.toObject() });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/projects
 * List projects — all users can see project metadata, but budget fields
 * are stripped by moneyFilter middleware for non-Owner/non-Accountant.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = { _deleted: false };
    const { status } = req.query;
    if (status) filter.status = status;

    // Site Supervisor sees only their assigned site(s)
    if (req.user!.role === Role.SITE_SUPERVISOR) {
      const user = await (await import('../models/User')).User.findById(req.user!.userId);
      if (user?.assignedSites?.length) {
        filter._id = { $in: user.assignedSites };
      }
    }

    const projects = await Project.find(filter).sort({ created_at: -1 }).lean();
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/projects/:id
 */
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id).lean();
    if (!project || project._deleted) {
      res.status(404).json({ success: false, error: { message: 'Project not found.' } });
      return;
    }
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * PATCH /api/projects/:id
 * Owner-only: update project. Budget changes go to budgetHistory.
 */
router.patch('/:id', requireRole(Role.OWNER), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project._deleted) {
      res.status(404).json({ success: false, error: { message: 'Project not found.' } });
      return;
    }

    const { name, location, startDate, expectedEndDate, status, budget, siteSupervisorId, reason } = req.body;

    // Track budget changes in history
    if (budget && JSON.stringify(budget) !== JSON.stringify(project.budget)) {
      project.budgetHistory.push({
        previousValue: project.budget,
        newValue: budget,
        changedBy: req.user!.userId,
        changedAt: new Date().toISOString(),
        reason: reason || 'Budget updated',
      });
      project.budget = budget;
    }

    if (name) project.name = name;
    if (location) project.location = location;
    if (startDate) project.startDate = startDate;
    if (expectedEndDate) project.expectedEndDate = expectedEndDate;
    if (status) project.status = status;
    if (siteSupervisorId !== undefined) project.siteSupervisorId = siteSupervisorId;

    await project.save();
    res.json({ success: true, data: project.toObject() });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
