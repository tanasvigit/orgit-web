import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { masterDataService, TaskServiceItem, TaskServiceType } from '../../services/masterDataService';
import { entityMasterBulkService } from '../../services/entityMasterBulkService';
import { useToast } from '../../context/ToastContext';

const ROLLOUT_OPTIONS: Array<{ value: 'end_of_period' | 'one_month_before_period_end'; label: string }> = [
  { value: 'end_of_period', label: 'End of Period' },
  { value: 'one_month_before_period_end', label: '1 Month Before Period End' },
];

export const ServiceList: React.FC = () => {
  const [type, setType] = useState<'all' | TaskServiceType>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addTaskType, setAddTaskType] = useState<TaskServiceType>('recurring');
  const [addFrequency, setAddFrequency] = useState('Monthly');
  const [addRollout, setAddRollout] = useState<'end_of_period' | 'one_month_before_period_end'>('end_of_period');
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery(['task-services', type], async () => {
    if (type === 'all') {
      const [recurringRes, oneTimeRes] = await Promise.all([
        masterDataService.getTaskServices('recurring'),
        masterDataService.getTaskServices('one_time'),
      ]);
      const recurring = (recurringRes.data.data || recurringRes.data) as TaskServiceItem[];
      const oneTime = (oneTimeRes.data.data || oneTimeRes.data) as TaskServiceItem[];
      return [...recurring, ...oneTime] as TaskServiceItem[];
    }
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

  const handleDownloadServiceListTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await entityMasterBulkService.getTemplate('service-list');
      toast.success('Service List template downloaded. Fill it and upload to bulk update.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: async (res) => {
        const data = res.data?.data;
        if (!data?.uploadId) {
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
          return;
        }
        try {
          const status = await entityMasterBulkService.pollUntilDone(data.uploadId);
          if (status.status === 'completed') {
            toast.success('Service List bulk upload completed.');
          } else {
            toast.warning('Bulk upload finished with errors.');
          }
          if (status.errors?.length) {
            status.errors.slice(0, 5).forEach((e: any) => toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`));
            if (status.errors.length > 5) toast.error(`… and ${status.errors.length - 5} more errors`);
          }
        } catch (err: any) {
          toast.error(err?.message || 'Failed to get upload status');
        }
        queryClient.invalidateQueries('task-services');
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || err.message || 'Upload failed');
      },
      onSettled: () => {
        setIsBulkUploading(false);
      },
    }
  );

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      e.target.value = '';
      return;
    }
    setIsBulkUploading(true);
    bulkUploadMutation.mutate(file);
  };

  const createMutation = useMutation(
    () =>
      masterDataService.createTaskService({
        title: addTitle.trim(),
        task_type: addTaskType,
        frequency: addTaskType === 'recurring' ? addFrequency : undefined,
        rollout_rule: addTaskType === 'recurring' ? addRollout : undefined,
      }),
    {
      onSuccess: () => {
        toast.success('Service added.');
        setShowAddForm(false);
        setAddTitle('');
        setAddTaskType('recurring');
        setAddFrequency('Monthly');
        setAddRollout('end_of_period');
        queryClient.invalidateQueries('task-services');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || err.message || 'Failed to add service');
      },
    }
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1.5">
              Service List
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
                          </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                type === 'all' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700"
            >
              Add service
            </button>
          </div>
        </div>

        {/* Bulk update from Excel */}
        <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Bulk update from Excel</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={handleDownloadServiceListTemplate}
              disabled={isDownloadingTemplate}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 disabled:opacity-50"
            >
              {isDownloadingTemplate ? 'Downloading…' : 'Download Service List template'}
            </button>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleBulkFileChange}
            />
            <button
              type="button"
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={isBulkUploading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50"
            >
              {isBulkUploading ? 'Uploading…' : 'Upload file'}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddForm(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Add service</h3>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {addTaskType === 'recurring' ? 'RECURRING TASK TITLE/SERVICE LIST' : 'ONE TIME TASK LIST'}
                  </label>
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="Service title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    value={addTaskType}
                    onChange={(e) => setAddTaskType(e.target.value as TaskServiceType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="recurring">Recurring</option>
                    <option value="one_time">One-Time</option>
                  </select>
                </div>
                {addTaskType === 'recurring' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">FREQUENCY</label>
                      <select
                        value={addFrequency}
                        onChange={(e) => setAddFrequency(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        {frequencyOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">TASK ROLL OUT</label>
                      <select
                        value={addRollout}
                        onChange={(e) => setAddRollout(e.target.value as 'end_of_period' | 'one_month_before_period_end')}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        {ROLLOUT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={createMutation.isLoading || !addTitle.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50"
                  >
                    {createMutation.isLoading ? 'Saving…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                      SERVICE TITLE
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      FREQUENCY
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      TASK ROLL OUT
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      TYPE
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {services.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                        {s.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {s.task_type === 'recurring' ? (s.frequency || 'NA') : 'NA'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {s.task_type === 'recurring' ? formatRollout(s.rollout_rule) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200 text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            s.task_type === 'recurring'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700'
                              : 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700'
                          }`}
                        >
                          {s.task_type === 'recurring' ? 'Recurring' : 'One-Time'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
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

