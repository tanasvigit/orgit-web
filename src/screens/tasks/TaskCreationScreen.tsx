import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { taskService } from '../../services/taskService';
import {
  getTaskCreationUserConfig,
  taskCreationUserConfigQueryKey,
} from '../../services/userTaskCreationConfigService';
import {
  computeTaskTimelineFromStart,
  FALLBACK_TASK_CREATION_USER_CONFIG,
} from '../../utils/taskCreationUserConfig';
import { setTaskFinancial } from '../../utils/taskFinancialStorage';
import { conversationService } from '../../services/conversationService';
import { masterDataService } from '../../services/masterDataService';
import { CustomDatePicker } from '../../components/shared/CustomDatePicker';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';

export const TaskCreationScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [taskType, setTaskType] = useState<'one_time' | 'recurring'>('one_time');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskOwner, setTaskOwner] = useState<'self' | 'contacts'>('self');
  const [taskOwnerUserId, setTaskOwnerUserId] = useState<string | null>(null);
  const [financialValue, setFinancialValue] = useState<string>('');
  const [financeType, setFinanceType] = useState<'income' | 'expense'>('income');
  const [selectedAssignees, setSelectedAssignees] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [titleHighlightedIndex, setTitleHighlightedIndex] = useState(-1);
  const titleSuggestionsRef = useRef<HTMLDivElement>(null);
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('weekly');
  const [taskRolloutType, setTaskRolloutType] = useState<'cycle_start' | 'start_date'>('cycle_start');
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportingMemberId, setReportingMemberId] = useState<string | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || location.pathname.startsWith('/admin');

  // Fetch task services for title suggestions (Google-like autocomplete)
  const { data: taskServicesData } = useQuery(
    'task-services-all',
    async () => {
      const [recurring, oneTime] = await Promise.all([
        masterDataService.getTaskServices('recurring'),
        masterDataService.getTaskServices('one_time'),
      ]);
      const recurringList = (recurring.data?.data ?? recurring.data ?? []) as { id: string; title: string; frequency?: string }[];
      const oneTimeList = (oneTime.data?.data ?? oneTime.data ?? []) as { id: string; title: string; frequency?: string }[];
      const byId = new Map<string, { id: string; title: string; frequency?: string }>();
      [...recurringList, ...oneTimeList].forEach((s) => {
        if (s?.id && !byId.has(s.id)) byId.set(s.id, s);
      });
      return Array.from(byId.values());
    },
    { staleTime: 5 * 60 * 1000 }
  );
  const allTitleServices = Array.isArray(taskServicesData) ? taskServicesData : [];
  const titleSuggestions = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (q) {
      return allTitleServices.filter((s) => (s.title || '').toLowerCase().includes(q));
    }
    return allTitleServices.slice(0, 15);
  }, [title, allTitleServices]);

  // Fetch users for assignee selection
  const { data: usersData } = useQuery(
    'allUsers',
    () => conversationService.getAllUsers()
  );

  const { data: tcUserConfig, isFetched } = useQuery(
    taskCreationUserConfigQueryKey,
    getTaskCreationUserConfig,
    {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    }
  );

  const timelineAppliedRef = useRef(false);
  useEffect(() => {
    if (!isFetched || timelineAppliedRef.current) return;
    timelineAppliedRef.current = true;
    const cfg = tcUserConfig ?? FALLBACK_TASK_CREATION_USER_CONFIG;
    const { start, target, due } = computeTaskTimelineFromStart(new Date(), cfg);
    setStartDate(start);
    setTargetDate(target);
    setDueDate(due);
  }, [isFetched, tcUserConfig]);

  const allUsers = usersData || [];
  const currentOrgId = user?.organizationId || (user as any)?.organization_id;
  const displayUsers = React.useMemo(() => {
    const orgUsers = currentOrgId
      ? allUsers.filter((u: any) => (u.organization_id || u.organizationId) === currentOrgId)
      : allUsers;
    const hasSearch = (assigneeSearchQuery || '').trim().length > 0;
    const q = assigneeSearchQuery.trim().toLowerCase();
    if (hasSearch) {
      return orgUsers.filter(
        (u: any) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.mobile || u.phone || '').toString().toLowerCase().includes(q)
      );
    }
    return orgUsers;
  }, [allUsers, assigneeSearchQuery, currentOrgId]);

  // Check if form has any data entered by user
  const hasFormData = () => {
    return (
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      selectedAssignees.length > 0 ||
      financialValue.trim().length > 0 ||
      taskType === 'recurring' ||
      taskOwner !== 'self' ||
      taskOwnerUserId !== null ||
      reportingMemberId !== null ||
      autoEscalate
    );
  };

  // Handle cancel with confirmation if data exists
  const handleCancel = () => {
    if (hasFormData()) {
      toast.confirm('You have unsaved changes. Are you sure you want to leave?', {
        confirmLabel: 'Discard',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          navigate(-1);
        },
        onCancel: () => {
          // Do nothing, stay on page
        },
      });
    } else {
      navigate(-1);
    }
  };

  // Format date time helper
  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Toggle assignee
  const toggleAssignee = (user: any) => {
    setSelectedAssignees((prev) => {
      const exists = prev.find(u => u.id === user.id);
      if (exists) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  // Handle create task
  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    if (!dueDate) {
      toast.error('Please select a due date');
      return;
    }

    setLoading(true);
    try {
      const parsedFinancialValue =
        financialValue.trim().length > 0 ? Number.parseFloat(financialValue) : null;

      const fallbackAssignees =
        selectedAssignees.length > 0
          ? selectedAssignees
          : user
          ? [{ id: (user as any).id || (user as any).userId, name: (user as any).name }]
          : [];

      const taskData: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        task_type: taskType,
        task_owner: taskOwner,
        financial_value: Number.isFinite(parsedFinancialValue as number) ? parsedFinancialValue : null,
        finance_type: financialValue.trim().length > 0 ? financeType : null,
        assignee_ids: fallbackAssignees.map(a => a.id),
        start_date: startDate.toISOString(),
        target_date: targetDate.toISOString(),
        due_date: dueDate.toISOString(),
        recurrence_type: taskType === 'recurring' ? recurrenceType : null,
        recurrence_interval: 1,
        task_rollout_type: taskType === 'recurring' ? taskRolloutType : undefined,
        auto_escalate: autoEscalate,
        reporting_member_id: reportingMemberId || undefined,
        metadata: {
          ...(taskOwner === 'contacts' && taskOwnerUserId ? { taskOwnerUserId } : {}),
        },
      };
      // When task owner is another member, send creator_id so API sets them as owner and task is hidden from requester
      if (taskOwner === 'contacts' && taskOwnerUserId) {
        taskData.creator_id = taskOwnerUserId;
      }

      const created = await taskService.createTask(taskData);
      const taskId = (created && typeof created === 'object' && (created as any).id) ? (created as any).id : null;
      if (taskId && (taskData.financial_value != null || taskData.finance_type)) {
        setTaskFinancial(taskId, {
          financial_value: taskData.financial_value ?? null,
          finance_type: taskData.finance_type ?? null,
        });
      }
      navigate('/tasks');
    } catch (error: any) {
      console.error('Create task error:', error);
      toast.error(error.response?.data?.error || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="bg-background-light dark:bg-background-dark font-display text-gray-900 dark:text-gray-100 flex flex-col min-h-screen overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-primary dark:bg-primary/90 backdrop-blur-md border-b border-primary/20 px-4 h-14 flex items-center justify-between shadow-md">
        <button
          onClick={handleCancel}
          className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors font-medium"
        >
          Cancel
        </button>
        <h2 className="text-lg font-bold text-white tracking-tight">Create Task</h2>
        <button
          onClick={handleCreate}
          disabled={loading || !title.trim()}
          className="text-white hover:bg-white/20 rounded-lg px-3 py-1.5 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Main Form Content */}
      <main className="flex-1 w-full max-w-lg mx-auto p-4 pb-32 flex flex-col gap-6 overflow-y-auto">
        {/* Task Type Tabs */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setTaskType('one_time')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
              taskType === 'one_time'
                ? 'bg-primary text-white shadow-md'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            One-Time Task
          </button>
          <button
            onClick={() => setTaskType('recurring')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
              taskType === 'recurring'
                ? 'bg-primary text-white shadow-md'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Recurring Task
          </button>
        </div>

        {/* Task Title - with service list suggestions (Google-like) */}
        <div className="relative" ref={titleSuggestionsRef}>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Task Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setShowTitleSuggestions(true);
              setTitleHighlightedIndex(-1);
            }}
            onFocus={() => setShowTitleSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (!showTitleSuggestions || titleSuggestions.length === 0) {
                if (e.key === 'Escape') setShowTitleSuggestions(false);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setTitleHighlightedIndex((i) => (i < titleSuggestions.length - 1 ? i + 1 : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setTitleHighlightedIndex((i) => (i > 0 ? i - 1 : titleSuggestions.length - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = titleSuggestions[titleHighlightedIndex >= 0 ? titleHighlightedIndex : 0];
                if (item?.title) {
                  setTitle(item.title);
                  setShowTitleSuggestions(false);
                  setTitleHighlightedIndex(-1);
                }
              } else if (e.key === 'Escape') {
                setShowTitleSuggestions(false);
                setTitleHighlightedIndex(-1);
              }
            }}
            placeholder="Type or select from service list (e.g. GSTR 1, GSTR 9…)"
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              showTitleSuggestions && titleSuggestions.length > 0
                ? 'border-primary/40 shadow-md'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {showTitleSuggestions && titleSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1">
              {titleSuggestions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTitle(item.title || '');
                    setShowTitleSuggestions(false);
                    setTitleHighlightedIndex(-1);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                    index === titleHighlightedIndex
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <span className="material-icons-outlined text-lg text-gray-400 dark:text-gray-500 shrink-0">assignment</span>
                  <span className="font-medium truncate">{item.title}</span>
                  {item.frequency && (
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 shrink-0">{item.frequency}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add detailed instructions, checklist items, or context for this task..."
            rows={6}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
        </div>

        {/* Assigned To */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Assigned To
          </label>
          <button
            onClick={() => setShowAssigneeModal(true)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">people</span>
              <span className="text-gray-700 dark:text-gray-300">
                {selectedAssignees.length > 0
                  ? `${selectedAssignees.length} selected`
                  : 'Select employee or team'}
              </span>
            </div>
            <span className="material-symbols-outlined text-gray-400">expand_more</span>
          </button>
        </div>

        {/* Reporting Member Selection - Only show after assignees are selected */}
        {selectedAssignees.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Reporting Member (Optional)
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Select a member who will verify other members' task completions. If not selected, verification requests will go to the task creator.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {selectedAssignees.map((assignee) => {
                const isSelected = reportingMemberId === assignee.id;
                return (
                  <button
                    key={assignee.id}
                    onClick={() => setReportingMemberId(isSelected ? null : assignee.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary dark:bg-primary/20'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-xs font-semibold">
                        {assignee.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <span className={`text-sm font-medium truncate flex-1 text-left ${
                      isSelected
                        ? 'text-primary dark:text-purple-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {assignee.name || assignee.mobile}
                    </span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Schedule Section */}
        <div>
          <h3 className="text-sm font-bold uppercase text-primary dark:text-purple-400 mb-4 tracking-wider">
            SCHEDULE
          </h3>

          {/* Start Date */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <button
              onClick={() => setShowStartPicker(true)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-gray-700 dark:text-gray-300">{formatDateTime(startDate)}</span>
              <span className="material-symbols-outlined text-gray-400">calendar_today</span>
            </button>
          </div>

          {/* Target Date */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Target Date
            </label>
            <button
              onClick={() => setShowTargetPicker(true)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-gray-700 dark:text-gray-300">{formatDateTime(targetDate)}</span>
              <span className="material-symbols-outlined text-gray-400">calendar_today</span>
            </button>
          </div>

          {/* Due Date */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">event</span>
              Due Date
            </label>
            <button
              onClick={() => setShowDuePicker(true)}
              className="w-full px-4 py-3 rounded-lg border-2 border-primary/50 dark:border-primary/50 bg-primary/5 dark:bg-primary/10 text-left flex items-center justify-between hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
            >
              <span className="text-gray-900 dark:text-white font-medium">{formatDateTime(dueDate)}</span>
              <span className="material-symbols-outlined text-primary">calendar_today</span>
            </button>
          </div>
        </div>

        {/* Recurrence Type (if recurring) */}
        {taskType === 'recurring' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Recurrence
              </label>
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setRecurrenceType(type)}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      recurrenceType === type
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Task rollout
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Cycle start: each cycle follows the recurrence pattern. Start date: anchor from the task start date.
              </p>
              <div className="flex gap-2">
                {(
                  [
                    { key: 'cycle_start' as const, label: 'Cycle start' },
                    { key: 'start_date' as const, label: 'Start date' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setTaskRolloutType(o.key)}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      taskRolloutType === o.key
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Task Owner */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Task Owner
          </label>
          <div className="flex gap-2">
            {(['self', 'contacts'] as const).map((owner) => (
              <button
                key={owner}
                onClick={() => {
                  setTaskOwner(owner);
                  if (owner !== 'contacts') setTaskOwnerUserId(null);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  taskOwner === owner
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {owner === 'self' ? 'Self' : 'Contacts'}
              </button>
            ))}
          </div>
        </div>

        {/* Task Owner Member (only when task owner = contacts) */}
        {taskOwner === 'contacts' && selectedAssignees.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Task Owner Member
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Choose which selected member should be considered the owner.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {selectedAssignees.map((assignee) => {
                const isSelected = taskOwnerUserId === assignee.id;
                return (
                  <button
                    key={assignee.id}
                    onClick={() => setTaskOwnerUserId(isSelected ? null : assignee.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border-primary dark:bg-primary/20'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-xs font-semibold">
                        {assignee.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <span className={`text-sm font-medium truncate flex-1 text-left ${
                      isSelected
                        ? 'text-primary dark:text-purple-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {assignee.name || assignee.mobile}
                    </span>
                    {isSelected && (
                      <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Financial Value (Optional) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Financial Value (Optional)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={financialValue}
            onChange={(e) => setFinancialValue(e.target.value)}
            placeholder="Enter amount"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Finance Type (only show if financial value entered) */}
        {financialValue.trim().length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Type of Finance
            </label>
            <div className="flex gap-2">
              {(['income', 'expense'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFinanceType(type)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    financeType === type
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Auto Escalate Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Auto Escalate
          </label>
          <button
            onClick={() => setAutoEscalate(!autoEscalate)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoEscalate ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoEscalate ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </main>

      {/* Sticky Bottom Action Button */}
      <div className="fixed bottom-0 left-0 w-full bg-background-light dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 p-4 shadow-lg z-40">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleCreate}
            disabled={loading || !title.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-center text-base font-bold text-white shadow-lg shadow-primary/25 transition-transform active:scale-[0.98] hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <span>Create Task</span>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Assignee Selection Modal - Centered in middle of screen */}
      {showAssigneeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAssigneeModal(false)}>
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Assignees</h3>
              <button
                onClick={() => setShowAssigneeModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <input
                type="text"
                value={assigneeSearchQuery}
                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                placeholder="Search by name or number..."
                className="w-full mb-3 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
              {displayUsers.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {assigneeSearchQuery.trim() ? 'No users match your search' : 'No employees available'}
                </p>
              ) : (
                displayUsers.map((usr: any) => {
                  const isSelected = selectedAssignees.find(u => u.id === usr.id);
                  return (
                    <button
                      key={usr.id}
                      onClick={() => toggleAssignee(usr)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg mb-2 transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-gray-100 dark:bg-gray-700 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-semibold">
                          {usr.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-900 dark:text-white">{usr.name || usr.mobile}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{usr.mobile}</p>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {/* Done Button */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowAssigneeModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAssigneeModal(false)}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Pickers */}
      {showStartPicker && (
        <CustomDatePicker
          value={startDate}
          onChange={setStartDate}
          onClose={() => setShowStartPicker(false)}
          title="Start Date"
        />
      )}

      {showTargetPicker && (
        <CustomDatePicker
          value={targetDate}
          onChange={setTargetDate}
          onClose={() => setShowTargetPicker(false)}
          title="Target Date"
        />
      )}

      {showDuePicker && (
        <CustomDatePicker
          value={dueDate}
          onChange={setDueDate}
          onClose={() => setShowDuePicker(false)}
          title="Due Date"
        />
      )}
    </div>
  );

  // Wrap in appropriate layout
  if (isAdmin) {
    return (
      <AdminLayout>
        {content}
      </AdminLayout>
    );
  }

  // Employee route - use EmployeeLayout (no BottomNav)
  return (
    <EmployeeLayout>
      {content}
    </EmployeeLayout>
  );
};
