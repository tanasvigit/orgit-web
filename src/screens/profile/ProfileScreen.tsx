import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/authService';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Avatar } from '../../components/shared';

export const ProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || user?.about || '');
  const [contactNumber, setContactNumber] = useState(user?.mobile || user?.phone || user?.contact_number || '');
  const [localPhoto, setLocalPhoto] = useState<string | null>(user?.profilePhotoUrl || user?.profile_photo || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state with user context when user changes
  useEffect(() => {
    if (user && !isEditing) {
      setName(user?.name || '');
      setBio(user?.bio || user?.about || '');
      setContactNumber(user?.mobile || user?.phone || user?.contact_number || '');
      setLocalPhoto(user?.profilePhotoUrl || user?.profile_photo || null);
    }
  }, [user, isEditing]);

  const initials = useMemo(() => {
    if (!user?.name) return '?';
    const parts = user.name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, [user]);

  const handleEditToggle = () => {
    if (!isEditing) {
      setName(user?.name || '');
      setBio(user?.bio || user?.about || '');
      setContactNumber(user?.mobile || user?.phone || user?.contact_number || '');
      setLocalPhoto(user?.profilePhotoUrl || user?.profile_photo || null);
    }
    setIsEditing((prev) => !prev);
  };

  const handlePickPhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    try {
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to server
      const response = await authService.uploadProfilePhoto(file);
      if (response.success && response.data?.url) {
        setLocalPhoto(response.data.url);
        // Update user context immediately so other users see the change
        updateUser({ ...user, profilePhotoUrl: response.data.url, profile_photo: response.data.url });
        toast.success('Profile photo updated successfully');
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error('Failed to upload photo. Please try again.');
    }
  };

  const handleDeletePhoto = async () => {
    if (!localPhoto) return;
    
    toast.confirm('Are you sure you want to delete your profile photo?', {
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await authService.deleteProfilePhoto();
          if (response.success) {
            setLocalPhoto(null);
            // Refetch user data from backend to ensure consistency
            const userResponse = await authService.getCurrentUser();
            if (userResponse.success && userResponse.data) {
              updateUser(userResponse.data);
            } else {
              // Fallback: update optimistically if refetch fails
              updateUser({ ...user, profilePhotoUrl: null, profile_photo: null, profile_photo_url: null });
            }
            toast.success('Profile photo deleted successfully');
          }
        } catch (error: any) {
          console.error('Photo delete error:', error);
          toast.error(error.response?.data?.error || 'Failed to delete photo. Please try again.');
        }
      },
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Ensure name is provided (backend validation requires it)
      const profileName = name.trim() || user?.name || '';
      if (!profileName) {
        toast.error('Name is required');
        setSaving(false);
        return;
      }

      const response = await authService.updateProfile({
        name: profileName,
        bio: bio.trim(),
        about: bio.trim(),
        contact_number: contactNumber.trim() || undefined,
        profile_photo: localPhoto || undefined,
      });

      if (response.success) {
        // Backend returns { success: true, profile: {...} } not { success: true, data: {...} }
        const profileData = response.profile || response.data || {};
        
        // Merge the response data with existing user data to ensure all fields are preserved
        const updatedUser = {
          ...user,
          // Update name (from request, not response)
          name: profileName,
          // Update bio/about from response or local state
          bio: profileData.about || profileData.bio || bio.trim() || '',
          about: profileData.about || profileData.bio || bio.trim() || '',
          // Update contact number from response or local state
          mobile: profileData.contact_number || contactNumber.trim() || user?.mobile || '',
          phone: profileData.contact_number || contactNumber.trim() || user?.mobile || '',
          contact_number: profileData.contact_number || contactNumber.trim() || '',
          // Update profile photo from response or local state
          profilePhotoUrl: profileData.profile_photo || localPhoto || user?.profilePhotoUrl,
          profile_photo: profileData.profile_photo || localPhoto || user?.profilePhotoUrl,
        };
        
        // Update user context
        updateUser(updatedUser);
        
        // Update local state to reflect saved values
        setName(updatedUser.name);
        setBio(updatedUser.bio || '');
        setContactNumber(updatedUser.mobile || '');
        setLocalPhoto(updatedUser.profilePhotoUrl || null);
        
        setIsEditing(false);
        
        toast.success('Profile updated successfully!');
      } else {
        toast.error(response.error || 'Failed to update profile. Please try again.');
      }
    } catch (error: any) {
      console.error('Profile save error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to update profile. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    toast.confirm('Are you sure you want to log out?', {
      onConfirm: async () => {
        await logout();
        navigate('/login');
      },
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
    });
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-main-light dark:text-text-main-dark">Profile</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your profile information</p>
          </div>
          <button
            onClick={handleEditToggle}
            disabled={saving}
            className="px-6 py-2.5 text-primary hover:bg-primary/10 rounded-lg transition-colors font-medium flex items-center gap-2"
          >
            <span className="material-icons-outlined text-lg">{isEditing ? 'close' : 'edit'}</span>
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Profile Photo */}
            <div className="flex-shrink-0">
              <div className="relative group">
                {localPhoto ? (
                  <>
                    <img
                      src={localPhoto}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg"
                    />
                    {isEditing && (
                      <>
                        <button
                          onClick={handlePickPhoto}
                          className="absolute bottom-0 right-0 p-3 bg-primary rounded-full border-4 border-white dark:border-gray-800 shadow-lg hover:bg-primary-dark transition-colors"
                          title="Change Photo"
                        >
                          <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
                        </button>
                        <button
                          onClick={handleDeletePhoto}
                          className="absolute top-0 right-0 p-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 shadow-lg hover:bg-red-600 transition-colors"
                          title="Delete Photo"
                        >
                          <span className="material-symbols-outlined text-white text-sm">delete</span>
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                      {initials}
                    </div>
                    {isEditing && (
                      <button
                        onClick={handlePickPhoto}
                        className="absolute bottom-0 right-0 p-3 bg-primary rounded-full border-4 border-white dark:border-gray-800 shadow-lg hover:bg-primary-dark transition-colors"
                        title="Add Photo"
                      >
                        <span className="material-symbols-outlined text-white text-xl">photo_camera</span>
                      </button>
                    )}
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>

            {/* Profile Info */}
            <div className="flex-1 w-full md:w-auto">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark text-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Number</label>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="Contact number"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark mb-2">{user?.name || 'User'}</h2>
                  <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span className="material-icons-outlined text-lg">phone</span>
                    {user?.mobile || user?.phone || user?.contact_number || 'No contact number'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4 tracking-wide">About</h3>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              {isEditing ? (
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Hey there! I am using OrgIT."
                  className="w-full min-h-[100px] bg-transparent border-none text-text-main-light dark:text-text-main-dark resize-none focus:outline-none"
                />
              ) : (
                <p className="text-text-main-light dark:text-text-main-dark">
                  {user?.bio || user?.about || 'Hey there! I am using OrgIT.'}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4 tracking-wide">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <span className="material-icons-outlined text-gray-400">phone</span>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Contact number</p>
                  <p className="text-text-main-light dark:text-text-main-dark font-medium">
                    {user?.mobile || user?.phone || user?.contact_number || '-'}
                  </p>
                </div>
              </div>
              {user?.email && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <span className="material-icons-outlined text-gray-400">email</span>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                    <p className="text-text-main-light dark:text-text-main-dark font-medium">
                      {user.email}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          {isEditing ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-icons-outlined">save</span>
                  Save changes
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="flex-1 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-icons-outlined">logout</span>
              Log out
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isAdmin) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <EmployeeLayout>{content}</EmployeeLayout>;
};

