/**
 * Display formatters shared across screens.
 * Currency is PKR, shown as "Rs" to match the rest of the app.
 */

/** "Rs 1,250,000" */
export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'Rs —';
  return `Rs ${Math.round(amount).toLocaleString()}`;
}

/** "Rs 1.3M" / "Rs 45K" — for stat cards and tight layouts */
export function formatMoneyCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'Rs —';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10_000_000) return `${sign}Rs ${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${sign}Rs ${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}Rs ${(abs / 1_000).toFixed(1)}K`;
  return `${sign}Rs ${Math.round(abs)}`;
}

/** Turns enum-ish values like `daily_wage` into "Daily wage" */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "12 Aug 2026" from an ISO or YYYY-MM-DD string */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Today as YYYY-MM-DD, the format used for all date fields */
export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/** Accepts YYYY-MM-DD only — used to validate manually typed dates */
export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}
