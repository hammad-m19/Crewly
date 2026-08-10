import { Router, Response } from 'express';
import { DailyReport } from '../models/DailyReport';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role, AttendanceStatus, NotificationType } from '@crewly/shared';

const router = Router();

/**
 * POST /api/daily-reports
 * Site Supervisor creates or updates today's daily report.
 */
router.post('/', requireRole(Role.SITE_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, date, teamEntries } = req.body;

    if (!projectId || !date || !teamEntries) {
      res.status(400).json({ success: false, error: { message: 'projectId, date, and teamEntries are required.' } });
      return;
    }

    // Check if report already exists for this project+date
    let report = await DailyReport.findOne({ projectId, date, _deleted: false });

    if (report) {
      // Update existing report
      report.teamEntries = teamEntries;
      report.updated_at = Date.now();
      await report.save();
    } else {
      // Create new report
      report = new DailyReport({
        projectId,
        date,
        submittedBy: req.user!.userId,
        teamEntries,
      });
      await report.save();
    }

    // Detect no-shows and idle teams → create notifications
    await processAlerts(teamEntries, projectId, date, req.user!.userId);

    res.status(report.isNew ? 201 : 200).json({
      success: true,
      data: report.toObject(),
    });
  } catch (error) {
    console.error('Create daily report error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/daily-reports
 * List reports — filtered by role permissions.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, date, startDate, endDate, page = '1', limit = '20' } = req.query;

    const filter: Record<string, unknown> = { _deleted: false };

    if (projectId) filter.projectId = projectId;
    if (date) filter.date = date;
    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    }

    // Site Supervisor can only see their own reports
    if (req.user!.role === Role.SITE_SUPERVISOR) {
      filter.submittedBy = req.user!.userId;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const [reports, total] = await Promise.all([
      DailyReport.find(filter)
        .sort({ date: -1, created_at: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      DailyReport.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: reports,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('List daily reports error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/daily-reports/:id
 * Get a single report by ID.
 */
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await DailyReport.findById(req.params.id).lean();

    if (!report || report._deleted) {
      res.status(404).json({ success: false, error: { message: 'Report not found.' } });
      return;
    }

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Get daily report error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * PATCH /api/daily-reports/:id
 * Update an existing report (e.g. adding late entries, photos).
 */
router.patch('/:id', requireRole(Role.SITE_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await DailyReport.findById(req.params.id);

    if (!report || report._deleted) {
      res.status(404).json({ success: false, error: { message: 'Report not found.' } });
      return;
    }

    // Only the submitter can update their own report
    if (report.submittedBy.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, error: { message: 'You can only update your own reports.' } });
      return;
    }

    const { teamEntries } = req.body;
    if (teamEntries) {
      report.teamEntries = teamEntries;
    }

    report.updated_at = Date.now();
    await report.save();

    // Re-check alerts on update
    if (teamEntries) {
      await processAlerts(teamEntries, report.projectId.toString(), report.date, req.user!.userId);
    }

    res.json({ success: true, data: report.toObject() });
  } catch (error) {
    console.error('Update daily report error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * Process no-shows and idle teams from team entries.
 * Creates notifications for Super Supervisors same-day.
 */
async function processAlerts(
  teamEntries: Array<{ attendanceStatus: string; idleReason?: string; teamId?: string }>,
  projectId: string,
  date: string,
  submittedBy: string
): Promise<void> {
  try {
    // Find all Super Supervisors to notify
    const superSupervisors = await User.find({
      role: Role.SUPER_SUPERVISOR,
      isActive: true,
      _deleted: false,
    });

    for (const entry of teamEntries) {
      // No-show detection — notify immediately
      if (entry.attendanceStatus === AttendanceStatus.NO_SHOW) {
        for (const sup of superSupervisors) {
          const existing = await Notification.findOne({
            recipientUserId: sup._id,
            type: NotificationType.NO_SHOW,
            projectId,
            'metadata': { $regex: entry.teamId || 'local_labor' },
            created_at: { $gte: Date.now() - 24 * 60 * 60 * 1000 },
          });

          if (!existing) {
            await new Notification({
              recipientUserId: sup._id,
              type: NotificationType.NO_SHOW,
              projectId,
              title: '🚫 No-Show Reported',
              message: `A team was marked as no-show on ${date}. This may block dependent trades.`,
              metadata: JSON.stringify({ teamId: entry.teamId, date, reportedBy: submittedBy }),
            }).save();
          }
        }
      }

      // Idle team detection
      if (entry.idleReason && entry.idleReason !== 'no_show') {
        for (const sup of superSupervisors) {
          const existing = await Notification.findOne({
            recipientUserId: sup._id,
            type: NotificationType.IDLE_TEAM,
            projectId,
            created_at: { $gte: Date.now() - 24 * 60 * 60 * 1000 },
          });

          if (!existing) {
            await new Notification({
              recipientUserId: sup._id,
              type: NotificationType.IDLE_TEAM,
              projectId,
              title: '⚠️ Team Idle',
              message: `A team is idle: ${entry.idleReason?.replace(/_/g, ' ')}. Date: ${date}`,
              metadata: JSON.stringify({ teamId: entry.teamId, idleReason: entry.idleReason, date }),
            }).save();
          }
        }
      }
    }
  } catch (error) {
    // Don't fail the main request if notification creation fails
    console.error('Alert processing error:', error);
  }
}

export default router;
