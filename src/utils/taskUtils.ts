/**
 * Web-only: treat a task as deleted only when the backend explicitly marks it (deleted_at set or is_deleted === true).
 * Used to hide deleted tasks from Dashboard and Task Management while still showing them in Messages with a deleted indicator.
 * Avoids treating missing/undefined or string "false" as deleted so tasks keep loading when the API doesn't send these fields.
 */
export function isTaskDeleted(task: any): boolean {
  if (!task) return false;
  const deletedAt = task.deleted_at ?? task.deletedAt;
  const isDeleted = task.is_deleted;
  if (typeof isDeleted === 'boolean' && isDeleted) return true;
  if (deletedAt != null && deletedAt !== '' && deletedAt !== false) return true;
  return false;
}
