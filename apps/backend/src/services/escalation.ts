import {
  Role,
  NotificationType,
  MaterialOrderStatus,
  AttendanceStatus,
  ESCALATION_THRESHOLD_HOURS,
} from '@crewly/shared';
import { Notification } from '../models/Notification';
import { MaterialOrder } from '../models/MaterialOrder';
import { DailyReport } from '../models/DailyReport';
import { notifyRole } from './notify';

const RECEIVED_STATUSES: string[] = [
  MaterialOrderStatus.RECEIVED_FULL,
  MaterialOrderStatus.RECEIVED_PARTIAL,
];

const HOUR_MS = 60 * 60 * 1000;
const ESCALATION_MS = ESCALATION_THRESHOLD_HOURS * HOUR_MS;

export interface EscalationRunResult {
  materialOverdueCreated: number;
  escalationIdleCreated: number;
  escalationNoShowCreated: number;
}

/**
 * Hourly job:
 * 1. Material overdue → Super Supervisors (MATERIAL_OVERDUE), idempotent per order/day
 * 2. Idle / no-show older than 24h still unresolved → Owners (ESCALATION_*), idempotent
 *
 * "Unresolved" = a NO_SHOW / IDLE_TEAM in-app notification older than the
 * threshold with no matching ESCALATION_* row for the same escalationKey.
 */
export async function runEscalationCheck(): Promise<EscalationRunResult> {
  const result: EscalationRunResult = {
    materialOverdueCreated: 0,
    escalationIdleCreated: 0,
    escalationNoShowCreated: 0,
  };

  try {
    result.materialOverdueCreated = await checkMaterialOverdue();
    const escalations = await escalateStaleAlerts();
    result.escalationIdleCreated = escalations.idle;
    result.escalationNoShowCreated = escalations.noShow;
  } catch (error) {
    console.error('Escalation check error:', error);
  }

  return result;
}

async function checkMaterialOverdue(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const dayStart = new Date(`${today}T00:00:00.000Z`).getTime();

  const overdueOrders = await MaterialOrder.find({
    _deleted: false,
    expectedDeliveryDate: { $ne: null, $lt: today },
    status: { $nin: RECEIVED_STATUSES },
  }).lean();

  let created = 0;

  for (const order of overdueOrders) {
    const orderId = order._id.toString();
    const escalationKey = `material_overdue:${orderId}`;

    const existing = await Notification.findOne({
      type: NotificationType.MATERIAL_OVERDUE,
      _deleted: false,
      created_at: { $gte: dayStart },
      metadata: { $regex: escalationKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },
    }).lean();

    if (existing) continue;

    const count = await notifyRole(Role.SUPER_SUPERVISOR, {
      type: NotificationType.MATERIAL_OVERDUE,
      projectId: order.projectId,
      title: '📦 Material Delivery Overdue',
      message: `${order.material} (${order.quantity}) was due ${order.expectedDeliveryDate} and has not been received.`,
      metadata: {
        escalationKey,
        orderId,
        material: order.material,
        expectedDeliveryDate: order.expectedDeliveryDate,
      },
    });
    created += count;
  }

  return created;
}

async function escalateStaleAlerts(): Promise<{ idle: number; noShow: number }> {
  const cutoff = Date.now() - ESCALATION_MS;

  const stale = await Notification.find({
    type: { $in: [NotificationType.NO_SHOW, NotificationType.IDLE_TEAM] },
    _deleted: false,
    created_at: { $lte: cutoff },
  }).lean();

  let idle = 0;
  let noShow = 0;

  for (const alert of stale) {
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(alert.metadata || '{}');
    } catch {
      meta = {};
    }

    const teamId = String(meta.teamId ?? 'local_labor');
    const date = String(meta.date ?? '');
    const projectId = alert.projectId ? alert.projectId.toString() : '';
    const sourceType = alert.type as NotificationType;

    // Skip if the underlying issue was already resolved (newer report without the flag)
    if (projectId && date && !(await isStillUnresolved(projectId, teamId, sourceType, date))) {
      continue;
    }

    const escalationType =
      sourceType === NotificationType.NO_SHOW
        ? NotificationType.ESCALATION_NO_SHOW
        : NotificationType.ESCALATION_IDLE;

    const escalationKey = `${escalationType}:${projectId}:${teamId}:${date || alert._id.toString()}`;

    const alreadyEscalated = await Notification.findOne({
      type: escalationType,
      _deleted: false,
      metadata: { $regex: escalationKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },
    }).lean();

    if (alreadyEscalated) continue;

    const title =
      escalationType === NotificationType.ESCALATION_NO_SHOW
        ? '🔴 Escalation: No-Show Unresolved'
        : '🔴 Escalation: Idle Team Unresolved';

    const message =
      escalationType === NotificationType.ESCALATION_NO_SHOW
        ? `A no-show reported on ${date || 'an earlier date'} has been unresolved for ${ESCALATION_THRESHOLD_HOURS}+ hours.`
        : `An idle team reported on ${date || 'an earlier date'} has been unresolved for ${ESCALATION_THRESHOLD_HOURS}+ hours.`;

    const count = await notifyRole(Role.OWNER, {
      type: escalationType,
      projectId: alert.projectId,
      title,
      message,
      metadata: {
        escalationKey,
        sourceNotificationId: alert._id.toString(),
        teamId,
        date,
        sourceType,
      },
    });

    if (escalationType === NotificationType.ESCALATION_NO_SHOW) {
      noShow += count;
    } else {
      idle += count;
    }
  }

  return { idle, noShow };
}

/**
 * An issue is still unresolved when the latest report for that project/date
 * still has a matching no-show / idle entry for the team. If the report was
 * corrected, we skip escalation.
 */
async function isStillUnresolved(
  projectId: string,
  teamId: string,
  sourceType: NotificationType,
  date: string
): Promise<boolean> {
  const report = await DailyReport.findOne({
    projectId,
    date,
    _deleted: false,
  }).lean();

  if (!report) return true; // no correction available — treat as still open

  const entries = report.teamEntries || [];
  for (const entry of entries) {
    const entryTeamId = entry.teamId || 'local_labor';
    if (entryTeamId !== teamId && !(teamId === 'local_labor' && !entry.teamId)) {
      continue;
    }

    if (sourceType === NotificationType.NO_SHOW) {
      if (entry.attendanceStatus === AttendanceStatus.NO_SHOW) return true;
    } else if (entry.idleReason && entry.idleReason !== 'no_show') {
      return true;
    }
  }

  return false;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the hourly escalation loop. No-ops when DISABLE_ESCALATION=true
 * (used by integration tests so they can call runEscalationCheck() directly).
 */
export function startEscalationEngine(): void {
  if (process.env.DISABLE_ESCALATION === 'true') {
    console.log('⏱️  Escalation engine disabled (DISABLE_ESCALATION=true)');
    return;
  }

  if (intervalHandle) return;

  // Run once shortly after boot, then hourly
  const initialDelayMs = 15_000;
  setTimeout(() => {
    void runEscalationCheck();
  }, initialDelayMs);

  intervalHandle = setInterval(() => {
    void runEscalationCheck();
  }, HOUR_MS);

  // Don't keep the process alive solely for this timer
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }

  console.log('⏱️  Escalation engine started (hourly)');
}

export function stopEscalationEngine(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
