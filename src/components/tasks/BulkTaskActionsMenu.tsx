import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useToast } from '../../context/ToastContext';
import {
  BulkTaskActionKey,
  getBulkTaskActionCounts,
} from '../../utils/taskDashboardUserActions';
import {
  bulkDeleteTasks,
  bulkExitTasksWithComments,
  bulkMarkTasksComplete,
  bulkMoveTasksToInProgress,
  bulkRequestTaskDelete,
  formatBulkActionSummary,
} from '../../utils/bulkTaskActionRunner';

type CommentModalKind = 'exit_with_comments' | 'request_delete';

type BulkTaskActionsMenuProps = {
  selectedTasks: any[];
  currentUserId: string;
  userRole?: string;
  dueSoonDays?: number;
  disabled?: boolean;
  onAddMembers: () => void;
  onActionComplete: () => void;
};

const ACTION_LABELS: Record<BulkTaskActionKey, string> = {
  in_progress: 'In Progress',
  mark_complete: 'Mark complete',
  add_member: 'Add members',
  exit_with_comments: 'Exit with comments',
  request_delete: 'Request delete',
  delete_direct: 'Delete task',
};

const ACTION_ICONS: Record<BulkTaskActionKey, string> = {
  in_progress: 'play_arrow',
  mark_complete: 'check_circle',
  add_member: 'person_add',
  exit_with_comments: 'logout',
  request_delete: 'outgoing_mail',
  delete_direct: 'delete_outline',
};

export const BulkTaskActionsMenu: React.FC<BulkTaskActionsMenuProps> = ({
  selectedTasks,
  currentUserId,
  userRole,
  dueSoonDays,
  disabled = false,
  onAddMembers,
  onActionComplete,
}) => {
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [commentModal, setCommentModal] = useState<{
    kind: CommentModalKind;
    text: string;
  } | null>(null);

  useClickOutside(menuRef, () => setOpen(false), open);

  const actionBuckets = useMemo(
    () => getBulkTaskActionCounts(selectedTasks, currentUserId, { userRole, dueSoonDays }),
    [selectedTasks, currentUserId, userRole, dueSoonDays]
  );

  const availableActions = (Object.keys(actionBuckets) as BulkTaskActionKey[]).filter(
    (key) => actionBuckets[key].length > 0
  );

  const runAction = async (key: BulkTaskActionKey) => {
    if (running || selectedTasks.length === 0) return;
    setOpen(false);

    if (key === 'add_member') {
      onAddMembers();
      return;
    }

    if (key === 'exit_with_comments' || key === 'request_delete') {
      setCommentModal({ kind: key, text: '' });
      return;
    }

    const count = actionBuckets[key].length;
    const label = ACTION_LABELS[key];

    const confirmMessage =
      key === 'delete_direct'
        ? `Delete ${count} task(s)? This cannot be undone.`
        : key === 'mark_complete'
        ? `Mark ${count} task(s) as complete?`
        : `Apply "${label}" to ${count} task(s)?`;

    toast.confirm(confirmMessage, {
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          setRunning(true);
          let result;
          const opts = { userRole, dueSoonDays };
          if (key === 'in_progress') {
            result = await bulkMoveTasksToInProgress(selectedTasks, currentUserId, opts);
          } else if (key === 'mark_complete') {
            result = await bulkMarkTasksComplete(selectedTasks, currentUserId, opts);
          } else if (key === 'delete_direct') {
            result = await bulkDeleteTasks(selectedTasks, currentUserId, opts);
          } else {
            return;
          }
          toast.success(formatBulkActionSummary(result, label));
          if (result.succeeded > 0) onActionComplete();
        } catch (error: any) {
          toast.error(error?.message || `Failed to run ${label}`);
        } finally {
          setRunning(false);
        }
      },
    });
  };

  const submitCommentModal = async () => {
    if (!commentModal || !commentModal.text.trim()) {
      toast.error('Please enter a comment.');
      return;
    }
    const kind = commentModal.kind;
    const label = ACTION_LABELS[kind];
    const tasks = actionBuckets[kind];
    try {
      setRunning(true);
      const opts = { userRole, dueSoonDays };
      const result =
        kind === 'exit_with_comments'
          ? await bulkExitTasksWithComments(tasks, currentUserId, commentModal.text.trim(), opts)
          : await bulkRequestTaskDelete(tasks, currentUserId, commentModal.text.trim(), opts);
      toast.success(formatBulkActionSummary(result, label));
      setCommentModal(null);
      if (result.succeeded > 0) onActionComplete();
    } catch (error: any) {
      toast.error(error?.message || `Failed to run ${label}`);
    } finally {
      setRunning(false);
    }
  };

  const commentModalPortal =
    commentModal &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => !running && setCommentModal(null)}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {commentModal.kind === 'exit_with_comments'
                ? `Exit ${actionBuckets.exit_with_comments.length} task(s)`
                : `Request delete for ${actionBuckets.request_delete.length} task(s)`}
            </h3>
          </div>
          <div className="px-4 py-3">
            <textarea
              value={commentModal.text}
              onChange={(e) => setCommentModal({ ...commentModal, text: e.target.value })}
              rows={4}
              placeholder={
                commentModal.kind === 'exit_with_comments'
                  ? 'Explain why you are exiting these tasks...'
                  : 'Explain why these tasks should be removed...'
              }
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <button
              type="button"
              disabled={running}
              onClick={() => setCommentModal(null)}
              className="flex-1 min-h-[40px] rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={running || !commentModal.text.trim()}
              onClick={submitCommentModal}
              className="flex-1 min-h-[40px] rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
            >
              {running ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          disabled={disabled || selectedTasks.length === 0 || running}
          onClick={() => setOpen((prev) => !prev)}
          className="min-h-[32px] px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-white disabled:opacity-50 flex items-center gap-1"
        >
          <span className="material-icons-outlined text-base">tune</span>
          Actions
          <span className="material-icons-outlined text-sm">
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {open && availableActions.length > 0 ? (
          <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark py-1 shadow-lg">
            {availableActions.map((key) => (
              <button
                key={key}
                type="button"
                disabled={running}
                onClick={() => runAction(key)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 ${
                  key === 'delete_direct'
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-gray-800 dark:text-gray-200'
                }`}
              >
                <span className="material-symbols-outlined text-base">{ACTION_ICONS[key]}</span>
                <span className="flex-1">{ACTION_LABELS[key]}</span>
                <span className="text-[10px] text-gray-500">{actionBuckets[key].length}</span>
              </button>
            ))}
          </div>
        ) : null}
        {open && availableActions.length === 0 ? (
          <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark px-3 py-2 text-xs text-gray-500 shadow-lg">
            No actions available for selected tasks.
          </div>
        ) : null}
      </div>
      {commentModalPortal}
    </>
  );
};
