export type TaskCardMember = {
  id: string;
  name: string;
  photoUrl?: string | null;
};

export function getProfileInitials(name?: string | null): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  const word = parts[0];
  if (word.length >= 2) return word.substring(0, 2).toUpperCase();
  return (word.charAt(0) + word.charAt(0)).toUpperCase();
}

export function normalizeTaskCardAssignees(task: unknown): TaskCardMember[] {
  const assignees = (task as { assignees?: unknown })?.assignees;
  if (!Array.isArray(assignees)) return [];
  return assignees
    .map((assignee: any) => {
      const id = assignee?.id || assignee?.user_id || assignee?.userId;
      if (!id) return null;
      return {
        id: String(id),
        name: String(assignee?.name || assignee?.full_name || 'User'),
        photoUrl: assignee?.photoUrl || assignee?.profile_photo_url || assignee?.profile_photo || null,
      };
    })
    .filter(Boolean) as TaskCardMember[];
}

export function resolveTaskCardOwner(
  task: unknown,
  assignees: TaskCardMember[]
): TaskCardMember | null {
  const row = task as {
    created_by?: string | number;
    creator_id?: string | number;
    creator_name?: string;
    creatorName?: string;
    creator_photo?: string | null;
    creatorPhoto?: string | null;
  };
  const ownerId = row.created_by ?? row.creator_id;
  if (ownerId == null) return null;
  const idStr = String(ownerId);
  const fromAssignees = assignees.find((member) => String(member.id) === idStr);
  if (fromAssignees) return fromAssignees;
  return {
    id: idStr,
    name: String(row.creator_name || row.creatorName || 'Owner').trim() || 'Owner',
    photoUrl: row.creator_photo || row.creatorPhoto || null,
  };
}

export function filterAssigneesExcludingOwner(
  assignees: TaskCardMember[],
  owner: TaskCardMember | null
): TaskCardMember[] {
  if (!owner) return assignees;
  return assignees.filter((member) => String(member.id) !== String(owner.id));
}

export function resolveTaskCardMembers(task: unknown): {
  owner: TaskCardMember | null;
  assignees: TaskCardMember[];
} {
  const allAssignees = normalizeTaskCardAssignees(task);
  const owner = resolveTaskCardOwner(task, allAssignees);
  return {
    owner,
    assignees: filterAssigneesExcludingOwner(allAssignees, owner),
  };
}
