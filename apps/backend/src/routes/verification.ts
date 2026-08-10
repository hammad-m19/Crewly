import { Router, Response } from 'express';
import { TaskVerification } from '../models/TaskVerification';
import { DailyReport } from '../models/DailyReport';
import { Team } from '../models/Team';
import { Project } from '../models/Project';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role } from '@crewly/shared';

const router = Router();

/**
 * GET /api/verifications/pending
 * Lists tasks marked as completed in daily reports that have no TaskVerification record yet.
 * Super Supervisor only.
 */
router.get('/pending', requireRole(Role.SUPER_SUPERVISOR), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Find all daily reports with at least one completed task
    const reports = await DailyReport.find({
      _deleted: false,
      'teamEntries.taskCompleted': true,
    })
      .sort({ date: -1 })
      .lean();

    // Get all existing verifications to filter out already-verified entries
    const existingVerifications = await TaskVerification.find({ _deleted: false }).lean();
    const verifiedSet = new Set(
      existingVerifications.map((v: any) => `${v.dailyReportId.toString()}_${v.teamEntryIndex}`)
    );

    // Build pending list
    const pending: any[] = [];

    for (const report of reports) {
      for (let i = 0; i < report.teamEntries.length; i++) {
        const entry = report.teamEntries[i];
        if (!entry.taskCompleted) continue;

        const key = `${report._id.toString()}_${i}`;
        if (verifiedSet.has(key)) continue;

        pending.push({
          dailyReportId: report._id.toString(),
          teamEntryIndex: i,
          projectId: report.projectId.toString(),
          date: report.date,
          submittedBy: report.submittedBy.toString(),
          teamId: entry.teamId?.toString() || null,
          isLocalLabor: entry.isLocalLabor,
          taskWorkedOn: entry.taskWorkedOn,
          headcountPresent: entry.headcountPresent,
        });
      }
    }

    // Enrich with team and project names
    const teamIds = [...new Set(pending.map(p => p.teamId).filter(Boolean))];
    const projectIds = [...new Set(pending.map(p => p.projectId))];

    const [teams, projects] = await Promise.all([
      Team.find({ _id: { $in: teamIds } }).select('name trade').lean(),
      Project.find({ _id: { $in: projectIds } }).select('name location').lean(),
    ]);

    const teamMap = new Map(teams.map((t: any) => [t._id.toString(), t]));
    const projectMap = new Map(projects.map((p: any) => [p._id.toString(), p]));

    const enriched = pending.map(p => ({
      ...p,
      teamName: p.teamId ? teamMap.get(p.teamId)?.name || 'Unknown Team' : 'Local Labor',
      teamTrade: p.teamId ? teamMap.get(p.teamId)?.trade || '' : '',
      projectName: projectMap.get(p.projectId)?.name || 'Unknown Project',
      projectLocation: projectMap.get(p.projectId)?.location || '',
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('List pending verifications error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/verifications
 * Lists completed verifications with enriched data.
 * Super Supervisor only.
 */
router.get('/', requireRole(Role.SUPER_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const [verifications, total] = await Promise.all([
      TaskVerification.find({ _deleted: false })
        .sort({ verifiedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      TaskVerification.countDocuments({ _deleted: false }),
    ]);

    res.json({
      success: true,
      data: verifications,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('List verifications error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * POST /api/verifications
 * Create a task verification record.
 * Super Supervisor only.
 */
router.post('/', requireRole(Role.SUPER_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { dailyReportId, teamEntryIndex, notes } = req.body;

    if (!dailyReportId || teamEntryIndex === undefined || teamEntryIndex === null) {
      res.status(400).json({ success: false, error: { message: 'dailyReportId and teamEntryIndex are required.' } });
      return;
    }

    // Validate the daily report exists and entry index is valid
    const report = await DailyReport.findById(dailyReportId);
    if (!report || report._deleted) {
      res.status(404).json({ success: false, error: { message: 'Daily report not found.' } });
      return;
    }

    if (teamEntryIndex < 0 || teamEntryIndex >= report.teamEntries.length) {
      res.status(400).json({ success: false, error: { message: 'Invalid teamEntryIndex.' } });
      return;
    }

    if (!report.teamEntries[teamEntryIndex].taskCompleted) {
      res.status(400).json({ success: false, error: { message: 'Task is not marked as completed.' } });
      return;
    }

    // Check if already verified
    const existing = await TaskVerification.findOne({
      dailyReportId,
      teamEntryIndex,
      _deleted: false,
    });

    if (existing) {
      res.status(409).json({ success: false, error: { message: 'This task is already verified.' } });
      return;
    }

    const verification = new TaskVerification({
      dailyReportId,
      teamEntryIndex,
      verifiedBy: req.user!.userId,
      verifiedAt: new Date().toISOString(),
      notes: notes || '',
    });

    await verification.save();

    res.status(201).json({ success: true, data: verification.toObject() });
  } catch (error) {
    console.error('Create verification error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
