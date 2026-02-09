import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/authService';

/**
 * Popup shown after first login when user must change password (e.g. bulk-uploaded employees).
 * User can change password or skip.
 */
export const ChangePasswordPopup: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  if (!user?.mustChangePassword) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('New password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.changePassword({
        currentPassword,
        newPassword,
      });
      if (res.success) {
        toast.success('Password changed successfully');
        updateUser({ ...user, mustChangePassword: false });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await authService.dismissChangePassword();
      updateUser({ ...user, mustChangePassword: false });
      toast.success('You can change your password later from Settings.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dismiss');
    } finally {
      setSkipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Change Password</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          For security, please set a new password. You can skip and change it later from Settings.
        </p>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password (min 4 characters)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              autoComplete="new-password"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg font-medium bg-primary text-white disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Change Password'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={skipping}
              className="flex-1 py-2.5 rounded-lg font-medium bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 disabled:opacity-50"
            >
              {skipping ? 'Skipping...' : 'Skip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
