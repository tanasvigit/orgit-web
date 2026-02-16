import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { conversationService } from '../../services/conversationService';
import { taskService } from '../../services/taskService';
import { documentInstanceService } from '../../services/documentInstanceService';
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
  const [isRecurring, setIsRecurring] = useState(false); // Toggle for recurrence (default: disabled = one_time)
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
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('weekly');
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [createTaskLoading, setCreateTaskLoading] = useState(false);
  const [reportingMemberId, setReportingMemberId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Check if form has any data entered by user
  const hasFormData = () => {
    // Check if title has been modified (not just initial value)
    const titleModified = title.trim() && title.trim() !== initialTitle;
    // Check if description has been modified (not just initial value)
    const descriptionModified = description.trim() && description.trim() !== initialDescription;
    // Check other fields
    const hasOtherData = 
      selectedAssignees.length > 0 ||
      financialValue.trim().length > 0 ||
      isRecurring ||
      taskOwner !== 'self' ||
      taskOwnerUserId !== null ||
      reportingMemberId !== null ||
      autoEscalate;
    
    return titleModified || descriptionModified || hasOtherData;
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

  // Fetch users for assignee selection
  const { data: usersData } = useQuery(
    'allUsers',
    () => conversationService.getAllUsers(),
    { enabled: visible }
  );

  const users = usersData || [];

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

  // Reset form (all dates default to 9:00 AM)
  const resetForm = () => {
    setIsRecurring(false);
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
    setAutoEscalate(false);
    setReportingMemberId(null);
  };

  // Handle create task
  const handleCreateTask = async () => {
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    if (!dueDate) {
      toast.error('Please select a due date');
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
        task_type: isRecurring ? 'recurring' : 'one_time',
        task_owner: taskOwner,
        financial_value: Number.isFinite(parsedFinancialValue as number) ? parsedFinancialValue : null,
        finance_type: financialValue.trim().length > 0 ? financeType : null,
        assignee_ids: fallbackAssignees.map((a) => a.id),
        start_date: startDate.toISOString(),
        target_date: targetDate.toISOString(),
        due_date: dueDate.toISOString(),
        recurrence_type: isRecurring ? recurrenceType : null,
        recurrence_interval: 1,
        auto_escalate: autoEscalate,
        // Mobile stores documentId/complianceId in metadata (backend may ignore; kept for parity)
        metadata: {
          ...(documentId ? { documentId } : {}),
          ...(complianceId ? { complianceId } : {}),
          ...(taskOwner === 'contacts' && taskOwnerUserId ? { taskOwnerUserId } : {}),
        },
      };

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

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={handleClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl mx-auto"
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* 1. Task Title */}
          <div>
            <label className="block text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q3 Financial Review"
              readOnly={!!initialTitle}
              className={`w-full px-4 py-3 sm:py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm sm:text-base text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors min-h-[44px] ${
                initialTitle ? 'bg-gray-50 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700'
              }`}
            />
          </div>

          {/* 2. Assigned To */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Assigned To
            </label>
            <button
              onClick={() => setShowAssigneeModal(true)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">people</span>
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

          {/* 3. SCHEDULE */}
          <div>
            <h3 className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400 mb-4 tracking-wider">
              SCHEDULE
            </h3>

            {/* Start Date */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <button
                onClick={() => setShowStartPicker(true)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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

          {/* 4. Recurrence Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Recurrence
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isRecurring ? 'This is a recurring task' : 'This is a one-time task'}
              </p>
            </div>
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${
                isRecurring ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={isRecurring}
              aria-label={isRecurring ? 'Recurring task enabled' : 'One-time task (recurrence disabled)'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isRecurring ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Recurrence Options (only visible when toggle is enabled) */}
          {isRecurring && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Recurrence Frequency
              </label>
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((type) => (
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

          {/* 5. Task Owner */}
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
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                    taskOwner === owner
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
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

          {/* 6. Financial Value (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Financial Value <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={financialValue}
              onChange={(e) => setFinancialValue(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-700 transition-colors"
            />
          </div>

          {/* Finance Type (only show if financial value entered) */}
          {financialValue.trim().length > 0 && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Type of Finance
              </label>
              <div className="flex gap-2">
                {(['income', 'expense'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFinanceType(type)}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                      financeType === type
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

          {/* 7. Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add detailed instructions..."
              rows={4}
              readOnly={!!initialDescription}
              className={`w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-colors ${
                initialDescription ? 'bg-gray-50 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700'
              }`}
            />
          </div>

          {/* 8. Auto Escalate */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Auto Escalate
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automatically escalate task if not completed on time
              </p>
            </div>
            <button
              onClick={() => setAutoEscalate(!autoEscalate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${
                autoEscalate ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={autoEscalate}
              aria-label={autoEscalate ? 'Auto escalate enabled' : 'Auto escalate disabled'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoEscalate ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

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
                {users.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No employees available</p>
                ) : (
                  users.map((user: any) => {
                    const isSelected = selectedAssignees.find(u => u.id === user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleAssignee(user)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg mb-2 transition-colors min-h-[44px] ${
                          isSelected
                            ? 'bg-primary/10 border-2 border-primary'
                            : 'bg-gray-100 dark:bg-gray-700 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {user.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-gray-900 dark:text-white">{user.name || user.mobile}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{user.mobile}</p>
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
                  onClick={() => setShowAssigneeModal(false)}
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

