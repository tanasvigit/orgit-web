import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from 'react-query';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { conversationService } from '../../services/conversationService';
import { taskService } from '../../services/taskService';
import { documentInstanceService } from '../../services/documentInstanceService';
import { masterDataService } from '../../services/masterDataService';
import { entityListService, ServiceMatrixResponse } from '../../services/entityListService';
import { setTaskFinancial } from '../../utils/taskFinancialStorage';
import { CustomDatePicker } from '../shared/CustomDatePicker';
import { waitForSocketConnection } from '../../services/socketService';

interface TaskCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialTitle?: string;
  initialDescription?: string;
  initialDueDate?: Date;
  complianceId?: string;
  documentId?: string;
  documentAttachment?: {
    mediaUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialTitle = '',
  initialDescription = '',
  initialDueDate,
  complianceId,
  documentId,
  documentAttachment,
}) => {
  const sectionQuestionClass =
    'mb-2 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-[13px] font-medium text-[#1F2937]';
  const inputClass =
    'w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/40';
  const segmentedInactiveClass =
    'bg-[#F9FAFB] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]';
  const segmentedActiveClass = 'bg-primary border border-primary text-white';
  const bubbleRightClass = 'w-full sm:w-[92%] self-end rounded-2xl bg-[#F8F5FF] border border-[#E7D9FF] px-3 py-3';
  const [isRecurring, setIsRecurring] = useState<boolean | null>(null); // null until user selects task type
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskOwner, setTaskOwner] = useState<'self' | 'contacts'>('self');
  const [taskOwnerUserId, setTaskOwnerUserId] = useState<string | null>(null);
  const [financialValue, setFinancialValue] = useState<string>('');
  const [financeType, setFinanceType] = useState<'income' | 'expense'>('income');
  const [selectedAssignees, setSelectedAssignees] = useState<any[]>([]);
  const setDateTo9AM = (d: Date) => {
    d.setHours(9, 0, 0, 0);
    return d;
  };
  const [startDate, setStartDate] = useState(() => setDateTo9AM(new Date()));
  const [targetDate, setTargetDate] = useState(() => setDateTo9AM(new Date()));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return setDateTo9AM(d);
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [titleHighlightedIndex, setTitleHighlightedIndex] = useState(-1);
  const titleSuggestionsRef = useRef<HTMLDivElement>(null);
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'monthly' | 'quarterly' | 'annually'>('weekly');
  const [taskRolloutType, setTaskRolloutType] = useState<'cycle_start' | 'start_date'>('cycle_start');
  const [useScheduleDates, setUseScheduleDates] = useState(true);
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [createTaskLoading, setCreateTaskLoading] = useState(false);
  const [reportingMemberId, setReportingMemberId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<
    'title' | 'client' | 'assignees' | 'recurrence' | 'rollout' | 'schedule' | 'owner' | 'escalation' | 'finance'
  >('title');
  const { toast } = useToast();
  const { user } = useAuth();

  const canOpenClient = activeSection === 'client';
  const canOpenAssignees = activeSection === 'assignees';
  const canOpenRecurrence = activeSection === 'recurrence';
  const canOpenRollout = activeSection === 'rollout';
  const canOpenSchedule = activeSection === 'schedule';
  const canOpenOwner = activeSection === 'owner';
  const canOpenEscalation = activeSection === 'escalation';
  const canOpenFinance = activeSection === 'finance';

  const renderQuestionToggle = (
    id: 'title' | 'client' | 'assignees' | 'recurrence' | 'rollout' | 'schedule' | 'owner' | 'escalation' | 'finance',
    text: string,
    _enabled: boolean
  ) => (
    <div className={`${sectionQuestionClass} inline-flex w-fit max-w-[85%] self-start`} data-step={id}>
      {text}
    </div>
  );

  const renderReplyBubble = (text: string, onEdit: () => void) => (
    <div className={bubbleRightClass}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#1F2937]">{text}</p>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-md border border-[#E7D9FF] bg-white px-2 py-1 text-xs font-semibold text-primary"
        >
          Edit
        </button>
      </div>
    </div>
  );

  const goToNextSection = (
    current: 'title' | 'client' | 'assignees' | 'recurrence' | 'rollout' | 'schedule' | 'owner' | 'escalation' | 'finance'
  ) => {
    if (current === 'title') return setActiveSection('client');
    if (current === 'client') return setActiveSection('assignees');
    if (current === 'assignees') return setActiveSection('recurrence');
    if (current === 'recurrence') return setActiveSection(isRecurring === true ? 'rollout' : 'schedule');
    if (current === 'rollout') return setActiveSection('schedule');
    if (current === 'schedule') return setActiveSection('owner');
    if (current === 'owner') return setActiveSection('escalation');
    if (current === 'escalation') return setActiveSection('finance');
  };
  const sectionOrder: Array<
    'title' | 'client' | 'assignees' | 'recurrence' | 'rollout' | 'schedule' | 'owner' | 'escalation' | 'finance'
  > = ['title', 'client', 'assignees', 'recurrence', 'rollout', 'schedule', 'owner', 'escalation', 'finance'];
  const shouldShowReply = (
    section: 'title' | 'client' | 'assignees' | 'recurrence' | 'rollout' | 'schedule' | 'owner' | 'escalation' | 'finance'
  ) => sectionOrder.indexOf(section) < sectionOrder.indexOf(activeSection);


  // Check if form has any data entered by user
  const hasFormData = () => {
    // Check if title has been modified (not just initial value)
    const titleModified = title.trim() && title.trim() !== initialTitle;
    // Check other fields
    const hasOtherData = 
      selectedAssignees.length > 0 ||
      financialValue.trim().length > 0 ||
      isRecurring !== null ||
      !useScheduleDates ||
      taskRolloutType !== 'cycle_start' ||
      autoEscalate ||
      taskOwner !== 'self' ||
      taskOwnerUserId !== null ||
      reportingMemberId !== null;
    
    return titleModified || hasOtherData;
  };

  // Handle close with confirmation if data exists
  const handleClose = () => {
    if (hasFormData()) {
      toast.confirm('You have unsaved changes. Are you sure you want to close?', {
        confirmLabel: 'Discard',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          resetForm();
          onClose();
        },
        onCancel: () => {
          // Do nothing, stay in modal
        },
      });
    } else {
      resetForm();
      onClose();
    }
  };

  // Initialize form with initial values when modal opens (all dates default to 9:00 AM)
  useEffect(() => {
    if (visible) {
      // Always start with a fresh form on each open.
      resetForm();
      setTitle(initialTitle);
      setDescription(initialDescription);
      if (initialDueDate) {
        const d = new Date(initialDueDate);
        d.setHours(9, 0, 0, 0);
        setDueDate(d);
        setTargetDate(new Date(d));
      } else {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 30);
        defaultDueDate.setHours(9, 0, 0, 0);
        setDueDate(defaultDueDate);
        setTargetDate(new Date(defaultDueDate));
      }
    }
  }, [visible, initialTitle, initialDescription, initialDueDate]);

  useEffect(() => {
    if (visible && title.trim() && activeSection === 'title') {
      setActiveSection('client');
    }
  }, [visible, title, activeSection]);

  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  useEffect(() => {
    if (isRecurring !== true && activeSection === 'rollout') {
      setActiveSection('schedule');
    }
    if (!useScheduleDates && activeSection === 'assignees') {
      setActiveSection('owner');
    }
  }, [isRecurring, useScheduleDates, activeSection]);

  // When creating from Document Management, fetch document instance so title/description can be filled and edited
  const { data: fetchedDocument } = useQuery(
    ['documentInstance', documentId],
    () => documentInstanceService.getById(documentId!),
    { enabled: visible && !!documentId }
  );
  useEffect(() => {
    if (visible && fetchedDocument) {
      setTitle((prev) => (fetchedDocument.title?.trim() ? fetchedDocument.title : prev));
      setDescription((prev) => {
        const docDesc = [
          fetchedDocument.title && `Document: ${fetchedDocument.title}`,
          fetchedDocument.status && `Status: ${fetchedDocument.status}`,
        ].filter(Boolean).join('\n\n');
        return docDesc.trim() ? docDesc : prev;
      });
    }
  }, [visible, fetchedDocument]);

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
    { enabled: visible, staleTime: 5 * 60 * 1000 }
  );
  const allTitleServices = Array.isArray(taskServicesData) ? taskServicesData : [];

  // Fetch client-service matrix so we know which services each client has.
  // Use full matrix (recurring + one_time) so all enabled services for the
  // selected client appear in Task Title suggestions.
  const { data: clientMatrixData } = useQuery(
    'client-service-matrix-for-task-create',
    async () => {
      const res = await entityListService.matrix();
      return (res.data?.data || res.data || {}) as ServiceMatrixResponse;
    },
    { enabled: visible, staleTime: 5 * 60 * 1000 }
  );

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientInput, setClientInput] = useState<string>('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [clientHighlightedIndex, setClientHighlightedIndex] = useState(-1);
  const clientSuggestionsRef = useRef<HTMLDivElement>(null);

  const clientMatrixClients = clientMatrixData?.clients || [];

  // Keep text input in sync with the selected client
  React.useEffect(() => {
    const selected = clientMatrixClients.find((c) => c.id === selectedClientId);
    setClientInput(selected?.name || '');
  }, [selectedClientId, clientMatrixClients]);

  const clientSuggestions = useMemo(() => {
    const q = clientInput.trim().toLowerCase();
    if (!clientMatrixClients || clientMatrixClients.length === 0) return [];
    if (!q) {
      return clientMatrixClients.slice(0, 15);
    }
    return clientMatrixClients.filter((c) => (c.name || '').toLowerCase().includes(q)).slice(0, 15);
  }, [clientInput, clientMatrixClients]);

  const titleServicePool = useMemo(() => {
    if (selectedClientId && clientMatrixClients.length > 0) {
      const selected = clientMatrixClients.find((c) => c.id === selectedClientId);
      const serviceIds = selected ? Object.keys(selected.serviceFrequencies || {}) : [];
      if (serviceIds.length === 0) return allTitleServices;
      const ids = new Set(serviceIds);
      return allTitleServices.filter((s) => ids.has(s.id));
    }
    return allTitleServices;
  }, [selectedClientId, clientMatrixClients, allTitleServices]);

  const titleSuggestions = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (q) {
      return titleServicePool.filter((s) => (s.title || '').toLowerCase().includes(q));
    }
    return titleServicePool.slice(0, 15);
  }, [title, titleServicePool]);

  // Fetch users for assignee selection
  const { data: usersData } = useQuery(
    'allUsers',
    () => conversationService.getAllUsers(),
    { enabled: visible }
  );

  const allUsers = usersData || [];
  const currentOrgId = user?.organizationId || (user as any)?.organization_id;
  const displayUsers = React.useMemo(() => {
    const hasSearch = (assigneeSearchQuery || '').trim().length > 0;
    const q = assigneeSearchQuery.trim().toLowerCase();
    if (hasSearch) {
      return allUsers.filter(
        (u: any) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.mobile || u.phone || '').toString().toLowerCase().includes(q)
      );
    }
    if (currentOrgId) {
      const sameOrg = allUsers.filter(
        (u: any) => (u.organization_id || u.organizationId) === currentOrgId
      );
      return sameOrg.length > 0 ? sameOrg : allUsers;
    }
    return allUsers;
  }, [allUsers, assigneeSearchQuery, currentOrgId]);

  // Format date (date only, no time)
  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
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

  // Reset form (all dates default to 9:00 AM)
  const resetForm = () => {
    setIsRecurring(null);
    setTitle('');
    setDescription('');
    setTaskOwner('self');
    setTaskOwnerUserId(null);
    setFinancialValue('');
    setFinanceType('income');
    setSelectedAssignees([]);
    const today9am = new Date();
    today9am.setHours(9, 0, 0, 0);
    setStartDate(today9am);
    setTargetDate(new Date(today9am));
    const due30 = new Date();
    due30.setDate(due30.getDate() + 30);
    due30.setHours(9, 0, 0, 0);
    setDueDate(due30);
    setRecurrenceType('weekly');
    setTaskRolloutType('cycle_start');
    setUseScheduleDates(true);
    setAutoEscalate(false);
    setReportingMemberId(null);
    setActiveSection('title');
  };

  // Handle create task
  const handleCreateTask = async () => {
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    if (useScheduleDates && !dueDate) {
      toast.error('Please select a due date');
      return;
    }
    if (isRecurring === null) {
      toast.error('Please select what type of task this is');
      return;
    }
    if (!useScheduleDates && !(taskOwner === 'self' && selectedAssignees.length === 0)) {
      toast.error('No-dates mode is allowed only for creator-only tasks without assignees');
      return;
    }
    if (isRecurring === true && !useScheduleDates && taskRolloutType !== 'cycle_start') {
      toast.error('For recurring tasks without dates, rollout type must be Cycle Start');
      return;
    }

    setCreateTaskLoading(true);
    try {
      // Build description with document/compliance reference if exists (mobile behavior)
      let taskDescription = description.trim();
      if (documentId) {
        const docRef = `\n\n---\n📄 Related Document ID: ${documentId}`;
        taskDescription = taskDescription + docRef;
      } else if (complianceId) {
        const complianceRef = `\n\n---\n📋 Related Compliance ID: ${complianceId}`;
        taskDescription = taskDescription + complianceRef;
      }

      const parsedFinancialValue =
        financialValue.trim().length > 0 ? Number.parseFloat(financialValue) : null;

      // If no assignees selected, treat it as a self task (assign to current user)
      const currentUserId = (user as any)?.id || (user as any)?.userId || null;
      const fallbackAssignees =
        selectedAssignees.length > 0
          ? selectedAssignees
          : currentUserId
          ? [{ id: currentUserId, name: (user as any)?.name }]
          : [];

      const taskData: any = {
        title: title.trim(),
        description: taskDescription,
        client_name: clientInput.trim() || null,
        task_type: isRecurring === true ? 'recurring' : 'one_time',
        task_owner: taskOwner,
        financial_value: Number.isFinite(parsedFinancialValue as number) ? parsedFinancialValue : null,
        finance_type: financialValue.trim().length > 0 ? financeType : null,
        assignee_ids: useScheduleDates ? fallbackAssignees.map((a) => a.id) : [],
        start_date: useScheduleDates ? startDate.toISOString() : null,
        target_date: useScheduleDates ? targetDate.toISOString() : null,
        due_date: useScheduleDates ? dueDate.toISOString() : null,
        recurrence_type: isRecurring === true ? recurrenceType : null,
        recurrence_interval: 1,
        task_rollout_type: isRecurring === true ? taskRolloutType : undefined,
        auto_escalate: autoEscalate,
        recurrence_day_of_month:
          isRecurring === true && recurrenceType === 'monthly'
            ? Number(targetDate?.getDate?.() || new Date().getDate())
            : undefined,
        specific_weekday:
          isRecurring === true && recurrenceType === 'weekly' ? Number(targetDate?.getDay?.() ?? 1) : undefined,
        // Mobile stores documentId/complianceId in metadata (backend may ignore; kept for parity)
        metadata: {
          ...(documentId ? { documentId } : {}),
          ...(complianceId ? { complianceId } : {}),
          ...(taskOwner === 'contacts' && taskOwnerUserId ? { taskOwnerUserId } : {}),
        },
      };

      if (selectedClientId) {
        taskData.client_entity_id = selectedClientId;
      }

      // When task owner is another member, send creator_id so API sets them as owner and task is hidden from requester
      if (taskOwner === 'contacts' && taskOwnerUserId) {
        taskData.creator_id = taskOwnerUserId;
      }

      // Add compliance_id if provided (API supports compliance_id)
      if (complianceId) {
        taskData.compliance_id = complianceId;
      }

      // Link task to document when created from Document Management (backend supports document_instance_id)
      if (documentId) {
        taskData.document_instance_id = documentId;
      }

      // Add reporting_member_id if selected
      if (reportingMemberId) {
        taskData.reporting_member_id = reportingMemberId;
      }

      const created = await taskService.createTask(taskData);
      const createdObj: any = created && typeof created === 'object' ? created : null;
      const taskId = createdObj?.id || null;
      const conversationId = createdObj?.conversation_id || createdObj?.conversationId || null;

      // If task was created from a document (chat or Document Management), auto-attach that document to the task conversation.
      let attachmentToSend: { mediaUrl: string; fileName?: string; fileSize?: number; mimeType?: string } | null = documentAttachment?.mediaUrl ? documentAttachment : null;
      if (!attachmentToSend && documentId && conversationId) {
        try {
          const instance = await documentInstanceService.getById(documentId);
          if (instance?.pdfUrl) {
            attachmentToSend = {
              mediaUrl: instance.pdfUrl,
              fileName: `${(instance.title || 'document').replace(/[^a-zA-Z0-9-_.]/g, '_')}.pdf`,
              mimeType: 'application/pdf',
            };
          }
        } catch (_) {}
      }
      if (attachmentToSend?.mediaUrl && conversationId) {
        try {
          const sock = await waitForSocketConnection();
          sock.emit('send_message', {
            conversationId,
            messageType: 'document',
            mediaUrl: attachmentToSend.mediaUrl,
            fileName: attachmentToSend.fileName,
            fileSize: attachmentToSend.fileSize,
            mimeType: attachmentToSend.mimeType,
            content: '',
          });
        } catch (e) {
          // Don't block task creation if socket send fails.
        }
      }
      if (taskId && (taskData.financial_value != null || taskData.finance_type)) {
        setTaskFinancial(taskId, {
          financial_value: taskData.financial_value ?? null,
          finance_type: taskData.finance_type ?? null,
        });
      }
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Create task error:', error);
      toast.error(error.response?.data?.error || 'Failed to create task');
    } finally {
      setCreateTaskLoading(false);
    }
  };

  const titleReply = title.trim() || 'Not answered';
  const clientReply = clientInput.trim() || 'Skipped';
  const assigneesReply = selectedAssignees.length > 0 ? `${selectedAssignees.length} selected` : 'Skipped';
  const recurrenceReply =
    isRecurring === true ? `Recurring (${recurrenceType})` : isRecurring === false ? 'One-time' : 'Not selected';
  const rolloutReply = taskRolloutType === 'cycle_start' ? 'Cycle Start' : 'Start Date';
  const scheduleReply = useScheduleDates
    ? `Start ${startDate.toLocaleDateString()}, Target ${targetDate.toLocaleDateString()}, Due ${dueDate.toLocaleDateString()}`
    : 'No Dates';
  const ownerReply = taskOwner === 'self' ? 'Self' : taskOwnerUserId ? 'Contact selected' : 'Contacts';
  const escalationReply = autoEscalate ? 'Yes' : 'No';
  const financeReply = financialValue.trim() ? `${financialValue} (${financeType})` : 'Skipped';

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={handleClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] mx-auto flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-primary dark:bg-primary/90 rounded-t-2xl shrink-0">
          <h2 className="text-white text-base sm:text-lg font-bold">Create Task</h2>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col space-y-4 overflow-y-auto bg-[#F9FAFB] p-4 sm:space-y-5 sm:p-6">
          <div className="w-full sm:w-[92%] self-start text-[13px] font-semibold text-[#6B7280]">
            Hi! I will help you create a task. Please answer one field at a time.
          </div>

          {/* 1. Task Title - with service list suggestions (Google-like) */}
          <div className="flex flex-col gap-2">
            {renderQuestionToggle('title', 'What is the name of the task?', true)}
            {activeSection === 'title' && (
              <div className={`relative ${bubbleRightClass}`} ref={titleSuggestionsRef}>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setShowTitleSuggestions(true);
                    setTitleHighlightedIndex(-1);
                    if (e.target.value.trim()) {
                      setActiveSection('client');
                    }
                  }}
                  onFocus={() => !initialTitle && setShowTitleSuggestions(true)}
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
                    } else if (e.key === 'Enter' && title.trim()) {
                      goToNextSection('title');
                    }
                  }}
                  placeholder="Type or select from service list (e.g. GSTR 1, GSTR 9…)"
                  readOnly={!!initialTitle}
                  className={`${inputClass} min-h-[44px] transition-colors ${
                    showTitleSuggestions && titleSuggestions.length > 0
                      ? 'border-primary/40 shadow-md'
                      : ''
                  } ${initialTitle ? 'cursor-not-allowed bg-gray-100' : ''}`}
                />
                {!initialTitle && showTitleSuggestions && titleSuggestions.length > 0 && (
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
            )}
            {shouldShowReply('title') && renderReplyBubble(titleReply, () => setActiveSection('title'))}
          </div>

          {/* 2. Client Name */}
          <div className="flex flex-col gap-2">
            {renderQuestionToggle('client', 'Which client is this task for?', canOpenClient)}
            {activeSection === 'client' && canOpenClient && (
              <div className={`relative ${bubbleRightClass}`} ref={clientSuggestionsRef}>
                <input
                  type="text"
                  value={clientInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setClientInput(value);
                    setShowClientSuggestions(true);
                    setClientHighlightedIndex(-1);
                    const match = clientMatrixClients.find(
                      (c) => c.name?.toLowerCase() === value.trim().toLowerCase()
                    );
                    setSelectedClientId(match?.id || '');
                  }}
                  onFocus={() => setShowClientSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)}
                  onKeyDown={(e) => {
                    if (!showClientSuggestions || clientSuggestions.length === 0) {
                      if (e.key === 'Escape') setShowClientSuggestions(false);
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setClientHighlightedIndex((i) =>
                        i < clientSuggestions.length - 1 ? i + 1 : 0
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setClientHighlightedIndex((i) =>
                        i > 0 ? i - 1 : clientSuggestions.length - 1
                      );
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const item =
                        clientSuggestions[clientHighlightedIndex >= 0 ? clientHighlightedIndex : 0];
                      if (item?.id) {
                        setSelectedClientId(item.id);
                        setClientInput(item.name || '');
                        setShowClientSuggestions(false);
                        setClientHighlightedIndex(-1);
                      goToNextSection('client');
                      }
                    } else if (e.key === 'Escape') {
                      setShowClientSuggestions(false);
                      setClientHighlightedIndex(-1);
                    }
                  }}
                  placeholder="Type client name (optional)"
                  className={`${inputClass} min-h-[44px]`}
                />
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1">
                    {clientSuggestions.map((client, index) => (
                      <button
                        key={client.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setClientInput(client.name || '');
                          setShowClientSuggestions(false);
                          setClientHighlightedIndex(-1);
                          goToNextSection('client');
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                          index === clientHighlightedIndex
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <span className="material-icons-outlined text-lg text-gray-400 dark:text-gray-500 shrink-0">
                          business
                        </span>
                        <span className="font-medium truncate">{client.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToNextSection('client')}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#6B7280]"
                  >
                    Skip
                  </button>
                </div>
              </div>
            )}
            {shouldShowReply('client') && renderReplyBubble(clientReply, () => setActiveSection('client'))}
          </div>

          {/* 3. Assigned To */}
          {useScheduleDates && (
            <div className="flex flex-col gap-2">
              {renderQuestionToggle('assignees', 'Who should this task be assigned to?', canOpenAssignees)}
              {activeSection === 'assignees' && canOpenAssignees && (
              <div className={bubbleRightClass}>
                <button
                  onClick={() => setShowAssigneeModal(true)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-left transition-colors hover:bg-[#F3F4F6]"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">people</span>
                    <span className="text-[#1F2937]">
                      {selectedAssignees.length > 0
                        ? `${selectedAssignees.length} selected`
                        : 'Select employee or team'}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-gray-400">expand_more</span>
                </button>
              </div>
              )}
              {shouldShowReply('assignees') && renderReplyBubble(assigneesReply, () => setActiveSection('assignees'))}
            </div>
          )}

          {/* Reporting Member Selection - Only show after assignees are selected */}
          {useScheduleDates && activeSection === 'assignees' && selectedAssignees.length > 0 && (
            <div className={bubbleRightClass}>
              <div className={sectionQuestionClass}>Who should be the reporting member? (optional)</div>
              <p className="mb-3 text-xs text-[#6B7280]">
                Select a member who will verify other members' task completions. If not selected, verification requests will go to the task creator.
              </p>
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setReportingMemberId(null);
                    goToNextSection('assignees');
                  }}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#6B7280]"
                >
                  Skip
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {selectedAssignees.map((assignee) => {
                  const isSelected = reportingMemberId === assignee.id;
                  return (
                    <button
                      key={assignee.id}
                      onClick={() => {
                        setReportingMemberId(isSelected ? null : assignee.id);
                        goToNextSection('assignees');
                      }}
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

          {/* 4. Recurrence */}
          <div className="flex flex-col gap-2">
            {renderQuestionToggle('recurrence', 'What type of task is this?', canOpenRecurrence)}
            {activeSection === 'recurrence' && canOpenRecurrence && (
              <div className={bubbleRightClass}>
              <div className="flex gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="recurrence"
                  value="one_time"
                  checked={isRecurring === false}
                  onChange={() => {
                    setIsRecurring(false);
                    goToNextSection('recurrence');
                  }}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <span>One-time</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="recurrence"
                  value="recurring"
                  checked={isRecurring === true}
                  onChange={() => {
                    setIsRecurring(true);
                    goToNextSection('recurrence');
                  }}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                />
                <span>Recurring</span>
              </label>
              </div>
              </div>
            )}
            {shouldShowReply('recurrence') && renderReplyBubble(recurrenceReply, () => setActiveSection('recurrence'))}

            {/* Recurrence Options (only visible when Recurring is selected) */}
            {activeSection === 'recurrence' && isRecurring === true && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Recurrence Frequency
                </label>
                <div className="flex gap-2">
                  {(['weekly', 'monthly', 'quarterly', 'annually'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setRecurrenceType(type)}
                      className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                        recurrenceType === type
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. Rollout Type (recurring only) */}
          {isRecurring === true && (
            <div className="flex flex-col gap-2">
              {renderQuestionToggle('rollout', 'How should this task be rolled out?', canOpenRollout)}
              {activeSection === 'rollout' && canOpenRollout && (
                <div className={bubbleRightClass}>
                  <div className="flex gap-2">
                    {[{ key: 'cycle_start', label: 'Cycle Start' }, { key: 'start_date', label: 'Start Date' }].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setTaskRolloutType(item.key as 'cycle_start' | 'start_date');
                          goToNextSection('rollout');
                        }}
                        className={`flex-1 rounded-xl py-2.5 px-4 font-medium transition-colors ${
                          taskRolloutType === item.key
                            ? segmentedActiveClass
                            : segmentedInactiveClass
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {shouldShowReply('rollout') && renderReplyBubble(rolloutReply, () => setActiveSection('rollout'))}
            </div>
          )}

          {/* 6. SCHEDULE */}
          <div className="flex flex-col gap-2">
            {renderQuestionToggle('schedule', 'What are the start, target, and due dates?', canOpenSchedule)}
            {activeSection === 'schedule' && canOpenSchedule && (
              <div className={bubbleRightClass}>
              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => setUseScheduleDates(true)}
                  className={`flex-1 rounded-xl py-2.5 px-4 font-medium transition-colors ${
                    useScheduleDates ? segmentedActiveClass : segmentedInactiveClass
                  }`}
                >
                  With Dates
                </button>
                <button
                  onClick={() => {
                    // Mobile parity: selecting no-dates enforces creator-only mode.
                    setUseScheduleDates(false);
                    setSelectedAssignees([]);
                    setReportingMemberId(null);
                    setTaskOwner('self');
                    setTaskOwnerUserId(null);
                    if (isRecurring === true) {
                      setTaskRolloutType('cycle_start');
                    }
                  }}
                  className={`flex-1 rounded-xl py-2.5 px-4 font-medium transition-colors ${
                    !useScheduleDates ? segmentedActiveClass : segmentedInactiveClass
                  }`}
                >
                  No Dates
                </button>
              </div>
              {!useScheduleDates && (
                <p className="mb-2 text-xs text-[#6B7280]">
                  No-dates mode is creator-only. Assignees are cleared and owner is set to self.
                  {isRecurring === true ? ' For recurring tasks, choose Cycle Start rollout.' : ''}
                </p>
              )}
              {useScheduleDates && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Start Date */}
              <div className="flex flex-col">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <button
                  onClick={() => setShowStartPicker(true)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300 text-sm">{formatDate(startDate)}</span>
                  <span className="material-symbols-outlined text-gray-400 text-base">calendar_today</span>
                </button>
              </div>

              {/* Target Date */}
              <div className="flex flex-col">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target Date
                </label>
                <button
                  onClick={() => setShowTargetPicker(true)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300 text-sm">{formatDate(targetDate)}</span>
                  <span className="material-symbols-outlined text-gray-400 text-base">calendar_today</span>
                </button>
              </div>

              {/* Due Date */}
              <div className="flex flex-col">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">event</span>
                  <span>Due Date</span>
                </label>
                <button
                  onClick={() => setShowDuePicker(true)}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-primary/50 dark:border-primary/50 bg-primary/5 dark:bg-primary/10 text-left flex items-center justify-between hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
                >
                  <span className="text-gray-900 dark:text-white font-medium text-sm">{formatDate(dueDate)}</span>
                  <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
                </button>
              </div>
              </div>
              )}
              </div>
            )}
            {shouldShowReply('schedule') && renderReplyBubble(scheduleReply, () => setActiveSection('schedule'))}
          </div>

          {/* 7. Task Owner */}
          <div className="flex flex-col gap-2">
            {renderQuestionToggle('owner', 'Who is the task owner?', canOpenOwner)}
            {activeSection === 'owner' && canOpenOwner && (
              <div className={bubbleRightClass}>
              <div className="flex gap-2">
              {(['self', 'contacts'] as const).map((owner) => (
                <button
                  key={owner}
                  onClick={() => {
                    if (!useScheduleDates && owner === 'contacts') return;
                    setTaskOwner(owner);
                    if (owner !== 'contacts') setTaskOwnerUserId(null);
                    if (owner === 'self') goToNextSection('owner');
                  }}
                  className={`flex-1 rounded-xl py-2.5 px-4 font-medium transition-colors ${
                    taskOwner === owner
                      ? segmentedActiveClass
                      : segmentedInactiveClass
                  } ${!useScheduleDates && owner === 'contacts' ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {owner === 'self' ? 'Self' : 'Contacts'}
                </button>
              ))}
              </div>
              {!useScheduleDates && (
                <p className="mt-2 text-xs text-[#6B7280]">Contacts owner is disabled in no-dates mode.</p>
              )}
              </div>
            )}
            {shouldShowReply('owner') && renderReplyBubble(ownerReply, () => setActiveSection('owner'))}
          </div>

          {/* Task Owner Member (only when task owner = contacts) */}
          {activeSection === 'owner' && taskOwner === 'contacts' && selectedAssignees.length > 0 && (
            <div className={bubbleRightClass}>
              <div className={sectionQuestionClass}>Select task owner contact</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Choose which selected member should be considered the owner.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {selectedAssignees.map((assignee) => {
                  const isSelected = taskOwnerUserId === assignee.id;
                  return (
                    <button
                      key={assignee.id}
                      onClick={() => {
                        const next = isSelected ? null : assignee.id;
                        setTaskOwnerUserId(next);
                        if (next) goToNextSection('owner');
                      }}
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

          {/* 8. Auto Escalate */}
          <div className="flex flex-col gap-2">
            {renderQuestionToggle('escalation', 'Enable auto escalation?', canOpenEscalation)}
            {activeSection === 'escalation' && canOpenEscalation && (
              <div className={bubbleRightClass}>
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToNextSection('escalation')}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#6B7280]"
                  >
                    Skip
                  </button>
                </div>
                <div className="flex gap-2">
                  {[{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setAutoEscalate(item.key === 'yes');
                        goToNextSection('escalation');
                      }}
                      className={`flex-1 rounded-xl py-2.5 px-4 font-medium transition-colors ${
                        (autoEscalate && item.key === 'yes') || (!autoEscalate && item.key === 'no')
                          ? segmentedActiveClass
                          : segmentedInactiveClass
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {shouldShowReply('escalation') && renderReplyBubble(escalationReply, () => setActiveSection('escalation'))}
          </div>

          {/* 9. Financial Value (Optional) */}
          <div className="flex flex-col gap-2">
            {renderQuestionToggle('finance', 'Do you want to add a financial value? (optional)', canOpenFinance)}
            {activeSection === 'finance' && canOpenFinance && (
              <div className={bubbleRightClass}>
              <input
              type="text"
              inputMode="decimal"
              value={financialValue}
              onChange={(e) => setFinancialValue(e.target.value)}
              placeholder="Enter amount"
              className={inputClass}
            />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setFinancialValue('')}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#6B7280]"
                >
                  Skip
                </button>
              </div>
              </div>
            )}
            {shouldShowReply('finance') && renderReplyBubble(financeReply, () => setActiveSection('finance'))}
          </div>

          {/* Finance Type (only show if financial value entered) */}
          {activeSection === 'finance' && financialValue.trim().length > 0 && (
            <div className={`${bubbleRightClass} animate-in fade-in slide-in-from-top-2 duration-200`}>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Type of Finance
              </label>
              <div className="flex gap-2">
                {(['income', 'expense'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFinanceType(type)}
                  className={`flex-1 rounded-xl py-2.5 px-4 font-medium transition-colors ${
                      financeType === type
                      ? segmentedActiveClass
                      : segmentedInactiveClass
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={handleCreateTask}
            disabled={createTaskLoading}
            className="w-full py-3 px-4 rounded-lg bg-primary text-white text-sm sm:text-base font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {createTaskLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">check</span>
                <span>Create Task</span>
              </>
            )}
          </button>
        </div>

        {/* Assignee Selection Modal - Centered in middle of screen */}
        {showAssigneeModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAssigneeModal(false)}>
            <div 
              className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Select Assignees</h3>
                <button
                  onClick={() => setShowAssigneeModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close modal"
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
                        className={`w-full flex items-center gap-3 p-3 rounded-lg mb-2 transition-colors min-h-[44px] ${
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
              <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 shrink-0">
                <button
                  onClick={() => setShowAssigneeModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-sm sm:text-base text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowAssigneeModal(false);
                    goToNextSection('assignees');
                  }}
                  className="flex-1 px-4 py-3 bg-primary text-white text-sm sm:text-base rounded-lg hover:bg-primary/90 transition-colors font-semibold flex items-center justify-center gap-2 min-h-[44px]"
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
            hideTimePicker
          />
        )}

        {showTargetPicker && (
          <CustomDatePicker
            value={targetDate}
            onChange={setTargetDate}
            onClose={() => setShowTargetPicker(false)}
            title="Target Date"
            hideTimePicker
          />
        )}

        {showDuePicker && (
          <CustomDatePicker
            value={dueDate}
            onChange={setDueDate}
            onClose={() => setShowDuePicker(false)}
            title="Due Date"
            hideTimePicker
          />
        )}
      </div>
    </div>
  );
};

