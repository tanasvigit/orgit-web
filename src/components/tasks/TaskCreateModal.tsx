import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { conversationService } from '../../services/conversationService';
import { taskService } from '../../services/taskService';
import { CustomDatePicker } from '../shared/CustomDatePicker';

interface TaskCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialTitle?: string;
  initialDescription?: string;
  initialDueDate?: Date;
  complianceId?: string;
  documentId?: string;
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
}) => {
  const [taskType, setTaskType] = useState<'one_time' | 'recurring'>('one_time');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedAssignees, setSelectedAssignees] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [targetDate, setTargetDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [autoEscalate, setAutoEscalate] = useState(false);
  const [createTaskLoading, setCreateTaskLoading] = useState(false);

  // Initialize form with initial values when modal opens
  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setDescription(initialDescription);
      if (initialDueDate) {
        setDueDate(initialDueDate);
        setTargetDate(initialDueDate);
      } else {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 30);
        setDueDate(defaultDueDate);
        setTargetDate(defaultDueDate);
      }
    }
  }, [visible, initialTitle, initialDescription, initialDueDate]);

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

  // Reset form
  const resetForm = () => {
    setTaskType('one_time');
    setTitle('');
    setDescription('');
    setPriority('medium');
    setSelectedAssignees([]);
    setStartDate(new Date());
    setTargetDate(new Date());
    setDueDate(new Date());
    setRecurrenceType('weekly');
    setAutoEscalate(false);
  };

  // Handle create task
  const handleCreateTask = async () => {
    if (!title.trim()) {
      alert('Please enter a task title');
      return;
    }

    if (!dueDate) {
      alert('Please select a due date');
      return;
    }

    if (selectedAssignees.length === 0) {
      alert('Please assign the task to at least one person');
      return;
    }

    setCreateTaskLoading(true);
    try {
      const taskData: any = {
        title: title.trim(),
        description: description.trim(),
        task_type: taskType,
        priority,
        assignee_ids: selectedAssignees.map(a => a.id),
        start_date: startDate.toISOString(),
        target_date: targetDate.toISOString(),
        due_date: dueDate.toISOString(),
        recurrence_type: taskType === 'recurring' ? recurrenceType : null,
        recurrence_interval: 1,
        auto_escalate: autoEscalate,
      };

      // Add compliance_id or document_id if provided
      if (complianceId) {
        taskData.compliance_id = complianceId;
      }
      if (documentId) {
        taskData.document_id = documentId;
      }

      await taskService.createTask(taskData);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Create task error:', error);
      alert(error.response?.data?.error || 'Failed to create task');
    } finally {
      setCreateTaskLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary dark:bg-primary/90 rounded-t-2xl">
          <h2 className="text-white text-lg font-bold">Create Task</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Task Type Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setTaskType('one_time')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                taskType === 'one_time'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              One-Time Task
            </button>
            <button
              onClick={() => setTaskType('recurring')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${
                taskType === 'recurring'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              Recurring Task
            </button>
          </div>

          {/* Task Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q3 Financial Review"
              readOnly={!!initialTitle}
              className={`w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                initialTitle ? 'bg-gray-50 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700'
              }`}
            />
          </div>

          {/* Description */}
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
              className={`w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none ${
                initialDescription ? 'bg-gray-50 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-700'
              }`}
            />
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Assigned To
            </label>
            <button
              onClick={() => setShowAssigneeModal(true)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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

          {/* Schedule Section */}
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

          {/* Recurrence Type (if recurring) */}
          {taskType === 'recurring' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Recurrence
              </label>
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'daily'] as const).map((type) => (
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
          )}

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    priority === p
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

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

          {/* Create Button */}
          <button
            onClick={handleCreateTask}
            disabled={createTaskLoading || !title.trim() || selectedAssignees.length === 0}
            className="w-full py-3 px-4 rounded-lg bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAssigneeModal(false)}>
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
                {users.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No employees available</p>
                ) : (
                  users.map((user: any) => {
                    const isSelected = selectedAssignees.find(u => u.id === user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleAssignee(user)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg mb-2 transition-colors ${
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
    </div>
  );
};

