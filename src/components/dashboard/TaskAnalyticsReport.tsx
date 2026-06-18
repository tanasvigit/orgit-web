import React, { useMemo, useState } from 'react';
import {
  buildTaskAnalyticsReport,
  EMPTY_TASK_ANALYTICS_FILTERS,
  downloadTaskAnalyticsReportCsv,
  getDimensionOptionsForSlot,
  hasTaskAnalyticsData,
  TASK_ANALYTICS_FILTER_PLACEHOLDER,
  TASK_ANALYTICS_FILTER_SLOTS,
  TASK_ANALYTICS_REPORT_TITLE,
  TASK_ANALYTICS_STATUS_COLUMNS,
  type TaskAnalyticsFilters,
} from '../../utils/taskAnalyticsReport';

interface TaskAnalyticsReportProps {
  tasks: any[];
  dueSoonDays?: number;
  hideTitle?: boolean;
  excludeUserId?: string | null;
}

const selectClassName =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-gray-700 dark:bg-slate-900 dark:text-white';

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1">
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      <select className={selectClassName} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{TASK_ANALYTICS_FILTER_PLACEHOLDER}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TaskAnalyticsReport({
  tasks,
  dueSoonDays = 3,
  hideTitle = false,
  excludeUserId,
}: TaskAnalyticsReportProps) {
  const [filters, setFilters] = useState<TaskAnalyticsFilters>(EMPTY_TASK_ANALYTICS_FILTERS);

  const reportData = useMemo(
    () => buildTaskAnalyticsReport(tasks, filters, dueSoonDays, excludeUserId),
    [tasks, filters, dueSoonDays, excludeUserId]
  );
  const { rows } = reportData;

  const updateFilter = (key: keyof TaskAnalyticsFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value as TaskAnalyticsFilters[typeof key] }));
  };

  const handleDownload = () => {
    downloadTaskAnalyticsReportCsv(reportData, filters);
  };

  if (!hasTaskAnalyticsData(tasks, excludeUserId)) return null;

  return (
    <div className="space-y-4">
      {!hideTitle ? (
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-8 w-1 shrink-0 rounded-full bg-violet-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
            {TASK_ANALYTICS_REPORT_TITLE}
          </h2>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-3">
          {TASK_ANALYTICS_FILTER_SLOTS.map((slot) => (
            <FilterSelect
              key={slot.key}
              label={slot.label}
              value={filters[slot.key]}
              options={getDimensionOptionsForSlot(filters, slot.key)}
              onChange={(v) => updateFilter(slot.key, v)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!rows.length}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60 sm:w-auto sm:text-sm"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Download report
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 border-l-[4px] border-l-violet-500 bg-white shadow-sm dark:border-gray-700 dark:bg-slate-800/95">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr>
              <th className="w-14 px-3 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">
                S No
              </th>
              <th className="min-w-[200px] px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                Particulars
              </th>
              {TASK_ANALYTICS_STATUS_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="min-w-[120px] px-3 py-3 text-center font-semibold text-gray-600 dark:text-gray-300"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + TASK_ANALYTICS_STATUS_COLUMNS.length}
                  className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                >
                  No tasks match the selected filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5 align-top text-center text-gray-700 dark:text-gray-200">
                    {row.sNo ?? ''}
                  </td>
                  <td
                    className="px-4 py-2.5 align-top font-medium text-gray-900 dark:text-white"
                    style={{ paddingLeft: `${16 + row.depth * 20}px` }}
                  >
                    {row.particulars}
                  </td>
                  {TASK_ANALYTICS_STATUS_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-2.5 align-top text-center text-sm text-gray-700 dark:text-gray-200"
                    >
                      {row.countsByStatus[col.key] > 0 ? row.countsByStatus[col.key] : ''}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
