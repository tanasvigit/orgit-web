import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import {
  getTaskCreationUserConfig,
  taskCreationUserConfigQueryKey,
} from '../../services/userTaskCreationConfigService';
import {
  computeTaskTimelineFromStart,
  FALLBACK_TASK_CREATION_USER_CONFIG,
} from '../../utils/taskCreationUserConfig';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { conversationService } from '../../services/conversationService';
import { taskService } from '../../services/taskService';
import { documentInstanceService } from '../../services/documentInstanceService';
import { masterDataService } from '../../services/masterDataService';
import { entityListService } from '../../services/entityListService';
import { waitForSocketConnection } from '../../services/socketService';
import { setTaskFinancial } from '../../utils/taskFinancialStorage';
import { CustomDatePicker } from '../shared/CustomDatePicker';
import api from '../../services/api';
import { formatOrgUnitLabel } from '../../utils/orgUnitLabel';

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

type UserLike = {
  id: string;
  name: string;
  mobile?: string;
  phone?: string;
  organization_id?: string;
  organizationId?: string;
};

type TaskUnitSection = {
  key: string;
  label: string;
  units: string[];
};

const introMessageClass =
  'w-fit max-w-full rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2 text-sm font-medium text-[#1F2937]';
const requiredLabelClass = 'mb-0.5 block text-xs font-medium text-[#6B7280]';
const inputClass =
  'min-h-[42px] w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/40';
const sectionClass = 'space-y-2 rounded-xl border border-[#E5E7EB] bg-white p-3';
const sectionRowClass = 'flex items-start gap-3';
const sectionQuestionClass = 'flex w-72 shrink-0 items-center justify-between gap-3 pt-2';
const sectionContentClass = 'min-w-0 flex-1';
const optionBaseClass =
  'rounded-lg border px-2 py-1 text-xs font-medium transition-colors border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]';
const optionActiveClass = 'border-primary bg-primary text-white hover:bg-primary';

type ComboboxKeyDownParams = {
  event: React.KeyboardEvent<HTMLInputElement>;
  showSuggestions: boolean;
  suggestionsLength: number;
  highlightedIndex: number;
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowSuggestions: (show: boolean) => void;
  onSelect: (index: number) => void;
  onEnterWithoutSuggestions?: () => void;
};

const handleComboboxKeyDown = ({
  event,
  showSuggestions,
  suggestionsLength,
  highlightedIndex,
  setHighlightedIndex,
  setShowSuggestions,
  onSelect,
  onEnterWithoutSuggestions,
}: ComboboxKeyDownParams) => {
  const { key } = event;

  if (key === 'Tab') {
    if (showSuggestions) {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
    return;
  }

  if (!showSuggestions || suggestionsLength === 0) {
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (suggestionsLength === 0) return;
      event.preventDefault();
      setShowSuggestions(true);
      setHighlightedIndex(key === 'ArrowDown' ? 0 : suggestionsLength - 1);
    } else if (key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    } else if (key === 'Enter' && onEnterWithoutSuggestions) {
      event.preventDefault();
      onEnterWithoutSuggestions();
    }
    return;
  }

  if (key === 'ArrowDown') {
    event.preventDefault();
    setHighlightedIndex((index) => (index < suggestionsLength - 1 ? index + 1 : 0));
  } else if (key === 'ArrowUp') {
    event.preventDefault();
    setHighlightedIndex((index) => (index > 0 ? index - 1 : suggestionsLength - 1));
  } else if (key === 'Enter') {
    event.preventDefault();
    onSelect(highlightedIndex >= 0 ? highlightedIndex : 0);
  } else if (key === 'Escape') {
    event.preventDefault();
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }
};

const suggestionOptionClass = (isHighlighted: boolean) =>
  `w-full border-b border-[#F3F4F6] px-3 py-2 text-left text-sm text-[#1F2937] hover:bg-[#F9FAFB] ${
    isHighlighted ? 'bg-primary/10 text-primary' : ''
  }`;

const YesNoToggle: React.FC<{
  value: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}> = ({ value, onChange, ariaLabel }) => {
  const baseSegment =
    'inline-flex min-h-[34px] min-w-[54px] items-center justify-center px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40';
  const activeSegment = 'bg-primary text-white';
  const inactiveSegment = 'bg-transparent text-[#6B7280] hover:bg-[#EEF2FF]';
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 overflow-hidden rounded-full border border-[#E5E7EB] bg-white"
    >
      <button
        type="button"
        aria-pressed={value === true}
        onClick={() => onChange(true)}
        className={`${baseSegment} ${value ? activeSegment : inactiveSegment}`}
      >
        Yes
      </button>
      <button
        type="button"
        aria-pressed={value === false}
        onClick={() => onChange(false)}
        className={`${baseSegment} ${!value ? activeSegment : inactiveSegment}`}
      >
        No
      </button>
    </div>
  );
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(9, 0, 0, 0);
  return next;
};

const normalizeUser = (u: any): UserLike => ({
  id: u?.id || u?.userId || '',
  name: u?.name || 'Unknown',
  mobile: u?.mobile,
  phone: u?.phone,
  organization_id: u?.organization_id ?? u?.organizationId,
  organizationId: u?.organizationId ?? u?.organization_id,
});

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
  const { toast } = useToast();
  const { user } = useAuth();

  const currentUserId = String((user as any)?.id || (user as any)?.userId || '');
  const currentUserName = String((user as any)?.name || 'Self');
  const baseDate = useMemo(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  }, []);

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [tagInput, setTagInput] = useState('');
  const [taskUnit, setTaskUnit] = useState('');
  const [selectedOrgStructureNodeId, setSelectedOrgStructureNodeId] = useState<string | null>(null);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showTaskUnitSuggestions, setShowTaskUnitSuggestions] = useState(false);
  const [titleHighlightedIndex, setTitleHighlightedIndex] = useState(-1);
  const [tagHighlightedIndex, setTagHighlightedIndex] = useState(-1);
  const [taskUnitHighlightedIndex, setTaskUnitHighlightedIndex] = useState(-1);
  const [basicInfoConfirmed, setBasicInfoConfirmed] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [taskFrequency, setTaskFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('weekly');
  const [taskEnds, setTaskEnds] = useState<'never' | 'specific_date' | 'after_occurrences'>('never');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(addDays(baseDate, 30));
  const [occurrenceCount, setOccurrenceCount] = useState('10');
  const [showRecurrenceEndPicker, setShowRecurrenceEndPicker] = useState(false);

  const [setTimelines, setSetTimelines] = useState(false);
  const [startDate, setStartDate] = useState(baseDate);
  const [targetDate, setTargetDate] = useState(addDays(baseDate, 7));
  const [dueDate, setDueDate] = useState(initialDueDate ? new Date(initialDueDate) : addDays(baseDate, 10));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);

  const [assignPeople, setAssignPeople] = useState(true);
  const [taskOwnerId, setTaskOwnerId] = useState<string>(currentUserId);
  const [selectedAssignees, setSelectedAssignees] = useState<UserLike[]>([]);
  const [autoEscalation, setAutoEscalation] = useState(false);
  const [escalationTrigger, setEscalationTrigger] = useState<'target_date' | 'due_date'>('target_date');
  const [escalationTiming, setEscalationTiming] = useState('1');
  const [escalationContacts, setEscalationContacts] = useState<UserLike[]>([]);

  const [addFinancialValue, setAddFinancialValue] = useState(false);
  const [financialValue, setFinancialValue] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'owner' | 'assignees' | 'escalation'>('assignees');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [createTaskLoading, setCreateTaskLoading] = useState(false);

  const { data: tcUserConfig } = useQuery(
    taskCreationUserConfigQueryKey,
    getTaskCreationUserConfig,
    {
      staleTime: 5 * 60 * 1000,
      enabled: visible,
      initialData: FALLBACK_TASK_CREATION_USER_CONFIG,
      retry: 1,
    }
  );

  const { data: usersData } = useQuery('task-create-users-redesign', () => conversationService.getAllUsers(), {
    enabled: visible,
  });
  const { data: serviceData } = useQuery(
    'task-create-org-services',
    async () => {
      const [recurring, oneTime] = await Promise.all([
        masterDataService.getTaskServices('recurring'),
        masterDataService.getTaskServices('one_time'),
      ]);
      const recurringList = recurring.data?.data ?? recurring.data ?? [];
      const oneTimeList = oneTime.data?.data ?? oneTime.data ?? [];
      const byId = new Map<string, any>();
      [...recurringList, ...oneTimeList].forEach((s: any) => {
        if (s?.id && !byId.has(s.id)) byId.set(s.id, s);
      });
      return Array.from(byId.values());
    },
    { enabled: visible }
  );
  const { data: clientMatrixData } = useQuery(
    'task-create-client-names',
    async () => {
      const res = await entityListService.matrix();
      return (res.data?.data || res.data || {}).clients || [];
    },
    { enabled: visible }
  );
  const { data: orgDataForTaskUnit } = useQuery(
    'task-create-org-data-for-unit',
    async () => {
      const res = await api.get('/organization/data');
      return res.data?.data ?? res.data ?? {};
    },
    { enabled: visible }
  );

  const currentOrgId = String((user as any)?.organizationId || (user as any)?.organization_id || '');
  const users = useMemo(() => {
    const normalized = (usersData || []).map(normalizeUser).filter((u) => !!u.id);
    if (!currentOrgId) return normalized;
    return normalized.filter((u: any) => String(u?.organization_id || u?.organizationId || '') === currentOrgId);
  }, [usersData, currentOrgId]);
  const services = useMemo(() => (Array.isArray(serviceData) ? serviceData : []), [serviceData]);
  const clients = useMemo(() => (Array.isArray(clientMatrixData) ? clientMatrixData : []), [clientMatrixData]);
  const taskUnitSections = useMemo<TaskUnitSection[]>(() => {
    const org = orgDataForTaskUnit || {};
    const sections: TaskUnitSection[] = [
      {
        key: 'org_unit',
        label: 'Org Structure',
        units: (Array.isArray(org.orgStructureOperationalOptions?.nodes)
          ? org.orgStructureOperationalOptions.nodes
          : []
        )
          .map((node: any) => formatOrgUnitLabel(node))
          .filter(Boolean),
      },
    ];
    return sections.filter((section) => section.units.length > 0);
  }, [orgDataForTaskUnit]);
  const taskUnitOrgUnitIdMap = useMemo(() => {
    const org = orgDataForTaskUnit || {};
    const map = new Map<string, string>();
    const orgNodes = Array.isArray(org.orgStructureOperationalOptions?.nodes)
      ? org.orgStructureOperationalOptions.nodes
      : [];
    orgNodes.forEach((node: any) => {
      const label = formatOrgUnitLabel(node);
      if (label && node?.id) {
        map.set(label, String(node.id));
      }
    });
    return map;
  }, [orgDataForTaskUnit]);
  const taskUnitOptions = useMemo(
    () =>
      Array.from(
        new Set(
          taskUnitSections
            .flatMap((section) => section.units)
            .map((unit) => String(unit || '').trim())
            .filter(Boolean)
        )
      ),
    [taskUnitSections]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || `${u.mobile || u.phone || ''}`.includes(q));
  }, [users, userSearchQuery]);

  const ownerLabel = useMemo(() => {
    if (!taskOwnerId) return 'Select task owner';
    if (taskOwnerId === currentUserId) return currentUserName;
    return users.find((u) => String(u.id) === String(taskOwnerId))?.name || 'Select task owner';
  }, [taskOwnerId, users, currentUserId, currentUserName]);

  const resetForm = () => {
    const cfg = tcUserConfig ?? FALLBACK_TASK_CREATION_USER_CONFIG;
    const now = new Date();
    now.setHours(9, 0, 0, 0);

    let startD = new Date(now);
    let targetD: Date;
    let dueD: Date;

    if (initialDueDate) {
      dueD = new Date(initialDueDate);
      dueD.setHours(9, 0, 0, 0);
      targetD = new Date(dueD);
      targetD.setDate(targetD.getDate() - cfg.targetDaysBeforeDue);
      targetD.setHours(9, 0, 0, 0);
      if (targetD < startD) targetD = new Date(startD);
    } else {
      const t = computeTaskTimelineFromStart(now, cfg);
      startD = t.start;
      targetD = t.target;
      dueD = t.due;
    }

    setTitle(initialTitle || '');
    setDescription(initialDescription || '');
    setTagInput('');
    setTaskUnit('');
    setSelectedOrgStructureNodeId(null);
    setShowTitleSuggestions(false);
    setShowTagSuggestions(false);
    setShowTaskUnitSuggestions(false);
    setTitleHighlightedIndex(-1);
    setTagHighlightedIndex(-1);
    setTaskUnitHighlightedIndex(-1);
    setBasicInfoConfirmed(false);
    setIsRecurring(false);
    setTaskFrequency('weekly');
    setTaskEnds('never');
    setRecurrenceEndDate(addDays(now, 30));
    setOccurrenceCount('10');
    setSetTimelines(false);
    setStartDate(startD);
    setTargetDate(targetD);
    setDueDate(dueD);
    setAssignPeople(false);
    setTaskOwnerId(currentUserId);
    setSelectedAssignees([]);
    setAutoEscalation(false);
    setEscalationTrigger(cfg.autoEscalateTrigger);
    setEscalationTiming('1');
    setEscalationContacts([]);
    setAddFinancialValue(false);
    setFinancialValue('');
    setUserSearchQuery('');
  };

  useEffect(() => {
    if (visible) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialTitle, initialDescription, initialDueDate, currentUserId, tcUserConfig]);

  useEffect(() => {
    const loadDocument = async () => {
      if (!visible || !documentId) return;
      try {
        const doc = await documentInstanceService.getById(documentId);
        if (doc?.title && !initialTitle) setTitle(doc.title);
        if (doc?.title && !initialDescription) setDescription(`Document: ${doc.title}`);
      } catch {
        // Keep silent to avoid blocking form.
      }
    };
    loadDocument();
  }, [visible, documentId, initialTitle, initialDescription]);

  const applyClientName = (clientName?: string) => {
    const nextClientName = (clientName || tagInput).trim();
    setTagInput(nextClientName);
    setShowTagSuggestions(false);
    setTagHighlightedIndex(-1);
    setBasicInfoConfirmed(false);
  };

  const applyTaskUnitName = (unitName?: string) => {
    const nextTaskUnit = (unitName || taskUnit).trim();
    setTaskUnit(nextTaskUnit);
    setSelectedOrgStructureNodeId(taskUnitOrgUnitIdMap.get(nextTaskUnit) || null);
    setShowTaskUnitSuggestions(false);
    setTaskUnitHighlightedIndex(-1);
    setBasicInfoConfirmed(false);
  };

  const openUserModal = (mode: 'owner' | 'assignees' | 'escalation') => {
    setUserModalMode(mode);
    setUserSearchQuery('');
    setShowUserModal(true);
  };

  const toggleMultiUser = (
    item: UserLike,
    selectedList: UserLike[],
    setter: React.Dispatch<React.SetStateAction<UserLike[]>>
  ) => {
    const exists = selectedList.some((u) => String(u.id) === String(item.id));
    if (exists) {
      setter((prev) => prev.filter((u) => String(u.id) !== String(item.id)));
    } else {
      setter((prev) => [...prev, item]);
    }
  };

  const validate = () => {
    if (!title.trim()) {
      toast.error('Task Title is required');
      return false;
    }
    if (!basicInfoConfirmed) {
      toast.error('Please confirm Basic Info using the tick mark');
      return false;
    }
    if (isRecurring && taskEnds === 'after_occurrences' && (!occurrenceCount || Number.parseInt(occurrenceCount, 10) <= 0)) {
      toast.error('Please enter valid occurrences count');
      return false;
    }
    if (assignPeople && !taskOwnerId) {
      toast.error('Please select a task owner');
      return false;
    }
    if (addFinancialValue && (!financialValue || Number.parseFloat(financialValue) <= 0)) {
      toast.error('Please enter valid financial value');
      return false;
    }
    return true;
  };

  const confirmBasicInfo = () => {
    if (!title.trim()) {
      toast.error('Task Title is required');
      return;
    }
    setBasicInfoConfirmed(true);
  };

  const titleSuggestions = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (!q) return services.slice(0, 8);
    return services.filter((s: any) => (s.title || '').toLowerCase().includes(q)).slice(0, 8);
  }, [services, title]);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c: any) => (c.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [clients, tagInput]);

  const taskUnitSuggestions = useMemo(() => {
    const q = taskUnit.trim().toLowerCase();
    if (!q) return taskUnitOptions.slice(0, 8);
    return taskUnitOptions.filter((unit) => unit.toLowerCase().includes(q)).slice(0, 8);
  }, [taskUnitOptions, taskUnit]);

  const handleCreateTask = async () => {
    if (!validate()) return;

    setCreateTaskLoading(true);
    try {
      const recurrenceType = isRecurring ? (taskFrequency === 'custom' ? 'weekly' : taskFrequency) : null;
      let taskDescription = description.trim();
      if (documentId) {
        taskDescription = `${taskDescription}\n\n---\n📄 Related Document ID: ${documentId}`.trim();
      } else if (complianceId) {
        taskDescription = `${taskDescription}\n\n---\n📋 Related Compliance ID: ${complianceId}`.trim();
      }

      const taskData: any = {
        title: title.trim(),
        description: taskDescription || null,
        task_type: isRecurring ? 'recurring' : 'one_time',
        recurrence_type: recurrenceType,
        task_rollout_type: isRecurring ? 'cycle_start' : undefined,
        recurrence_end_type: isRecurring ? taskEnds : null,
        recurrence_end_date: isRecurring && taskEnds === 'specific_date' ? recurrenceEndDate.toISOString() : null,
        recurrence_after_occurrences:
          isRecurring && taskEnds === 'after_occurrences'
            ? Number.parseInt(occurrenceCount || '0', 10) || null
            : null,
        start_date: setTimelines ? startDate.toISOString() : null,
        target_date: setTimelines ? targetDate.toISOString() : null,
        due_date: setTimelines ? dueDate.toISOString() : null,
        assignee_ids: assignPeople ? selectedAssignees.map((u) => u.id) : [],
        creator_id: assignPeople ? taskOwnerId : currentUserId,
        task_owner: 'self',
        auto_escalate: autoEscalation,
        escalation_trigger: autoEscalation ? escalationTrigger : null,
        escalation_days_before: autoEscalation
          ? Number.parseInt(escalationTiming || '0', 10) || 0
          : null,
        escalation_contact_ids: autoEscalation ? escalationContacts.map((u) => u.id) : [],
        financial_value: addFinancialValue ? Number.parseFloat(financialValue || '0') || null : null,
        org_structure_node_id: selectedOrgStructureNodeId || undefined,
        client_name: tagInput.trim() || null,
        tags: [],
        compliance_id: complianceId || undefined,
        document_instance_id: documentId || undefined,
      };

      const created = await taskService.createTask(taskData);
      const createdObj: any = created && typeof created === 'object' ? created : null;
      const taskId = createdObj?.id || null;
      const conversationId = createdObj?.conversation_id || createdObj?.conversationId || null;

      let attachmentToSend: { mediaUrl: string; fileName?: string; fileSize?: number; mimeType?: string } | null =
        documentAttachment?.mediaUrl ? documentAttachment : null;

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
        } catch {
          // Do not block task creation.
        }
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
        } catch {
          // Do not block task creation.
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
      toast.error(error?.response?.data?.error || 'Failed to create task');
    } finally {
      setCreateTaskLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-primary px-5 py-4">
          <h2 className="text-lg font-bold text-white">Create Task</h2>
          <button
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-white/20 text-white"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="max-h-[calc(92vh-72px)] space-y-2 overflow-y-auto bg-[#F9FAFB] p-3">
          <p className={introMessageClass}>Hey, create a task here.</p>
          <div className={sectionClass}>
            <div className="flex items-start gap-3">
              <label className="w-24 shrink-0 pt-2 text-xs font-medium text-[#6B7280]">Task title *</label>
              <div className="relative min-w-0 flex-1">
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setShowTitleSuggestions(true);
                    setTitleHighlightedIndex(-1);
                    setBasicInfoConfirmed(false);
                  }}
                  onFocus={() => setShowTitleSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 160)}
                  onKeyDown={(e) =>
                    handleComboboxKeyDown({
                      event: e,
                      showSuggestions: showTitleSuggestions,
                      suggestionsLength: titleSuggestions.length,
                      highlightedIndex: titleHighlightedIndex,
                      setHighlightedIndex: setTitleHighlightedIndex,
                      setShowSuggestions: setShowTitleSuggestions,
                      onSelect: (index) => {
                        const item = titleSuggestions[index];
                        if (!item?.title) return;
                        setTitle(item.title);
                        setShowTitleSuggestions(false);
                        setTitleHighlightedIndex(-1);
                        setBasicInfoConfirmed(false);
                      },
                    })
                  }
                  placeholder="Enter task title or choose from org services"
                  className={inputClass}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showTitleSuggestions && titleSuggestions.length > 0}
                  aria-autocomplete="list"
                />
                {showTitleSuggestions && titleSuggestions.length > 0 ? (
                  <div
                    className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg"
                    role="listbox"
                  >
                    {titleSuggestions.map((s: any, index) => (
                      <button
                        key={s.id}
                        type="button"
                        tabIndex={-1}
                        role="option"
                        aria-selected={index === titleHighlightedIndex}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setTitle(s.title || '');
                          setShowTitleSuggestions(false);
                          setTitleHighlightedIndex(-1);
                          setBasicInfoConfirmed(false);
                        }}
                        className={suggestionOptionClass(index === titleHighlightedIndex)}
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <label className="w-24 shrink-0 pt-2 text-xs font-medium text-[#6B7280]">Task Tag</label>
              <div className="relative min-w-0 flex-1">
                <input
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowTagSuggestions(true);
                    setTagHighlightedIndex(-1);
                    setBasicInfoConfirmed(false);
                  }}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTagSuggestions(false), 160)}
                  onKeyDown={(e) =>
                    handleComboboxKeyDown({
                      event: e,
                      showSuggestions: showTagSuggestions,
                      suggestionsLength: tagSuggestions.length,
                      highlightedIndex: tagHighlightedIndex,
                      setHighlightedIndex: setTagHighlightedIndex,
                      setShowSuggestions: setShowTagSuggestions,
                      onSelect: (index) => applyClientName(tagSuggestions[index]?.name || ''),
                      onEnterWithoutSuggestions: () => applyClientName(),
                    })
                  }
                  placeholder="Select client"
                  className={inputClass}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showTagSuggestions && tagSuggestions.length > 0}
                  aria-autocomplete="list"
                />
                {showTagSuggestions && tagSuggestions.length > 0 ? (
                  <div
                    className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg"
                    role="listbox"
                  >
                    {tagSuggestions.map((c: any, index) => (
                      <button
                        key={c.id}
                        type="button"
                        tabIndex={-1}
                        role="option"
                        aria-selected={index === tagHighlightedIndex}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyClientName(c.name || '')}
                        className={suggestionOptionClass(index === tagHighlightedIndex)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <label className="w-24 shrink-0 pt-2 text-xs font-medium text-[#6B7280]">Org Unit</label>
              <div className="min-w-0 flex-1 flex items-start gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    value={taskUnit}
                    onChange={(e) => {
                      setTaskUnit(e.target.value);
                      setSelectedOrgStructureNodeId(taskUnitOrgUnitIdMap.get(e.target.value.trim()) || null);
                      setShowTaskUnitSuggestions(true);
                      setTaskUnitHighlightedIndex(-1);
                      setBasicInfoConfirmed(false);
                    }}
                    onFocus={() => setShowTaskUnitSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTaskUnitSuggestions(false), 160)}
                    onKeyDown={(e) =>
                      handleComboboxKeyDown({
                        event: e,
                        showSuggestions: showTaskUnitSuggestions,
                        suggestionsLength: taskUnitSuggestions.length,
                        highlightedIndex: taskUnitHighlightedIndex,
                        setHighlightedIndex: setTaskUnitHighlightedIndex,
                        setShowSuggestions: setShowTaskUnitSuggestions,
                        onSelect: (index) => applyTaskUnitName(taskUnitSuggestions[index]),
                        onEnterWithoutSuggestions: () => applyTaskUnitName(),
                      })
                    }
                    placeholder="Select organization unit"
                    className={inputClass}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showTaskUnitSuggestions && taskUnitSuggestions.length > 0}
                    aria-autocomplete="list"
                  />
                  {showTaskUnitSuggestions && taskUnitSuggestions.length > 0 ? (
                    <div
                      className="absolute left-0 right-12 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg"
                      role="listbox"
                    >
                      {taskUnitSuggestions.map((unit, index) => (
                        <button
                          key={unit}
                          type="button"
                          tabIndex={-1}
                          role="option"
                          aria-selected={index === taskUnitHighlightedIndex}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyTaskUnitName(unit)}
                          className={suggestionOptionClass(index === taskUnitHighlightedIndex)}
                        >
                          {unit}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {selectedOrgStructureNodeId ? (
                    <p className="mt-2 text-xs text-[#6B7280]">
                      Linked organization path: {taskUnit}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={confirmBasicInfo}
                  aria-label="Confirm basic task info"
                  title="Confirm basic task info"
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    basicInfoConfirmed
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-[#C4B5FD] bg-white text-primary hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">check</span>
                </button>
              </div>
            </div>
          </div>

          <fieldset disabled={!basicInfoConfirmed} className={`${sectionClass} ${!basicInfoConfirmed ? 'opacity-45' : ''}`}>
            <div className={sectionRowClass}>
              <div className={sectionQuestionClass}>
                <span className="text-xs font-medium text-[#4B5563]">Is this task recurring?</span>
                <YesNoToggle value={isRecurring} onChange={setIsRecurring} ariaLabel="Is this task recurring?" />
              </div>
              <div className={sectionContentClass}>
                {isRecurring ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setTaskFrequency(f)}
                          className={`${optionBaseClass} ${taskFrequency === f ? optionActiveClass : ''}`}
                        >
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: 'never', label: 'Never' },
                        { key: 'specific_date', label: 'Specific Date' },
                        { key: 'after_occurrences', label: 'After X occurrences' },
                      ] as const).map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setTaskEnds(o.key)}
                          className={`${optionBaseClass} ${taskEnds === o.key ? optionActiveClass : ''}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>

                    {taskEnds === 'specific_date' ? (
                      <button type="button" onClick={() => setShowRecurrenceEndPicker(true)} className={`${inputClass} text-left`}>
                        Recurrence end date: {recurrenceEndDate.toLocaleDateString()}
                      </button>
                    ) : null}

                    {taskEnds === 'after_occurrences' ? (
                      <input
                        value={occurrenceCount}
                        onChange={(e) => setOccurrenceCount(e.target.value)}
                        placeholder="Number of occurrences"
                        inputMode="numeric"
                        className={inputClass}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset disabled={!basicInfoConfirmed} className={`${sectionClass} ${!basicInfoConfirmed ? 'opacity-45' : ''}`}>
            <div className={sectionRowClass}>
              <div className={sectionQuestionClass}>
                <span className="text-xs font-medium text-[#4B5563]">Do you want to set timelines for this task?</span>
                <YesNoToggle value={setTimelines} onChange={setSetTimelines} ariaLabel="Do you want to set timelines for this task?" />
              </div>
              <div className={sectionContentClass}>
                {setTimelines ? (
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setShowStartPicker(true)} className={`${inputClass} text-left`}>
                      Start Date: {startDate.toLocaleDateString()}
                    </button>
                    <button type="button" onClick={() => setShowTargetPicker(true)} className={`${inputClass} text-left`}>
                      Target Date: {targetDate.toLocaleDateString()}
                    </button>
                    <button type="button" onClick={() => setShowDuePicker(true)} className={`${inputClass} text-left`}>
                      Due Date: {dueDate.toLocaleDateString()}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset disabled={!basicInfoConfirmed} className={`${sectionClass} ${!basicInfoConfirmed ? 'opacity-45' : ''}`}>
            <div className={sectionRowClass}>
              <div className={sectionQuestionClass}>
                <span className="text-xs font-medium text-[#4B5563]">Do you want to assign people to this task?</span>
                <YesNoToggle value={assignPeople} onChange={setAssignPeople} ariaLabel="Do you want to assign people to this task?" />
              </div>
              <div className={sectionContentClass}>
                {assignPeople ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => openUserModal('owner')} className={`${inputClass} text-left`}>
                      Task Owner: {ownerLabel}
                    </button>
                    <button type="button" onClick={() => openUserModal('assignees')} className={`${inputClass} text-left`}>
                      Assignees: {selectedAssignees.length > 0 ? `${selectedAssignees.length} selected` : 'Select users'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </fieldset>


          <fieldset disabled={!basicInfoConfirmed} className={`${sectionClass} ${!basicInfoConfirmed ? 'opacity-45' : ''}`}>
            <div className={sectionRowClass}>
              <div className={sectionQuestionClass}>
                <span className="text-xs font-medium text-[#4B5563]">Do you want auto escalation for this task?</span>
                <YesNoToggle value={autoEscalation} onChange={setAutoEscalation} ariaLabel="Do you want auto escalation for this task?" />
              </div>
              <div className={sectionContentClass}>
                {autoEscalation ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: 'target_date', label: 'After Target Date' },
                        { key: 'due_date', label: 'After Due Date' },
                      ] as const).map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setEscalationTrigger(o.key)}
                          className={`${optionBaseClass} ${escalationTrigger === o.key ? optionActiveClass : ''}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={escalationTiming}
                        onChange={(e) => setEscalationTiming(e.target.value)}
                        inputMode="numeric"
                        placeholder="Days before"
                        className={inputClass}
                      />

                      <button type="button" onClick={() => openUserModal('escalation')} className={`${inputClass} text-left`}>
                        Contacts: {escalationContacts.length > 0 ? `${escalationContacts.length} selected` : 'Select contacts'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </fieldset>

          <fieldset disabled={!basicInfoConfirmed} className={`${sectionClass} ${!basicInfoConfirmed ? 'opacity-45' : ''}`}>
            <div className={sectionRowClass}>
              <div className={sectionQuestionClass}>
                <span className="text-xs font-medium text-[#4B5563]">Do you want to add Financial Value?</span>
                <YesNoToggle value={addFinancialValue} onChange={setAddFinancialValue} ariaLabel="Do you want to add Financial Value?" />
              </div>
              <div className={sectionContentClass}>
                {addFinancialValue ? (
                  <input
                    value={financialValue}
                    onChange={(e) => setFinancialValue(e.target.value)}
                    inputMode="decimal"
                    placeholder="Enter amount"
                    className={inputClass}
                  />
                ) : null}
              </div>
            </div>
          </fieldset>

          <button
            type="button"
            onClick={handleCreateTask}
            disabled={createTaskLoading}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {createTaskLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">check</span>
                <span>Create Task</span>
              </>
            )}
          </button>
        </div>
      </div>

      {showUserModal ? (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowUserModal(false)}>
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
              <h3 className="text-base font-semibold text-[#1F2937]">
                {userModalMode === 'owner'
                  ? 'Select Task Owner'
                  : userModalMode === 'assignees'
                  ? 'Select Assignees'
                  : 'Select Escalation Contacts'}
              </h3>
              <button onClick={() => setShowUserModal(false)}>
                <span className="material-symbols-outlined text-[#6B7280]">close</span>
              </button>
            </div>
            <div className="p-3">
              <input
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search users..."
                className={inputClass}
              />
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {filteredUsers.map((u) => {
                const isSelected =
                  userModalMode === 'owner'
                    ? String(taskOwnerId) === String(u.id)
                    : userModalMode === 'assignees'
                    ? selectedAssignees.some((x) => String(x.id) === String(u.id))
                    : escalationContacts.some((x) => String(x.id) === String(u.id));
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (userModalMode === 'owner') {
                        setTaskOwnerId(u.id);
                        setShowUserModal(false);
                        return;
                      }
                      if (userModalMode === 'assignees') {
                        toggleMultiUser(u, selectedAssignees, setSelectedAssignees);
                        return;
                      }
                      toggleMultiUser(u, escalationContacts, setEscalationContacts);
                    }}
                    className={`mb-2 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                      isSelected ? 'border-primary bg-[#F3E8FF]' : 'border-[#E5E7EB] bg-white'
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1F2937]">{u.name}</p>
                      <p className="text-xs text-[#6B7280]">{u.mobile || u.phone || '-'}</p>
                    </div>
                    {isSelected ? <span className="material-symbols-outlined text-primary">check_circle</span> : null}
                  </button>
                );
              })}
            </div>
            {userModalMode !== 'owner' ? (
              <div className="border-t border-[#E5E7EB] p-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="min-h-[42px] w-full rounded-lg bg-primary text-sm font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showStartPicker ? (
        <CustomDatePicker
          value={startDate}
          onChange={setStartDate}
          onClose={() => setShowStartPicker(false)}
          title="Start Date"
          hideTimePicker
        />
      ) : null}
      {showTargetPicker ? (
        <CustomDatePicker
          value={targetDate}
          onChange={setTargetDate}
          onClose={() => setShowTargetPicker(false)}
          title="Target Date"
          hideTimePicker
        />
      ) : null}
      {showDuePicker ? (
        <CustomDatePicker
          value={dueDate}
          onChange={setDueDate}
          onClose={() => setShowDuePicker(false)}
          title="Due Date"
          hideTimePicker
        />
      ) : null}
      {showRecurrenceEndPicker ? (
        <CustomDatePicker
          value={recurrenceEndDate}
          onChange={setRecurrenceEndDate}
          onClose={() => setShowRecurrenceEndPicker(false)}
          title="Recurrence End Date"
          hideTimePicker
        />
      ) : null}
    </div>
  );
};

