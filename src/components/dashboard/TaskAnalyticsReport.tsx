import React, { useEffect, useMemo, useState } from 'react';
import {
  buildTaskAnalyticsTableRows,
  downloadTaskAnalyticsReportCsv,
  EMPTY_TASK_ANALYTICS_FILTERS,
  getCascadingFilterOptions,
  TASK_ANALYTICS_REPORT_TITLE,
  TASK_ANALYTICS_STATUS_COLUMNS,
  type TaskAnalyticsFilters,
} from '../../utils/taskAnalyticsReport';

interface TaskAnalyticsReportProps {
  tasks: any[];
  dueSoonDays?: number;
  hideTitle?: boolean;
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
    <label className="flex min-w-[160px] flex-1 flex-col gap-1">
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      <select className={selectClassName} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TaskAnalyticsReport({ tasks, dueSoonDays = 3, hideTitle = false }: TaskAnalyticsReportProps) {
  const [filters, setFilters] = useState<TaskAnalyticsFilters>(EMPTY_TASK_ANALYTICS_FILTERS);

  const options = useMemo(() => getCascadingFilterOptions(tasks, filters), [tasks, filters]);
  const { rows, groupLabel } = useMemo(
    () => buildTaskAnalyticsTableRows(tasks, filters, dueSoonDays),
    [tasks, filters, dueSoonDays]
  );

  useEffect(() => {
    if (filters.employeeId && !options.employees.some((o) => o.value === filters.employeeId)) {
      setFilters((prev) => ({ ...prev, employeeId: '', client: '', serviceCategory: '', taskPeriod: '' }));
      return;
    }
    if (filters.client && !options.clients.some((o) => o.value === filters.client)) {
      setFilters((prev) => ({ ...prev, client: '', serviceCategory: '', taskPeriod: '' }));
      return;
    }
    if (
      filters.serviceCategory &&
      !options.serviceCategories.some((o) => o.value === filters.serviceCategory)
    ) {
      setFilters((prev) => ({ ...prev, serviceCategory: '', taskPeriod: '' }));
      return;
    }
    if (filters.taskPeriod && !options.taskPeriods.some((o) => o.value === filters.taskPeriod)) {
      setFilters((prev) => ({ ...prev, taskPeriod: '' }));
    }
  }, [filters, options]);

  const updateFilter = (key: keyof TaskAnalyticsFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'employeeId') {
        next.client = '';
        next.serviceCategory = '';
        next.taskPeriod = '';
      } else if (key === 'client') {
        next.serviceCategory = '';
        next.taskPeriod = '';
      } else if (key === 'serviceCategory') {
        next.taskPeriod = '';
      }
      return next;
    });
  };

  const handleDownload = () => {
    downloadTaskAnalyticsReportCsv(rows, groupLabel, filters, options);
  };

  if (!rows.length) return null;

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
          <FilterSelect
            label="Employee"
            value={filters.employeeId}
            options={options.employees}
            onChange={(v) => updateFilter('employeeId', v)}
          />
          <FilterSelect
            label="Client"
            value={filters.client}
            options={options.clients}
            onChange={(v) => updateFilter('client', v)}
          />
          <FilterSelect
            label="Service Category"
            value={filters.serviceCategory}
            options={options.serviceCategories}
            onChange={(v) => updateFilter('serviceCategory', v)}
          />
          <FilterSelect
            label="Task Period"
            value={filters.taskPeriod}
            options={options.taskPeriods}
            onChange={(v) => updateFilter('taskPeriod', v)}
          />
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60 sm:w-auto sm:text-sm"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Download report
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 border-l-[4px] border-l-violet-500 bg-white shadow-sm dark:border-gray-700 dark:bg-slate-800/95">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                {groupLabel}
              </th>
              {TASK_ANALYTICS_STATUS_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300"
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{row.label}</td>
                {TASK_ANALYTICS_STATUS_COLUMNS.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">
                    {row.counts[col.key]}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
