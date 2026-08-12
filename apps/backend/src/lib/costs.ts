import { BudgetCategory, PaymentRecordType } from '@crewly/shared';

/**
 * Shared spend/budget math used by the Owner and Accountant aggregation
 * endpoints. Spend is always derived from source records, never stored.
 */

/** Budget categories only — `byTrade` is a nested breakdown, not a spend bucket. */
export const BUDGET_CATEGORIES = Object.values(BudgetCategory);

/** Payment types that represent labor cost (petty cash top-ups are tracked separately). */
export const LABOR_PAYMENT_TYPES: string[] = [
  PaymentRecordType.DAILY_WAGE,
  PaymentRecordType.MILESTONE,
  PaymentRecordType.LUMP_SUM_INSTALLMENT,
];

export function sumBudget(budget: Record<string, unknown> | undefined | null): number {
  if (!budget) return 0;
  return BUDGET_CATEGORIES.reduce((total, category) => {
    const value = budget[category];
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
}

export function toId(value: unknown): string {
  return value ? String((value as { _id?: unknown })._id ?? value) : '';
}

export interface SpendMaps {
  laborByProject: Map<string, number>;
  topUpByProject: Map<string, number>;
  materialsByProject: Map<string, number>;
  pettyCashByProject: Map<string, number>;
}

/**
 * Roll up spend per project in a single pass over each collection.
 * Petty cash top-up payments go to their own bucket so the money isn't
 * counted twice (once as a payment, once as a petty cash expense).
 */
export function buildSpendMaps(
  payments: Array<{ projectId: unknown; type: string; amount: number }>,
  purchases: Array<{ projectId: unknown; amount: number }>,
  pettyCash: Array<{ projectId: unknown; expenses?: Array<{ amount: number }> }>
): SpendMaps {
  const laborByProject = new Map<string, number>();
  const topUpByProject = new Map<string, number>();
  for (const payment of payments) {
    const pid = toId(payment.projectId);
    const bucket = LABOR_PAYMENT_TYPES.includes(payment.type) ? laborByProject : topUpByProject;
    bucket.set(pid, (bucket.get(pid) || 0) + payment.amount);
  }

  const materialsByProject = new Map<string, number>();
  for (const purchase of purchases) {
    const pid = toId(purchase.projectId);
    materialsByProject.set(pid, (materialsByProject.get(pid) || 0) + purchase.amount);
  }

  const pettyCashByProject = new Map<string, number>();
  for (const record of pettyCash) {
    const pid = toId(record.projectId);
    const spent = (record.expenses || []).reduce((sum, e) => sum + e.amount, 0);
    pettyCashByProject.set(pid, (pettyCashByProject.get(pid) || 0) + spent);
  }

  return { laborByProject, topUpByProject, materialsByProject, pettyCashByProject };
}
