import { Router, Response } from 'express';
import { Project } from '../models/Project';
import { Team } from '../models/Team';
import { TeamSiteAssignment } from '../models/TeamSiteAssignment';
import { DailyReport } from '../models/DailyReport';
import { TaskVerification } from '../models/TaskVerification';
import { MaterialOrder } from '../models/MaterialOrder';
import { MaterialPurchase } from '../models/MaterialPurchase';
import { PettyCash } from '../models/PettyCash';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { Role, BudgetCategory, MaterialOrderStatus, ProjectStatus } from '@crewly/shared';
import {
  BUDGET_CATEGORIES,
  LABOR_PAYMENT_TYPES,
  buildSpendMaps,
  sumBudget,
  toId,
} from '../lib/costs';

const router = Router();

/** Every route here is Owner-only. */
router.use(requireRole(Role.OWNER));

const RECEIVED_STATUSES: string[] = [
  MaterialOrderStatus.RECEIVED_FULL,
  MaterialOrderStatus.RECEIVED_PARTIAL,
];

/**
 * GET /api/owner/dashboard
 *
 * Company-wide snapshot: headline counts, pending actions that need the Owner's
 * attention, and per-project budget vs. actual spend.
 */
router.get('/dashboard', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [projects, assignments, payments, purchases, pettyCash, materialOrders] =
      await Promise.all([
        Project.find({ _deleted: false }).sort({ created_at: -1 }).lean(),
        TeamSiteAssignment.find({ unassignedDate: null, _deleted: false }).lean(),
        Payment.find({ _deleted: false }).lean(),
        MaterialPurchase.find({ _deleted: false }).lean(),
        PettyCash.find({ _deleted: false }).lean(),
        MaterialOrder.find({ _deleted: false }).lean(),
      ]);

    // Latest daily report per project drives the "working vs idle" counts.
    const reports = await DailyReport.find({ _deleted: false })
      .sort({ date: -1 })
      .limit(200)
      .lean();

    const latestReportByProject = new Map<string, any>();
    for (const report of reports) {
      const pid = toId(report.projectId);
      if (!latestReportByProject.has(pid)) latestReportByProject.set(pid, report);
    }

    const verifications = await TaskVerification.find({ _deleted: false }).lean();
    const verifiedKeys = new Set(
      verifications.map((v: any) => `${toId(v.dailyReportId)}_${v.teamEntryIndex}`)
    );

    const { laborByProject, materialsByProject, pettyCashByProject } = buildSpendMaps(
      payments,
      purchases,
      pettyCash
    );

    const teamCountByProject = new Map<string, number>();
    for (const assignment of assignments) {
      const pid = toId(assignment.projectId);
      teamCountByProject.set(pid, (teamCountByProject.get(pid) || 0) + 1);
    }

    let teamsWorking = 0;
    let idleTeams = 0;
    let noShowTeams = 0;
    let unverifiedTasks = 0;

    const projectSummaries = projects.map((project: any) => {
      const pid = toId(project._id);
      const latestReport = latestReportByProject.get(pid);

      let projectWorking = 0;
      let projectIdle = 0;
      let projectNoShow = 0;
      let projectUnverified = 0;

      if (latestReport) {
        const entries = latestReport.teamEntries || [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          if (entry.attendanceStatus === 'no_show') projectNoShow++;
          else if (entry.idleReason) projectIdle++;
          else projectWorking++;

          if (entry.taskCompleted && !verifiedKeys.has(`${toId(latestReport._id)}_${i}`)) {
            projectUnverified++;
          }
        }
      }

      // Only count live sites toward the company-wide activity numbers.
      if (project.status === ProjectStatus.ACTIVE) {
        teamsWorking += projectWorking;
        idleTeams += projectIdle;
        noShowTeams += projectNoShow;
      }
      unverifiedTasks += projectUnverified;

      const labor = laborByProject.get(pid) || 0;
      const materials = materialsByProject.get(pid) || 0;
      const pettyCashSpent = pettyCashByProject.get(pid) || 0;
      const spent = labor + materials + pettyCashSpent;
      const budgetTotal = sumBudget(project.budget);

      return {
        projectId: pid,
        name: project.name,
        location: project.location,
        status: project.status,
        startDate: project.startDate,
        expectedEndDate: project.expectedEndDate,
        siteSupervisorId: project.siteSupervisorId ? toId(project.siteSupervisorId) : null,
        teamCount: teamCountByProject.get(pid) || 0,
        latestReportDate: latestReport?.date || null,
        budgetTotal,
        spent: { labor, materials, pettyCash: pettyCashSpent, total: spent },
        remaining: budgetTotal - spent,
        percentUsed: budgetTotal > 0 ? Math.round((spent / budgetTotal) * 100) : null,
        overBudget: budgetTotal > 0 && spent > budgetTotal,
        flags: {
          working: projectWorking,
          idle: projectIdle,
          noShow: projectNoShow,
          unverified: projectUnverified,
        },
      };
    });

    const overdueOrders = materialOrders.filter(
      (order: any) =>
        !RECEIVED_STATUSES.includes(order.status) &&
        order.expectedDeliveryDate &&
        order.expectedDeliveryDate < today
    ).length;

    const missingReceipts = purchases.filter((p: any) => !p.receiptPhotoUrl).length;
    const unreconciledFloats = pettyCash.filter(
      (record: any) => !record.reconciled && record.currentBalance > 0
    ).length;

    const activeProjects = projectSummaries.filter(
      (p) => p.status === ProjectStatus.ACTIVE
    );

    const totalBudget = projectSummaries.reduce((sum, p) => sum + p.budgetTotal, 0);
    const totalSpent = projectSummaries.reduce((sum, p) => sum + p.spent.total, 0);

    res.json({
      success: true,
      data: {
        summary: {
          activeProjects: activeProjects.length,
          totalProjects: projectSummaries.length,
          teamsWorking,
          idleTeams,
          noShowTeams,
          pendingActions: unverifiedTasks + overdueOrders + missingReceipts + unreconciledFloats,
        },
        pendingActions: {
          unverifiedTasks,
          overdueOrders,
          missingReceipts,
          unreconciledFloats,
        },
        totals: {
          totalBudget,
          totalSpent,
          totalRemaining: totalBudget - totalSpent,
          percentUsed: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : null,
          projectsOverBudget: projectSummaries.filter((p) => p.overBudget).length,
        },
        projects: projectSummaries,
      },
    });
  } catch (error) {
    console.error('Owner dashboard error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/owner/projects/:id/cost-breakdown
 *
 * Full drill-down for one project: budget vs. actual per category, labor split
 * by trade, recent transactions, and the audit trail of budget changes.
 */
router.get('/projects/:id/cost-breakdown', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId).lean();

    if (!project || project._deleted) {
      res.status(404).json({ success: false, error: { message: 'Project not found.' } });
      return;
    }

    const [payments, purchases, pettyCash, assignments, teams, users] = await Promise.all([
      Payment.find({ projectId, _deleted: false }).sort({ date: -1 }).lean(),
      MaterialPurchase.find({ projectId, _deleted: false }).sort({ date: -1 }).lean(),
      PettyCash.find({ projectId, _deleted: false }).lean(),
      TeamSiteAssignment.find({ projectId, _deleted: false }).lean(),
      Team.find({ _deleted: false }).lean(),
      User.find({ _deleted: false }).select('name role').lean(),
    ]);

    const teamMap = new Map(teams.map((t: any) => [toId(t._id), t]));
    const userMap = new Map(users.map((u: any) => [toId(u._id), u]));

    const laborTotal = payments
      .filter((p: any) => LABOR_PAYMENT_TYPES.includes(p.type))
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    const materialsTotal = purchases.reduce((sum: number, p: any) => sum + p.amount, 0);
    const pettyCashSpent = pettyCash.reduce(
      (sum: number, record: any) =>
        sum + (record.expenses || []).reduce((s: number, e: any) => s + e.amount, 0),
      0
    );
    const pettyCashIssued = pettyCash.reduce(
      (sum: number, record: any) =>
        sum + (record.floatIssued || []).reduce((s: number, f: any) => s + f.amount, 0),
      0
    );

    const spentByCategory: Partial<Record<BudgetCategory, number>> = {
      [BudgetCategory.LABOR]: laborTotal,
      [BudgetCategory.MATERIALS]: materialsTotal,
      // Petty cash covers day-to-day site running costs.
      [BudgetCategory.OVERHEAD]: pettyCashSpent,
    };

    const budget = (project.budget || {}) as Record<string, number>;
    const categories = BUDGET_CATEGORIES.map((category) => {
      const budgeted = typeof budget[category] === 'number' ? budget[category] : 0;
      const spent = spentByCategory[category] || 0;
      return {
        category,
        budgeted,
        spent,
        remaining: budgeted - spent,
        percentUsed: budgeted > 0 ? Math.round((spent / budgeted) * 100) : null,
        // Categories without a spend source yet still show their allocation.
        tracked: spentByCategory[category] !== undefined,
      };
    });

    // Labor spend grouped by the trade of the team that was paid.
    const laborByTrade = new Map<string, number>();
    for (const payment of payments) {
      if (!LABOR_PAYMENT_TYPES.includes(payment.type)) continue;
      const team = payment.teamId ? teamMap.get(toId(payment.teamId)) : null;
      const trade = (team as any)?.trade || 'unassigned';
      laborByTrade.set(trade, (laborByTrade.get(trade) || 0) + payment.amount);
    }

    const budgetByTrade = (budget.byTrade || {}) as Record<string, number>;
    const trades = Array.from(
      new Set([...laborByTrade.keys(), ...Object.keys(budgetByTrade)])
    ).map((trade) => ({
      trade,
      budgeted: typeof budgetByTrade[trade] === 'number' ? budgetByTrade[trade] : 0,
      spent: laborByTrade.get(trade) || 0,
    }));

    const transactions = [
      ...payments.map((p: any) => ({
        id: toId(p._id),
        kind: 'payment' as const,
        label: `${String(p.type).replace(/_/g, ' ')}${
          p.teamId ? ` — ${(teamMap.get(toId(p.teamId)) as any)?.name || 'Team'}` : ''
        }`,
        amount: p.amount,
        date: p.date,
        notes: p.notes || '',
        flagged: false,
      })),
      ...purchases.map((p: any) => ({
        id: toId(p._id),
        kind: 'purchase' as const,
        label: p.material,
        amount: p.amount,
        date: p.date,
        notes: p.notes || '',
        // Surface bookkeeping problems the Owner may want to chase.
        flagged: !p.receiptPhotoUrl || p.flaggedLate,
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    const budgetHistory = (project.budgetHistory || []).map((record: any) => ({
      previousTotal: sumBudget(record.previousValue),
      newTotal: sumBudget(record.newValue),
      changedBy: (userMap.get(String(record.changedBy)) as any)?.name || 'Unknown user',
      changedAt: record.changedAt,
      reason: record.reason || '',
    }));

    const budgetTotal = sumBudget(budget);
    const spentTotal = laborTotal + materialsTotal + pettyCashSpent;

    res.json({
      success: true,
      data: {
        project: {
          projectId: toId(project._id),
          name: project.name,
          location: project.location,
          status: project.status,
          startDate: project.startDate,
          expectedEndDate: project.expectedEndDate,
          siteSupervisorName: project.siteSupervisorId
            ? (userMap.get(toId(project.siteSupervisorId)) as any)?.name || null
            : null,
        },
        totals: {
          budgetTotal,
          spentTotal,
          remaining: budgetTotal - spentTotal,
          percentUsed: budgetTotal > 0 ? Math.round((spentTotal / budgetTotal) * 100) : null,
          labor: laborTotal,
          materials: materialsTotal,
          pettyCashSpent,
          pettyCashIssued,
          pettyCashOnHand: pettyCashIssued - pettyCashSpent,
        },
        categories,
        trades,
        transactions,
        budgetHistory,
        activeTeamCount: assignments.filter((a: any) => !a.unassignedDate).length,
      },
    });
  } catch (error) {
    console.error('Owner cost breakdown error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
