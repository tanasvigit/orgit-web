export const FINANCIAL_REPORT_TITLE = 'Financial Insights';

export const FINANCIAL_REPORT_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const;

export type FinancialReportPeriod = (typeof FINANCIAL_REPORT_PERIODS)[number];

export const FINANCIAL_REPORT_PERIOD_LABELS: Record<FinancialReportPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export type FinancialReportRow = {
  id: string;
  title: string;
  values: Record<FinancialReportPeriod, number>;
  total: number;
};

export type FinancialReportTotals = Record<FinancialReportPeriod, number> & { total: number };

function getPeriodBounds(referenceDate = new Date()) {
  const now = referenceDate;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return { startOfToday, endOfToday, startOfWeek, startOfMonth, startOfYear };
}

export function filterFinancialTasks(tasks: any[], creatorUserId?: string | null): any[] {
  if (!creatorUserId) return [];
  return (tasks || []).filter((task) => {
    const createdBy = task.created_by || task.creator_id;
    const hasFinance = task.financial_value != null || !!task.finance_type;
    return createdBy === creatorUserId && hasFinance;
  });
}

export function buildFinancialReportRows(
  tasks: any[],
  referenceDate = new Date()
): FinancialReportRow[] {
  const { startOfToday, endOfToday, startOfWeek, startOfMonth, startOfYear } =
    getPeriodBounds(referenceDate);

  return (tasks || [])
    .map((task) => {
      const rawAmount = Number(task.financial_value || 0);
      if (!Number.isFinite(rawAmount) || rawAmount === 0) return null;

      const signedAmount =
        (task.finance_type || '').toLowerCase() === 'expense'
          ? -Math.abs(rawAmount)
          : Math.abs(rawAmount);

      const baseDate = new Date(
        task.due_date || task.dueDate || task.created_at || task.createdAt || Date.now()
      );
      if (Number.isNaN(baseDate.getTime())) return null;

      return {
        id: String(task.id),
        title: task.title || 'Untitled task',
        values: {
          daily: baseDate >= startOfToday && baseDate < endOfToday ? signedAmount : 0,
          weekly: baseDate >= startOfWeek ? signedAmount : 0,
          monthly: baseDate >= startOfMonth ? signedAmount : 0,
          yearly: baseDate >= startOfYear ? signedAmount : 0,
        },
        total: signedAmount,
      };
    })
    .filter(Boolean) as FinancialReportRow[];
}

export function computeFinancialReportTotals(rows: FinancialReportRow[]): FinancialReportTotals {
  const totals: FinancialReportTotals = {
    daily: 0,
    weekly: 0,
    monthly: 0,
    yearly: 0,
    total: 0,
  };

  for (const row of rows) {
    for (const period of FINANCIAL_REPORT_PERIODS) {
      totals[period] += row.values[period];
    }
    totals.total += row.total;
  }

  return totals;
}

export function formatFinancialAmount(value: number): string {
  const num = Number(value || 0);
  const sign = num < 0 ? '-' : '';
  return `${sign}${Math.abs(num).toFixed(2)}`;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function getFilteredFinancialReportView(
  rows: FinancialReportRow[],
  period: FinancialReportPeriod
) {
  const filteredRows = rows.map((row) => ({
    ...row,
    periodAmount: row.values[period] || 0,
  }));
  const periodTotal = filteredRows.reduce((sum, row) => sum + row.periodAmount, 0);
  const overallTotal = filteredRows.reduce((sum, row) => sum + row.total, 0);
  return { filteredRows, periodTotal, overallTotal };
}

export function financialReportToCsvForPeriod(
  rows: FinancialReportRow[],
  period: FinancialReportPeriod,
  periodTotal: number,
  overallTotal: number
): string {
  const periodLabel = FINANCIAL_REPORT_PERIOD_LABELS[period];
  const title = `${FINANCIAL_REPORT_TITLE} - ${periodLabel} Report`;
  const header = ['Task', periodLabel, 'Total'];
  const body = rows.map((row) => [
    row.title,
    formatFinancialAmount(row.values[period]),
    formatFinancialAmount(row.total),
  ]);
  const footer = ['Total', formatFinancialAmount(periodTotal), formatFinancialAmount(overallTotal)];

  return [title, header, ...body, footer]
    .map((line) =>
      Array.isArray(line)
        ? line.map((cell) => escapeCsvCell(String(cell))).join(',')
        : escapeCsvCell(String(line))
    )
    .join('\r\n');
}

export function downloadFinancialReportCsvForPeriod(
  rows: FinancialReportRow[],
  period: FinancialReportPeriod,
  periodTotal: number,
  overallTotal: number,
  filename?: string
): void {
  const csv = financialReportToCsvForPeriod(rows, period, periodTotal, overallTotal);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = filename || `financial-insights-${period}-${dateStamp}.csv`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function financialReportToCsv(
  rows: FinancialReportRow[],
  totals: FinancialReportTotals
): string {
  const header = [
    'Task',
    ...FINANCIAL_REPORT_PERIODS.map((period) => FINANCIAL_REPORT_PERIOD_LABELS[period]),
    'Total',
  ];

  const body = rows.map((row) => [
    row.title,
    ...FINANCIAL_REPORT_PERIODS.map((period) => formatFinancialAmount(row.values[period])),
    formatFinancialAmount(row.total),
  ]);

  const footer = [
    'Total',
    ...FINANCIAL_REPORT_PERIODS.map((period) => formatFinancialAmount(totals[period])),
    formatFinancialAmount(totals.total),
  ];

  return [FINANCIAL_REPORT_TITLE, header, ...body, footer]
    .map((line) =>
      Array.isArray(line)
        ? line.map((cell) => escapeCsvCell(String(cell))).join(',')
        : escapeCsvCell(String(line))
    )
    .join('\r\n');
}

export function downloadFinancialReportCsv(
  rows: FinancialReportRow[],
  totals: FinancialReportTotals,
  filename?: string
): void {
  const csv = financialReportToCsv(rows, totals);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = filename || `financial-insights-${dateStamp}.csv`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
