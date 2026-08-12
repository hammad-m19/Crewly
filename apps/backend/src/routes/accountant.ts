import { Router, Response } from 'express';
import { Project } from '../models/Project';
import { Team } from '../models/Team';
import { TeamSiteAssignment } from '../models/TeamSiteAssignment';
import { DailyReport } from '../models/DailyReport';
import { TaskVerification } from '../models/TaskVerification';
import { MaterialPurchase } from '../models/MaterialPurchase';
import { PettyCash } from '../models/PettyCash';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import {
  Role,
  BudgetCategory,
  PaymentType,
  PaymentRecordType,
  AttendanceStatus,
} from '@crewly/shared';
import { buildSpendMaps, sumBudget, toId } from '../lib/costs';

const router = Router();

/** Every route here is for finance roles. */
router.use(requireRole(Role.ACCOUNTANT, Role.OWNER));

/** How far back the payment queue scans daily reports for unpaid work. */
const QUEUE_LOOKBACK_DAYS = 30;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * GET /api/accountant/payment-queue
 *
 * Everything awaiting payment, in three buckets:
 * - dailyWages: report entries for daily-wage teams with no wage payment yet.
 *   Suggested amount = headcount × team dailyRate (half for half-days).
 * - milestones: completed AND verified tasks for milestone teams, unpaid.
 * - lumpSums: active lump-sum assignments with an outstanding balance.
 */
router.get('/payment-queue', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cutoff = isoDaysAgo(QUEUE_LOOKBACK_DAYS);

    const [projects, teams, assignments, reports, payments, verifications] = await Promise.all([
      Project.find({ _deleted: false }).lean(),
      Team.find({ _deleted: false }).lean(),
      TeamSiteAssignment.find({ _deleted: false }).lean(),
      DailyReport.find({ date: { $gte: cutoff }, _deleted: false }).sort({ date: -1 }).lean(),
      Payment.find({ _deleted: false }).lean(),
      TaskVerification.find({ _deleted: false }).lean(),
    ]);

    const projectMap = new Map(projects.map((p: any) => [toId(p._id), p]));
    const teamMap = new Map(teams.map((t: any) => [toId(t._id), t]));

    // Payment terms per (project, team) — prefer the active assignment.
    const assignmentMap = new Map<string, any>();
    for (const assignment of assignments) {
      const key = `${toId(assignment.projectId)}_${toId(assignment.teamId)}`;
      const existing = assignmentMap.get(key);
      if (!existing || (existing.unassignedDate && !assignment.unassignedDate)) {
        assignmentMap.set(key, assignment);
      }
    }

    const paidKeys = new Set(
      payments
        .filter((p: any) => p.linkedDailyReportId && p.teamId)
        .map((p: any) => `${toId(p.linkedDailyReportId)}_${toId(p.teamId)}_${p.type}`)
    );
    const verifiedKeys = new Set(
      verifications.map((v: any) => `${toId(v.dailyReportId)}_${v.teamEntryIndex}`)
    );

    const dailyWages: any[] = [];
    const milestones: any[] = [];

    for (const report of reports) {
      const reportId = toId(report._id);
      const projectId = toId(report.projectId);
      const project: any = projectMap.get(projectId);
      const entries = report.teamEntries || [];

      for (let i = 0; i < entries.length; i++) {
        const entry: any = entries[i];
        if (!entry.teamId) continue; // local labor is paid from petty cash

        const teamId = toId(entry.teamId);
        const team: any = teamMap.get(teamId);
        const assignment = assignmentMap.get(`${projectId}_${teamId}`);
        if (!assignment) continue;

        const base = {
          dailyReportId: reportId,
          date: report.date,
          projectId,
          projectName: project?.name || 'Unknown project',
          teamId,
          teamName: team?.name || 'Unknown team',
          trade: team?.trade || null,
        };

        if (
          assignment.paymentType === PaymentType.DAILY_WAGE &&
          entry.attendanceStatus !== AttendanceStatus.NO_SHOW &&
          entry.headcountPresent > 0 &&
          !paidKeys.has(`${reportId}_${teamId}_${PaymentRecordType.DAILY_WAGE}`)
        ) {
          const halfDay = entry.attendanceStatus === AttendanceStatus.HALF_DAY;
          const rate = typeof team?.dailyRate === 'number' ? team.dailyRate : null;
          dailyWages.push({
            ...base,
            headcount: entry.headcountPresent,
            attendanceStatus: entry.attendanceStatus,
            dailyRate: rate,
            suggestedAmount:
              rate !== null ? Math.round(entry.headcountPresent * rate * (halfDay ? 0.5 : 1)) : null,
          });
        }

        if (
          assignment.paymentType === PaymentType.MILESTONE &&
          entry.taskCompleted &&
          verifiedKeys.has(`${reportId}_${i}`) &&
          !paidKeys.has(`${reportId}_${teamId}_${PaymentRecordType.MILESTONE}`)
        ) {
          milestones.push({
            ...base,
            taskWorkedOn: entry.taskWorkedOn || '',
          });
        }
      }
    }

    // Outstanding lump-sum balances on active assignments.
    const installmentsByAssignment = new Map<string, { paid: number; lastDate: string | null }>();
    for (const payment of payments) {
      if (payment.type !== PaymentRecordType.LUMP_SUM_INSTALLMENT) continue;
      if (!payment.linkedTeamSiteAssignmentId) continue;
      const key = toId(payment.linkedTeamSiteAssignmentId);
      const entry = installmentsByAssignment.get(key) || { paid: 0, lastDate: null };
      entry.paid += payment.amount;
      if (!entry.lastDate || payment.date > entry.lastDate) entry.lastDate = payment.date;
      installmentsByAssignment.set(key, entry);
    }

    const lumpSums = assignments
      .filter(
        (a: any) => a.paymentType === PaymentType.LUMP_SUM && !a.unassignedDate && !a._deleted
      )
      .map((a: any) => {
        const assignmentId = toId(a._id);
        const projectId = toId(a.projectId);
        const teamId = toId(a.teamId);
        const team: any = teamMap.get(teamId);
        const project: any = projectMap.get(projectId);
        const installments = installmentsByAssignment.get(assignmentId) || {
          paid: 0,
          lastDate: null,
        };
        return {
          assignmentId,
          projectId,
          projectName: project?.name || 'Unknown project',
          teamId,
          teamName: team?.name || 'Unknown team',
          trade: team?.trade || null,
          assignedDate: a.assignedDate,
          agreedTotal: a.agreedTotal,
          paidSoFar: installments.paid,
          remaining: a.agreedTotal !== null ? a.agreedTotal - installments.paid : null,
          lastInstallmentDate: installments.lastDate,
        };
      })
      .filter((item) => item.remaining === null || item.remaining > 0);

    res.json({
      success: true,
      data: {
        lookbackDays: QUEUE_LOOKBACK_DAYS,
        counts: {
          dailyWages: dailyWages.length,
          milestones: milestones.length,
          lumpSums: lumpSums.length,
        },
        dailyWages,
        milestones,
        lumpSums,
      },
    });
  } catch (error) {
    console.error('Payment queue error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/accountant/purchases
 *
 * Material purchases enriched with project/purchaser names, plus the counts
 * the Accountant chases: missing receipts, late entries, unverified.
 */
router.get('/purchases', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [purchases, projects, users] = await Promise.all([
      MaterialPurchase.find({ _deleted: false }).sort({ date: -1 }).lean(),
      Project.find({ _deleted: false }).select('name').lean(),
      User.find({ _deleted: false }).select('name').lean(),
    ]);

    const projectNames = new Map(projects.map((p: any) => [toId(p._id), p.name]));
    const userNames = new Map(users.map((u: any) => [toId(u._id), u.name]));

    const items = purchases.map((p: any) => ({
      purchaseId: toId(p._id),
      projectId: toId(p.projectId),
      projectName: projectNames.get(toId(p.projectId)) || 'Unknown project',
      purchasedByName: userNames.get(toId(p.purchasedBy)) || 'Unknown user',
      material: p.material,
      amount: p.amount,
      date: p.date,
      notes: p.notes || '',
      hasReceipt: Boolean(p.receiptPhotoUrl),
      receiptPhotoUrl: p.receiptPhotoUrl || null,
      flaggedLate: Boolean(p.flaggedLate),
      verified: Boolean(p.verified),
      linkedMaterialOrderId: p.linkedMaterialOrderId ? toId(p.linkedMaterialOrderId) : null,
    }));

    res.json({
      success: true,
      data: {
        counts: {
          total: items.length,
          missingReceipt: items.filter((i) => !i.hasReceipt).length,
          flaggedLate: items.filter((i) => i.flaggedLate).length,
          unverified: items.filter((i) => !i.verified).length,
        },
        purchases: items,
      },
    });
  } catch (error) {
    console.error('Accountant purchases error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/accountant/reconciliation
 *
 * Petty cash batches grouped per Site Supervisor, with names resolved and the
 * supervisor/project lists needed by the issue-float form.
 */
router.get('/reconciliation', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [pettyCash, users, projects] = await Promise.all([
      PettyCash.find({ _deleted: false }).sort({ created_at: -1 }).lean(),
      User.find({ _deleted: false }).select('name role isActive assignedSites').lean(),
      Project.find({ _deleted: false }).select('name status').lean(),
    ]);

    const userMap = new Map(users.map((u: any) => [toId(u._id), u]));
    const projectMap = new Map(projects.map((p: any) => [toId(p._id), p]));

    const batches = pettyCash.map((record: any) => {
      const floatTotal = (record.floatIssued || []).reduce(
        (sum: number, f: any) => sum + f.amount,
        0
      );
      const spentTotal = (record.expenses || []).reduce(
        (sum: number, e: any) => sum + e.amount,
        0
      );
      const supervisor: any = userMap.get(toId(record.siteSupervisorId));
      const project: any = projectMap.get(toId(record.projectId));
      return {
        pettyCashId: toId(record._id),
        supervisorId: toId(record.siteSupervisorId),
        supervisorName: supervisor?.name || 'Unknown supervisor',
        projectId: toId(record.projectId),
        projectName: project?.name || 'Unknown project',
        floatTotal,
        spentTotal,
        currentBalance: record.currentBalance,
        reconciled: Boolean(record.reconciled),
        expenseCount: (record.expenses || []).length,
        expensesMissingReceipt: (record.expenses || []).filter((e: any) => !e.receiptPhoto).length,
        expenses: (record.expenses || []).map((e: any) => ({
          amount: e.amount,
          date: e.date,
          description: e.description,
          hasReceipt: Boolean(e.receiptPhoto),
        })),
      };
    });

    // Unreconciled batches first — those block new floats.
    batches.sort((a, b) => Number(a.reconciled) - Number(b.reconciled));

    const supervisors = users
      .filter((u: any) => u.role === Role.SITE_SUPERVISOR && u.isActive !== false)
      .map((u: any) => ({
        userId: toId(u._id),
        name: u.name,
        assignedSites: (u.assignedSites || []).map((s: unknown) => toId(s)),
      }));

    res.json({
      success: true,
      data: {
        counts: {
          unreconciled: batches.filter((b) => !b.reconciled).length,
          reconciled: batches.filter((b) => b.reconciled).length,
        },
        batches,
        supervisors,
        projects: projects.map((p: any) => ({
          projectId: toId(p._id),
          name: p.name,
          status: p.status,
        })),
      },
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

/**
 * GET /api/accountant/cost-reports
 *
 * Per-project cost breakdown (labor vs. materials vs. petty cash) against
 * budget, plus company-wide totals. Same derivation as the Owner dashboard.
 */
router.get('/cost-reports', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [projects, payments, purchases, pettyCash] = await Promise.all([
      Project.find({ _deleted: false }).sort({ created_at: -1 }).lean(),
      Payment.find({ _deleted: false }).lean(),
      MaterialPurchase.find({ _deleted: false }).lean(),
      PettyCash.find({ _deleted: false }).lean(),
    ]);

    const { laborByProject, materialsByProject, pettyCashByProject } = buildSpendMaps(
      payments,
      purchases,
      pettyCash
    );

    const reports = projects.map((project: any) => {
      const pid = toId(project._id);
      const budget = (project.budget || {}) as Record<string, number>;
      const labor = laborByProject.get(pid) || 0;
      const materials = materialsByProject.get(pid) || 0;
      const pettyCashSpent = pettyCashByProject.get(pid) || 0;
      const spentTotal = labor + materials + pettyCashSpent;
      const budgetTotal = sumBudget(budget);

      const categoryValue = (category: BudgetCategory) =>
        typeof budget[category] === 'number' ? budget[category] : 0;

      return {
        projectId: pid,
        name: project.name,
        location: project.location,
        status: project.status,
        budgetTotal,
        spentTotal,
        remaining: budgetTotal - spentTotal,
        percentUsed: budgetTotal > 0 ? Math.round((spentTotal / budgetTotal) * 100) : null,
        overBudget: budgetTotal > 0 && spentTotal > budgetTotal,
        breakdown: {
          labor: { budgeted: categoryValue(BudgetCategory.LABOR), spent: labor },
          materials: { budgeted: categoryValue(BudgetCategory.MATERIALS), spent: materials },
          pettyCash: { budgeted: categoryValue(BudgetCategory.OVERHEAD), spent: pettyCashSpent },
        },
      };
    });

    const totalBudget = reports.reduce((sum, r) => sum + r.budgetTotal, 0);
    const totalSpent = reports.reduce((sum, r) => sum + r.spentTotal, 0);

    res.json({
      success: true,
      data: {
        totals: {
          totalBudget,
          totalSpent,
          totalRemaining: totalBudget - totalSpent,
          percentUsed: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : null,
          totalLabor: reports.reduce((sum, r) => sum + r.breakdown.labor.spent, 0),
          totalMaterials: reports.reduce((sum, r) => sum + r.breakdown.materials.spent, 0),
          totalPettyCash: reports.reduce((sum, r) => sum + r.breakdown.pettyCash.spent, 0),
        },
        projects: reports,
      },
    });
  } catch (error) {
    console.error('Cost reports error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal server error.' } });
  }
});

export default router;
