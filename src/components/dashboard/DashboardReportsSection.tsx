import React, { useMemo, useState } from 'react';
import { buildFinancialReportRows, filterFinancialTasks } from '../../utils/financialReport';
import { hasTaskAnalyticsData } from '../../utils/taskAnalyticsReport';
import { FinancialInsightsReport } from './FinancialInsightsReport';
import { TaskAnalyticsReport } from './TaskAnalyticsReport';

interface DashboardReportsSectionProps {
  tasks: any[];
  creatorUserId?: string | null;
  dueSoonDays?: number;
}

export function DashboardReportsSection({
  tasks,
  creatorUserId,
  dueSoonDays = 3,
}: DashboardReportsSectionProps) {
  const [reportsOpen, setReportsOpen] = useState(false);
  const [financialOpen, setFinancialOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const hasFinancialData = useMemo(() => {
    const financialTasks = filterFinancialTasks(tasks, creatorUserId);
    return buildFinancialReportRows(financialTasks).length > 0;
  }, [tasks, creatorUserId]);

  const hasAnalyticsData = useMemo(() => hasTaskAnalyticsData(tasks), [tasks]);

  if (!hasFinancialData && !hasAnalyticsData) return null;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setReportsOpen((open) => !open)}
        className="group flex h-fit w-full items-center justify-between rounded-xl border border-gray-200 border-l-[4px] border-l-emerald-500 bg-white p-3 shadow-sm transition-colors duration-200 hover:shadow-md dark:border-gray-700 dark:bg-slate-800/95"
      >
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <span className="material-symbols-outlined text-xl">assessment</span>
          </div>
          <div className="text-left">
            <span className="mb-0.5 block text-base font-semibold text-gray-900 dark:text-white">Reports</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Financial insights and task analytics
            </span>
          </div>
        </div>
        <span
          className={`material-symbols-outlined text-2xl text-gray-400 transition-all group-hover:text-emerald-600 dark:group-hover:text-emerald-400 ${reportsOpen ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      {reportsOpen ? (
        <div className="mt-3 space-y-3">
          {hasFinancialData ? (
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-slate-800/95">
              <button
                type="button"
                onClick={() => setFinancialOpen((open) => !open)}
                className="group flex w-full items-center justify-between py-1"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="h-6 w-1 shrink-0 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                    Financial Insights
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-xl text-gray-400 transition-all group-hover:text-emerald-600 dark:group-hover:text-emerald-400 ${financialOpen ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </button>

              {financialOpen ? (
                <div className="mt-3 overflow-x-auto border-t border-gray-100 pt-3 dark:border-gray-700">
                  <FinancialInsightsReport tasks={tasks} creatorUserId={creatorUserId} hideTitle />
                </div>
              ) : null}
            </div>
          ) : null}

          {hasAnalyticsData ? (
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-slate-800/95">
              <button
                type="button"
                onClick={() => setAnalyticsOpen((open) => !open)}
                className="group flex w-full items-center justify-between py-1"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="h-6 w-1 shrink-0 rounded-full bg-violet-500" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                    Task Analytics Report
                  </span>
                </div>
                <span
                  className={`material-symbols-outlined text-xl text-gray-400 transition-all group-hover:text-violet-600 dark:group-hover:text-violet-400 ${analyticsOpen ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </button>

              {analyticsOpen ? (
                <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                  <TaskAnalyticsReport tasks={tasks} dueSoonDays={dueSoonDays} hideTitle />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
