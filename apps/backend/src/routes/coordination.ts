import { Router, Response } from 'express';
import { TeamSiteAssignment } from '../models/TeamSiteAssignment';
import { Team } from '../models/Team';
import { Project } from '../models/Project';
import { DailyReport } from '../models/DailyReport';
import { TaskVerification } from '../models/TaskVerification';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role, NotificationType } from '@crewly/shared';

const router = Router();

/**
 * GET /api/coordination/overview
 * Aggregated cross-site view: all active projects with assigned teams,
 * team statuses from latest daily reports, and flag counts.
 * Super Supervisor only.
 */
router.get('/overview', requireRole(Role.SUPER_SUPERVISOR), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get all active projects
    const projects = await Project.find({ status: 'active', _deleted: false })
      .select('name location status budget siteSupervisorId')
      .lean();

    // Get all active team assignments
    const assignments = await TeamSiteAssignment.find({ unassignedDate: null, _deleted: false })
      .lean();

    // Get all teams for enrichment
    const teams = await Team.find({ _deleted: false }).lean();
    const teamMap = new Map(teams.map((t: any) => [t._id.toString(), t]));

    // Get the latest daily reports (last 7 days) for status flags
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentDateStr = sevenDaysAgo.toISOString().split('T')[0];

    const recentReports = await DailyReport.find({
      _deleted: false,
      date: { $gte: recentDateStr },
    }).lean();

    // Group reports by project
    const reportsByProject = new Map<string, any[]>();
    for (const report of recentReports) {
      const pid = report.projectId.toString();
      if (!reportsByProject.has(pid)) reportsByProject.set(pid, []);
      reportsByProject.get(pid)!.push(report);
    }

    // Get unverified completed task count per project
    const existingVerifications = await TaskVerification.find({ _deleted: false }).lean();
    const verifiedSet = new Set(
      existingVerifications.map((v: any) => `${v.dailyReportId.toString()}_${v.teamEntryIndex}`)
    );

    // Build overview per project
    const overview = projects.map(project => {
      const pid = project._id.toString();
      const projectAssignments = assignments.filter(a => a.projectId.toString() === pid);
      const projectReports = reportsByProject.get(pid) || [];

      // Get latest report for this project
      const latestReport = projectReports.sort((a, b) =>
        b.date.localeCompare(a.date)
      )[0];

      // Count flags from latest daily report
      let idleCount = 0;
      let noShowCount = 0;
      let blockedCount = 0;
      let activeCount = 0;
      let unverifiedCount = 0;

      if (latestReport) {
        for (let i = 0; i < latestReport.teamEntries.length; i++) {
          const entry = latestReport.teamEntries[i];
          if (entry.attendanceStatus === 'no_show') noShowCount++;
          else if (entry.idleReason && entry.idleReason !== 'no_show') {
            idleCount++;
            if (entry.idleReason === 'material_not_there') blockedCount++;
          } else {
            activeCount++;
          }

          // Check for unverified completed tasks
          if (entry.taskCompleted) {
            const key = `${latestReport._id.toString()}_${i}`;
            if (!verifiedSet.has(key)) unverifiedCount++;
          }
        }
      }

      // Build team details
      const teamDetails = projectAssignments.map(a => {
        const team = teamMap.get(a.teamId.toString());
        // Find this team's latest status from daily reports
        let latestStatus: any = null;
        if (latestReport) {
          const teamEntry = latestReport.teamEntries.find(
            (e: any) => e.teamId?.toString() === a.teamId.toString()
          );
          if (teamEntry) {
            latestStatus = {
              attendanceStatus: teamEntry.attendanceStatus,
              headcountPresent: teamEntry.headcountPresent,
              idleReason: teamEntry.idleReason,
              taskCompleted: teamEntry.taskCompleted,
              taskWorkedOn: teamEntry.taskWorkedOn,
            };
          }
        }

        return {
          assignmentId: a._id.toString(),
          teamId: a.teamId.toString(),
          teamName: team?.name || 'Unknown Team',
          trade: team?.trade || '',
          paymentType: a.paymentType,
          assignedDate: a.assignedDate,
          latestStatus,
        };
      });

      return {
        projectId: pid,
        projectName: project.name,
        projectLocation: project.location,
        siteSupervisorId: (project as any).siteSupervisorId?.toString() || null,
        teams: teamDetails,
        flags: {
          active: activeCount,
          idle: idleCount,
          noShow: noShowCount,
          blocked: blockedCount,
          unverified: unverifiedCount,
        },
        latestReportDate: latestReport?.date || null,
        totalAssignedTeams: projectAssignments.length,
      };
    });

    // Global summary counts
    const summary = {
      totalProjects: projects.length,
      totalActiveTeams: overview.reduce((sum, p) => sum + p.flags.active, 0),
      totalIdle: overview.reduce((sum, p) => sum + p.flags.idle, 0),
      totalNoShow: overview.reduce((sum, p) => sum + p.flags.noShow, 0),
      totalBlocked: overview.reduce((sum, p) => sum + p.flags.blocked, 0),
    };

    res.json({ success: true, data: { projects: overview, summary } });
  } catch (error) {
    console.error('Coordination overview error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * POST /api/coordination/assign
 * Assign a team to a project. Creates TeamSiteAssignment + notifies Site Supervisor.
 * Super Supervisor only.
 */
router.post('/assign', requireRole(Role.SUPER_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Notify the Site Supervisor of this project
    const project = await Project.findById(projectId);
    if (project && (project as any).siteSupervisorId) {
      const team = await Team.findById(teamId);
      await new Notification({
        recipientUserId: (project as any).siteSupervisorId,
        type: NotificationType.TEAM_ASSIGNED,
        projectId,
        title: '👷 New Team Assigned',
        message: `${team?.name || 'A team'} has been assigned to ${project.name}.`,
        metadata: JSON.stringify({
          teamId: teamId,
          assignmentId: assignment._id.toString(),
        }),
      }).save();
    }

    res.status(201).json({ success: true, data: assignment.toObject() });
  } catch (error) {
    console.error('Coordination assign error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/coordination/unassign-check/:assignmentId
 * Pre-check before unassigning: returns warnings if the team has open issues.
 */
router.get('/unassign-check/:assignmentId', requireRole(Role.SUPER_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assignment = await TeamSiteAssignment.findById(req.params.assignmentId);
    if (!assignment || assignment._deleted) {
      res.status(404).json({ success: false, error: { message: 'Assignment not found.' } });
      return;
    }

    const warnings: string[] = [];

    // Check for open idle reasons in recent reports
    const recentReports = await DailyReport.find({
      projectId: assignment.projectId,
      _deleted: false,
    }).sort({ date: -1 }).limit(5).lean();

    for (const report of recentReports) {
      for (const entry of report.teamEntries) {
        if (
          entry.teamId?.toString() === assignment.teamId.toString() &&
          entry.idleReason
        ) {
          warnings.push(`Team has an open idle reason (${entry.idleReason.replace(/_/g, ' ')}) from ${report.date}.`);
          break; // One warning per category is enough
        }
      }
      if (warnings.length > 0) break;
    }

    // Check for unverified completed tasks
    const existingVerifications = await TaskVerification.find({ _deleted: false }).lean();
    const verifiedSet = new Set(
      existingVerifications.map((v: any) => `${v.dailyReportId.toString()}_${v.teamEntryIndex}`)
    );

    for (const report of recentReports) {
      for (let i = 0; i < report.teamEntries.length; i++) {
        const entry = report.teamEntries[i];
        if (
          entry.teamId?.toString() === assignment.teamId.toString() &&
          entry.taskCompleted
        ) {
          const key = `${report._id.toString()}_${i}`;
          if (!verifiedSet.has(key)) {
            warnings.push(`Team has an unverified completed task ("${entry.taskWorkedOn}") from ${report.date}.`);
            break;
          }
        }
      }
      if (warnings.length >= 2) break;
    }

    res.json({ success: true, data: { warnings, hasWarnings: warnings.length > 0 } });
  } catch (error) {
    console.error('Unassign check error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * POST /api/coordination/unassign
 * Unassign a team from a project.
 * Super Supervisor only.
 */
router.post('/unassign', requireRole(Role.SUPER_SUPERVISOR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.body;
    const assignment = await TeamSiteAssignment.findById(assignmentId);

    if (!assignment || assignment._deleted) {
      res.status(404).json({ success: false, error: { message: 'Assignment not found.' } });
      return;
    }

    if (assignment.unassignedDate) {
      res.status(400).json({ success: false, error: { message: 'Team is already unassigned.' } });
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
    console.error('Coordination unassign error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/coordination/available-teams
 * Lists all teams with their current assignment status.
 */
router.get('/available-teams', requireRole(Role.SUPER_SUPERVISOR), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teams = await Team.find({ _deleted: false }).lean();
    const activeAssignments = await TeamSiteAssignment.find({
      unassignedDate: null,
      _deleted: false,
    })
      .populate('projectId', 'name location')
      .lean();

    const assignmentsByTeam = new Map<string, any[]>();
    for (const a of activeAssignments) {
      const tid = a.teamId.toString();
      if (!assignmentsByTeam.has(tid)) assignmentsByTeam.set(tid, []);
      assignmentsByTeam.get(tid)!.push({
        assignmentId: a._id.toString(),
        projectId: a.projectId?._id?.toString() || a.projectId?.toString(),
        projectName: (a.projectId as any)?.name || 'Unknown',
        projectLocation: (a.projectId as any)?.location || '',
        paymentType: a.paymentType,
        assignedDate: a.assignedDate,
      });
    }

    const result = teams.map(t => ({
      teamId: (t as any)._id.toString(),
      name: t.name,
      trade: t.trade,
      currentAssignments: assignmentsByTeam.get((t as any)._id.toString()) || [],
      isAvailable: !assignmentsByTeam.has((t as any)._id.toString()),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Available teams error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
