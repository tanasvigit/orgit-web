import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from 'react-query';
import { conversationService } from '../../services/conversationService';
import { taskService } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';

type OrgUser = {
  id?: string;
  user_id?: string;
  name?: string;
  mobile?: string;
  phone?: string;
  profilePhotoUrl?: string;
  profile_photo_url?: string;
};

function resolveUserId(u: OrgUser): string {
  return String(u.id ?? u.user_id ?? '').trim();
}

type BulkAssignUsersModalProps = {
  open: boolean;
  taskCount: number;
  taskIds: string[];
  onClose: () => void;
  onSuccess: () => void;
};

export const BulkAssignUsersModal: React.FC<BulkAssignUsersModalProps> = ({
  open,
  taskCount,
  taskIds,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { data: allUsers = [], isLoading, isError } = useQuery(
    ['org-contacts', 'bulk-assign-tasks'],
    () => conversationService.getOrgContacts(),
    { enabled: open, staleTime: 60_000, retry: 1 }
  );

  const normalizedUsers = useMemo(() => {
    const list = (allUsers as OrgUser[]) || [];
    return list
      .map((u) => ({ ...u, resolvedId: resolveUserId(u) }))
      .filter((u) => u.resolvedId);
  }, [allUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return normalizedUsers;
    return normalizedUsers.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.mobile || u.phone || '').toString().toLowerCase().includes(q)
    );
  }, [normalizedUsers, searchQuery]);

  const assignMutation = useMutation(
    async () => {
      if (!taskIds.length) {
        throw new Error('No tasks selected');
      }
      if (!selectedUserIds.length) {
        throw new Error('No users selected');
      }
      return taskService.bulkAddTaskAssignees(taskIds, selectedUserIds);
    },
    {
      onSuccess: (data: any) => {
        const summary = data?.summary ?? data?.data?.summary;
        const failed = summary?.tasks_failed ?? 0;
        const added = summary?.assignees_added_total ?? 0;
        const succeeded = summary?.tasks_succeeded ?? taskCount;
        if (failed > 0) {
          toast.success(
            `Assigned to ${succeeded} task(s). ${failed} failed. ${added} new assignment(s).`
          );
        } else {
          toast.success(
            `Users assigned to ${succeeded} task(s). ${added} new assignment(s).`
          );
        }
        setSelectedUserIds([]);
        setSearchQuery('');
        onSuccess();
        onClose();
      },
      onError: (error: any) => {
        const msg =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to assign users';
        toast.error(msg);
      },
    }
  );

  const toggleUser = (userId: string) => {
    if (!userId) return;
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleClose = () => {
    if (assignMutation.isLoading) return;
    setSelectedUserIds([]);
    setSearchQuery('');
    onClose();
  };

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-surface-dark shadow-xl border border-gray-200 dark:border-gray-700"
        role="dialog"
        aria-labelledby="bulk-assign-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 id="bulk-assign-title" className="text-sm font-bold text-gray-900 dark:text-white">
            Add users to {taskCount} task{taskCount === 1 ? '' : 's'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <span className="material-icons-outlined text-lg">close</span>
          </button>
        </div>

        <p className="px-4 pt-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
          Organization members
        </p>

        <div className="px-4 py-2 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex-1 min-h-[200px] max-h-[50vh] overflow-y-auto px-2 pb-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading members...</div>
          ) : isError ? (
            <div className="py-8 text-center text-sm text-red-500">Could not load members</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No members found</div>
          ) : (
            <ul className="space-y-0.5">
              {filteredUsers.map((u) => {
                const uid = u.resolvedId;
                const checked = selectedUserIds.includes(uid);
                const photo = u.profilePhotoUrl || u.profile_photo_url;
                return (
                  <li key={uid}>
                    <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer min-h-[52px]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(uid)}
                        className="shrink-0 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          className="shrink-0 w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="shrink-0 w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {(u.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {u.name || 'Unknown'}
                        </div>
                        {(u.mobile || u.phone) && (
                          <div className="text-xs text-gray-500 truncate">{u.mobile || u.phone}</div>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={assignMutation.isLoading}
            className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedUserIds.length === 0 || assignMutation.isLoading || taskIds.length === 0}
            onClick={() => assignMutation.mutate()}
            className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {assignMutation.isLoading ? 'Assigning...' : `Assign (${selectedUserIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};
