import { Router, Response } from 'express';
import { DailyReport } from '../models/DailyReport';
import { Notification } from '../models/Notification';
import { Team } from '../models/Team';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import {
  Role,
  AttendanceStatus,
  MorningPresence,
  NotificationType,
} from '@crewly/shared';
import { notifyRole } from '../services/notify';

const router = Router();

/**
 * POST /api/daily-reports/morning-checkin
 * Site Supervisor morning roll-call: mark each assigned team on-site or not.
 * Upserts today's daily report and notifies Owner + Super for absences.
 */
router.post(
  '/morning-checkin',
  requireRole(Role.SITE_SUPERVISOR),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { projectId, date, entries } = req.body as {
        projectId?: string;
        date?: string;
        entries?: Array<{
          teamId: string;
          morningPresence: MorningPresence;
          morningHeadcount?: number;
          morningNotes?: string;
        }>;
      };

      if (!projectId || !date || !Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({
          success: false,
          error: { message: 'projectId, date, and entries are required.' },
        });
        return;
      }

      for (const entry of entries) {
        if (!entry.teamId || !Object.values(MorningPresence).includes(entry.morningPresence)) {
          res.status(400).json({
            success: false,
            error: {
              message: 'Each entry needs teamId and morningPresence (on_site | not_on_site).',
            },
          });
          return;
        }
      }

      const checkedAt = new Date().toISOString();
      let report = await DailyReport.findOne({ projectId, date, _deleted: false });

      if (!report) {
        report = new DailyReport({
          projectId,
          date,
          submittedBy: req.user!.userId,
          teamEntries: [],
        });
      }

      const byTeamId = new Map(
        report.teamEntries
          .filter((e) => e.teamId)
          .map((e) => [e.teamId!.toString(), e])
      );

      for (const incoming of entries) {
        const existing = byTeamId.get(incoming.teamId);
        const headcount =
          incoming.morningPresence === MorningPresence.ON_SITE
            ? Math.max(0, incoming.morningHeadcount ?? existing?.morningHeadcount ?? 0)
            : 0;

        if (existing) {
          existing.morningPresence = incoming.morningPresence;
          existing.morningHeadcount = headcount;
          existing.morningNotes =
            incoming.morningPresence === MorningPresence.NOT_ON_SITE
              ? (incoming.morningNotes || '').trim()
              : '';
          existing.morningCheckedAt = checkedAt;
          if (
            incoming.morningPresence === MorningPresence.ON_SITE &&
            existing.headcountPresent === 0 &&
            headcount > 0
          ) {
            existing.headcountPresent = headcount;
          }
        } else {
          report.teamEntries.push({
            teamId: incoming.teamId as any,
            isLocalLabor: false,
            headcountPresent: headcount,
            attendanceStatus: AttendanceStatus.ON_TIME,
            idleReason: null,
            idleReasonNotes: '',
            linkedMaterialOrderId: null,
            taskWorkedOn: '',
            taskCompleted: false,
            remainingWorkNotes: '',
            photos: [],
            morningPresence: incoming.morningPresence,
            morningHeadcount: headcount,
            morningNotes:
              incoming.morningPresence === MorningPresence.NOT_ON_SITE
                ? (incoming.morningNotes || '').trim()
                : '',
            morningCheckedAt: checkedAt,
          });
        }
      }

      report.updated_at = Date.now();
      await report.save();

      await processMorningAlerts(entries, projectId, date, req.user!.userId);

      res.json({ success: true, data: report.toObject() });
    } catch (error) {
      console.error('Morning check-in error:', error);
      res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
    }
  }
);

/**
 * POST /api/daily-reports
 * Site Supervisor creates or updates today's daily report.
 */
router.post('/', requireRole(Role.SITE_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, date, teamEntries } = req.body;

    if (!projectId || !date || !teamEntries) {
      res.status(400).json({
        success: false,
        error: { message: 'projectId, date, and teamEntries are required.' },
      });
      return;
    }

    let report = await DailyReport.findOne({ projectId, date, _deleted: false });

    if (report) {
      const morningByTeam = new Map(
        report.teamEntries
          .filter((e) => e.teamId && e.morningPresence)
          .map((e) => [
            e.teamId!.toString(),
            {
              morningPresence: e.morningPresence,
              morningHeadcount: e.morningHeadcount,
              morningNotes: e.morningNotes,
              morningCheckedAt: e.morningCheckedAt,
            },
          ])
      );

      report.teamEntries = teamEntries.map((entry: any) => {
        const tid = entry.teamId?.toString?.() || entry.teamId;
        const morning = tid ? morningByTeam.get(tid) : undefined;
        return {
          ...entry,
          morningPresence: entry.morningPresence ?? morning?.morningPresence ?? null,
          morningHeadcount: entry.morningHeadcount ?? morning?.morningHeadcount ?? 0,
          morningNotes: entry.morningNotes ?? morning?.morningNotes ?? '',
          morningCheckedAt: entry.morningCheckedAt ?? morning?.morningCheckedAt ?? null,
        };
      });
      report.updated_at = Date.now();
      await report.save();
    } else {
      report = new DailyReport({
        projectId,
        date,
        submittedBy: req.user!.userId,
        teamEntries,
      });
      await report.save();
    }

    await processAlerts(teamEntries, projectId, date, req.user!.userId);

    res.status(200).json({
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
 */
router.patch('/:id', requireRole(Role.SITE_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await DailyReport.findById(req.params.id);

    if (!report || report._deleted) {
      res.status(404).json({ success: false, error: { message: 'Report not found.' } });
      return;
    }

    if (report.submittedBy.toString() !== req.user!.userId) {
      res.status(403).json({
        success: false,
        error: { message: 'You can only update your own reports.' },
      });
      return;
    }

    const { teamEntries } = req.body;
    if (teamEntries) {
      const morningByTeam = new Map(
        report.teamEntries
          .filter((e) => e.teamId && e.morningPresence)
          .map((e) => [
            e.teamId!.toString(),
            {
              morningPresence: e.morningPresence,
              morningHeadcount: e.morningHeadcount,
              morningNotes: e.morningNotes,
              morningCheckedAt: e.morningCheckedAt,
            },
          ])
      );

      report.teamEntries = teamEntries.map((entry: any) => {
        const tid = entry.teamId?.toString?.() || entry.teamId;
        const morning = tid ? morningByTeam.get(tid) : undefined;
        return {
          ...entry,
          morningPresence: entry.morningPresence ?? morning?.morningPresence ?? null,
          morningHeadcount: entry.morningHeadcount ?? morning?.morningHeadcount ?? 0,
          morningNotes: entry.morningNotes ?? morning?.morningNotes ?? '',
          morningCheckedAt: entry.morningCheckedAt ?? morning?.morningCheckedAt ?? null,
        };
      });
    }

    report.updated_at = Date.now();
    await report.save();

    if (teamEntries) {
      await processAlerts(teamEntries, report.projectId.toString(), report.date, req.user!.userId);
    }

    res.json({ success: true, data: report.toObject() });
  } catch (error) {
    console.error('Update daily report error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

async function processMorningAlerts(
  entries: Array<{
    teamId: string;
    morningPresence: MorningPresence;
    morningNotes?: string;
  }>,
  projectId: string,
  date: string,
  submittedBy: string
): Promise<void> {
  try {
    const absent = entries.filter((e) => e.morningPresence === MorningPresence.NOT_ON_SITE);
    if (absent.length === 0) return;

    const teamIds = absent.map((e) => e.teamId);
    const teams = await Team.find({ _id: { $in: teamIds }, _deleted: false })
      .select('name trade contactPhone')
      .lean();
    const teamMap = new Map(teams.map((t: any) => [t._id.toString(), t]));

    const since = Date.now() - 12 * 60 * 60 * 1000;

    for (const entry of absent) {
      const team = teamMap.get(entry.teamId);
      const teamName = team?.name || 'A team';
      const phone = team?.contactPhone ? ` Call: ${team.contactPhone}.` : '';
      const notes = entry.morningNotes?.trim() ? ` Note: ${entry.morningNotes.trim()}` : '';

      const existing = await Notification.findOne({
        type: NotificationType.MORNING_ABSENCE,
        projectId,
        _deleted: false,
        metadata: { $regex: entry.teamId },
        created_at: { $gte: since },
      }).lean();

      if (existing) continue;

      const payload = {
        type: NotificationType.MORNING_ABSENCE,
        projectId,
        title: '🌅 Team not on site',
        message: `${teamName} is not on site this morning (${date}).${phone}${notes} Assign a replacement if needed.`,
        metadata: {
          teamId: entry.teamId,
          date,
          reportedBy: submittedBy,
          morningNotes: entry.morningNotes || '',
          contactPhone: team?.contactPhone || '',
        },
      };

      await notifyRole(Role.OWNER, payload);
      await notifyRole(Role.SUPER_SUPERVISOR, payload);
    }
  } catch (error) {
    console.error('Morning alert processing error:', error);
  }
}

async function processAlerts(
  teamEntries: Array<{ attendanceStatus: string; idleReason?: string; teamId?: string | null }>,
  projectId: string,
  date: string,
  submittedBy: string
): Promise<void> {
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;

    for (const entry of teamEntries) {
      const teamId = entry.teamId || 'local_labor';

      if (entry.attendanceStatus === AttendanceStatus.NO_SHOW) {
        const existing = await Notification.findOne({
          type: NotificationType.NO_SHOW,
          projectId,
          _deleted: false,
          metadata: { $regex: teamId },
          created_at: { $gte: since },
        }).lean();

        if (!existing) {
          await notifyRole(Role.SUPER_SUPERVISOR, {
            type: NotificationType.NO_SHOW,
            projectId,
            title: '🚫 No-Show Reported',
            message: `A team was marked as no-show on ${date}. This may block dependent trades.`,
            metadata: { teamId: entry.teamId, date, reportedBy: submittedBy },
          });
        }
      }

      if (entry.idleReason && entry.idleReason !== 'no_show') {
        const existing = await Notification.findOne({
          type: NotificationType.IDLE_TEAM,
          projectId,
          _deleted: false,
          metadata: { $regex: teamId },
          created_at: { $gte: since },
        }).lean();

        if (!existing) {
          await notifyRole(Role.SUPER_SUPERVISOR, {
            type: NotificationType.IDLE_TEAM,
            projectId,
            title: '⚠️ Team Idle',
            message: `A team is idle: ${entry.idleReason.replace(/_/g, ' ')}. Date: ${date}`,
            metadata: { teamId: entry.teamId, idleReason: entry.idleReason, date },
          });
        }
      }
    }
  } catch (error) {
    console.error('Alert processing error:', error);
  }
}

export default router;
