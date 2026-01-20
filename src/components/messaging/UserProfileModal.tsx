import React, { useEffect, useState, useMemo } from 'react';
import { authService } from '../../services/authService';

interface UserProfileModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ userId, isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;

    const loadUser = async () => {
      setLoading(true);
      try {
        const response = await authService.getUserById(userId);
        if (!isMounted) return;

        if (response.success) {
          setUser(response.user || response.data);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to load user for profile modal:', error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  const initials = useMemo(() => {
    if (!user?.name) return '?';
    const parts = user.name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, [user]);

  if (!isOpen || !userId) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Contact info</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <span className="material-icons-outlined text-base">close</span>
          </button>
        </div>
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <span className="text-gray-500 text-sm">Loading...</span>
          </div>
        ) : !user ? (
          <div className="p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
              Unable to load user details.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center text-center">
              {user.profilePhotoUrl || user.profile_photo || user.profile_photo_url ? (
                <img
                  src={user.profilePhotoUrl || user.profile_photo || user.profile_photo_url}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold shadow-md">
                  {initials}
                </div>
              )}
              <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                {user.name}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {user.bio || user.about || 'Hey there! I am using OrgIT.'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Phone
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {user.mobile || user.phone || user.contact_number || '-'}
                </p>
              </div>

              {user.organizationName && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Organisation
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {user.organizationName}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


