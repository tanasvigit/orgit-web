import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getTaskCreationUserConfig,
  updateTaskCreationUserConfig,
  taskCreationUserConfigQueryKey,
} from '../../services/userTaskCreationConfigService';
import {
  FALLBACK_TASK_CREATION_USER_CONFIG,
  type TaskCreationUserConfig,
} from '../../utils/taskCreationUserConfig';

export const UserTaskConfigScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [dueDaysFromStart, setDueDaysFromStart] = useState(
    String(FALLBACK_TASK_CREATION_USER_CONFIG.dueDaysFromStart)
  );
  const [targetDaysBeforeDue, setTargetDaysBeforeDue] = useState(
    String(FALLBACK_TASK_CREATION_USER_CONFIG.targetDaysBeforeDue)
  );
  const [autoEscalateTrigger, setAutoEscalateTrigger] = useState<
    TaskCreationUserConfig['autoEscalateTrigger']
  >(FALLBACK_TASK_CREATION_USER_CONFIG.autoEscalateTrigger);
  const [taskUnitPreference, setTaskUnitPreference] = useState<
    TaskCreationUserConfig['taskUnitPreference']
  >(FALLBACK_TASK_CREATION_USER_CONFIG.taskUnitPreference);

  const { isLoading, error } = useQuery(taskCreationUserConfigQueryKey, getTaskCreationUserConfig, {
    onSuccess: (data) => {
      setDueDaysFromStart(String(data.dueDaysFromStart));
      setTargetDaysBeforeDue(String(data.targetDaysBeforeDue));
      setAutoEscalateTrigger(data.autoEscalateTrigger);
      setTaskUnitPreference(data.taskUnitPreference || FALLBACK_TASK_CREATION_USER_CONFIG.taskUnitPreference);
    },
    onError: () => {
      toast.error('Could not load your task defaults. Using built-in defaults until the server is updated.');
    },
  });

  const saveMutation = useMutation(updateTaskCreationUserConfig, {
    onSuccess: (data) => {
      queryClient.setQueryData(taskCreationUserConfigQueryKey, data);
      void queryClient.invalidateQueries(taskCreationUserConfigQueryKey);
      toast.success('User configuration saved');
      navigate(-1);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to save');
    },
  });

  const handleSave = () => {
    const due = Number.parseInt(dueDaysFromStart, 10);
    const targetBefore = Number.parseInt(targetDaysBeforeDue, 10);
    if (!Number.isFinite(due) || due < 1 || due > 365) {
      toast.error('Due date offset must be between 1 and 365 days from start date');
      return;
    }
    if (!Number.isFinite(targetBefore) || targetBefore < 0 || targetBefore > 365) {
      toast.error('Target date offset must be between 0 and 365 days before due date');
      return;
    }
    if (targetBefore > due) {
      toast.error('Target cannot be more days before due than the due offset from start');
      return;
    }
    const payload: TaskCreationUserConfig = {
      dueDaysFromStart: due,
      targetDaysBeforeDue: targetBefore,
      autoEscalateTrigger,
      taskUnitPreference,
    };
    saveMutation.mutate(payload);
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark min-h-screen">
      <div className="max-w-2xl mx-auto w-full p-6 md:p-8">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-1">
              User configuration
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Defaults for new tasks: timeline spacing and auto-escalation trigger when you enable escalation on
              create.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
            {error && (
              <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                Showing editable defaults. Save may fail until the database migration for user task config is applied.
              </p>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Due date — number of days from start date
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                When you set a start date on a new task, the due date defaults to start + this many days (1–365).
              </p>
              <input
                type="number"
                min={1}
                max={365}
                value={dueDaysFromStart}
                onChange={(e) => setDueDaysFromStart(e.target.value)}
                className="w-full max-w-xs rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Target date — number of days before due date
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Target defaults to due date minus this many days (0–365). Must not exceed the due offset from start.
              </p>
              <input
                type="number"
                min={0}
                max={365}
                value={targetDaysBeforeDue}
                onChange={(e) => setTargetDaysBeforeDue(e.target.value)}
                className="w-full max-w-xs rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Task card unit display
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Choose which organization unit is shown in task cards.
              </p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    { key: 'cost_centre' as const, label: 'Cost centre' },
                    { key: 'department' as const, label: 'Department' },
                    { key: 'depot' as const, label: 'Depot' },
                    { key: 'branch' as const, label: 'Branch' },
                    { key: 'entity' as const, label: 'Entity' },
                    { key: 'warehouse' as const, label: 'Warehouse' },
                    { key: 'project' as const, label: 'Project' },
                    { key: 'factory' as const, label: 'Factory' },
                  ]
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setTaskUnitPreference(o.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      taskUnitPreference === o.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Auto escalate — based on
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                When you turn on auto escalation on task creation, this chooses whether rules align to the target date
                or the due date.
              </p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    { key: 'target_date' as const, label: 'Target date' },
                    { key: 'due_date' as const, label: 'Due date' },
                  ]
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setAutoEscalateTrigger(o.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      autoEscalateTrigger === o.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isLoading}
                className="px-6 py-2.5 rounded-xl bg-primary text-white font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {saveMutation.isLoading ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isAdmin) {
    return <AdminLayout>{content}</AdminLayout>;
  }
  return <EmployeeLayout>{content}</EmployeeLayout>;
};
