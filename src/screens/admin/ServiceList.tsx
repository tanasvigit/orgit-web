import React from 'react';
import { useQuery } from 'react-query';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { masterDataService, TaskServiceItem, TaskServiceType } from '../../services/masterDataService';

export const ServiceList: React.FC = () => {
  const [type, setType] = React.useState<TaskServiceType>('recurring');

  const { data, isLoading, error } = useQuery(['task-services', type], async () => {
    const res = await masterDataService.getTaskServices(type);
    return (res.data.data || res.data) as TaskServiceItem[];
  });

   const { data: freqData } = useQuery(['task-frequencies'], async () => {
    const res = await masterDataService.getTaskFrequencies();
    return res.data.data || res.data;
  });

  const services = Array.isArray(data) ? data : [];
  const frequencyOptions: Array<{ value: string; label: string }> = Array.isArray(freqData)
    ? freqData
    : [
        { value: 'Daily', label: 'Daily' },
        { value: 'Weekly', label: 'Weekly' },
        { value: 'Fortnightly', label: 'Fortnightly' },
        { value: 'Monthly', label: 'Monthly' },
        { value: 'Quarterly', label: 'Quarterly' },
        { value: 'Half Yearly', label: 'Half Yearly' },
        { value: 'Yearly', label: 'Yearly' },
        { value: 'NA', label: 'NA' },
        { value: 'Custom', label: 'Custom' },
      ];

  const formatRollout = (rule: string) => {
    if (rule === 'one_month_before_period_end') return '1 MONTH BEFORE PERIOD END';
    return 'End of Period';
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1.5">
              Service List
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Master list used for tasks and client service matrix
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setType('recurring')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                type === 'recurring' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              Recurring
            </button>
            <button
              onClick={() => setType('one_time')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                type === 'one_time' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              One-Time
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : error ? (
          <div className="text-red-600">Failed to load services</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      TITLE / SERVICE
                    </th>
                    {type === 'recurring' && (
                      <>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          FREQUENCY
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          TASK ROLL OUT
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {services.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                        {s.title}
                      </td>
                      {type === 'recurring' && (
                        <>
                          <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                            <select
                              className="min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 text-sm"
                              defaultValue={s.frequency}
                            >
                              {frequencyOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                            {formatRollout(s.rollout_rule)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td
                        colSpan={type === 'recurring' ? 3 : 1}
                        className="px-6 py-10 text-center text-sm text-slate-500"
                      >
                        No services found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

