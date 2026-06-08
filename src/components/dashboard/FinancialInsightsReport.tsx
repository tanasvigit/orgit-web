import React, { useState } from 'react';
import {
  FINANCIAL_REPORT_PERIOD_LABELS,
  FINANCIAL_REPORT_PERIODS,
  FINANCIAL_REPORT_TITLE,
  FinancialReportPeriod,
  buildFinancialReportRows,
  downloadFinancialReportCsvForPeriod,
  filterFinancialTasks,
  formatFinancialAmount,
  getFilteredFinancialReportView,
} from '../../utils/financialReport';

interface FinancialInsightsReportProps {
  tasks: any[];
  creatorUserId?: string | null;
  compact?: boolean;
}

export function FinancialInsightsReport({ tasks, creatorUserId, compact = false }: FinancialInsightsReportProps) {
  const [periodFilter, setPeriodFilter] = useState<FinancialReportPeriod>('weekly');
  const financialTasks = filterFinancialTasks(tasks, creatorUserId);
  const rows = buildFinancialReportRows(financialTasks);
  if (!rows.length) return null;

  const { filteredRows, periodTotal, overallTotal } = getFilteredFinancialReportView(rows, periodFilter);
  const periodLabel = FINANCIAL_REPORT_PERIOD_LABELS[periodFilter];
  const cellClass = compact ? 'px-2 py-1.5 text-xs' : 'px-4 py-3';

  const handleDownload = () => {
    downloadFinancialReportCsvForPeriod(rows, periodFilter, periodTotal, overallTotal);
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${compact ? 'mb-1' : 'mb-4 gap-3'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-1 bg-emerald-500 rounded-full ${compact ? 'h-5' : 'h-8'}`} />
          <h2 className={`font-semibold text-gray-900 dark:text-white ${compact ? 'text-sm' : 'text-xl md:text-2xl'}`}>
            {FINANCIAL_REPORT_TITLE}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className={`inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-50 font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 ${
            compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2 text-sm'
          }`}
        >
          <span className="material-symbols-outlined text-base">download</span>
          Download {periodLabel.toLowerCase()} report
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {FINANCIAL_REPORT_PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setPeriodFilter(period)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              periodFilter === period
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300'
            }`}
          >
            {FINANCIAL_REPORT_PERIOD_LABELS[period]}
          </button>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800/95 rounded-xl border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-emerald-500 shadow-sm overflow-x-auto">
        <table className={`min-w-[640px] w-full ${compact ? 'text-xs' : 'text-sm'}`}>
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr>
              <th className={`${cellClass} text-left font-semibold text-gray-600 dark:text-gray-300`}>
                Task
              </th>
              <th className={`${cellClass} text-right font-semibold text-gray-600 dark:text-gray-300`}>
                {periodLabel}
              </th>
              <th className={`${cellClass} text-right font-semibold text-gray-600 dark:text-gray-300`}>
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td className={`${cellClass} text-gray-900 dark:text-white`}>{row.title}</td>
                <td className={`${cellClass} text-right text-gray-700 dark:text-gray-200`}>
                  {formatFinancialAmount(row.periodAmount)}
                </td>
                <td className={`${cellClass} text-right font-semibold text-gray-900 dark:text-white`}>
                  {formatFinancialAmount(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-slate-900/50">
            <tr>
              <td className={`${cellClass} font-semibold text-gray-900 dark:text-white`}>Total</td>
              <td className={`${cellClass} text-right font-semibold text-gray-900 dark:text-white`}>
                {formatFinancialAmount(periodTotal)}
              </td>
              <td className={`${cellClass} text-right font-semibold text-gray-900 dark:text-white`}>
                {formatFinancialAmount(overallTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
