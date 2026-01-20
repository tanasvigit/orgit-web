import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';

export const UserProfileScreen: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const initials = useMemo(() => {
    if (!user?.name) return '?';
    const parts = user.name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, [user]);

  useEffect(() => {
    const loadUser = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await authService.getUserById(userId);
        // Backend returns { success: true, user: {...} } or { success: true, data: {...} }
        if (response.success) {
          setUser(response.user || response.data);
        } else {
          console.error('User not found');
        }
      } catch (error) {
        console.error('Load user error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-primary">Loading...</div>
        </div>
      ) : !user ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">User not found</p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark">Contact info</h1>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <span className="material-icons-outlined">close</span>
            </button>
          </div>

          <div className="flex flex-col items-center mb-8">
            {user.profilePhotoUrl || user.profile_photo || user.profile_photo_url ? (
              <img
                src={user.profilePhotoUrl || user.profile_photo || user.profile_photo_url}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {initials}
              </div>
            )}
            <h2 className="mt-4 text-2xl font-bold text-text-main-light dark:text-text-main-dark">{user.name}</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              {user.mobile || user.phone || user.contact_number || 'No contact number'}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">About</h3>
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Status</p>
                <p className="text-text-main-light dark:text-text-main-dark">
                  {user.bio || user.about || 'Hey there! I am using OrgIT.'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Contact</h3>
              <div className="bg-surface-light dark:bg-surface-dark rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Phone number</p>
                <p className="text-text-main-light dark:text-text-main-dark">
                  {user.mobile || user.phone || user.contact_number || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isAdmin) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <EmployeeLayout>{content}</EmployeeLayout>;
};

