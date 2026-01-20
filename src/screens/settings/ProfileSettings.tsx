import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';

export const ProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || user?.about || '');
  const [phone] = useState(user?.mobile || user?.phone || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(user?.profilePhotoUrl || user?.profile_photo || null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickImage = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const response = await authService.uploadProfilePhoto(file);
      if (response.success && response.data?.url) {
        setProfilePhoto(response.data.url);
        updateUser({ ...user, profilePhotoUrl: response.data.url });
        alert('Profile photo updated successfully');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload profile photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        about: bio.trim(),
      });

      if (response.success && response.data) {
        updateUser({ ...user, name: name.trim(), bio: bio.trim() });
        alert('Profile updated successfully');
        navigate(-1);
      }
    } catch (error: any) {
      console.error('Update error:', error);
      alert(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-main-light dark:text-text-main-dark">Profile Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update your profile information and preferences</p>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <span className="material-icons-outlined text-lg">save</span>
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Profile Photo Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-6">
          <h3 className="text-lg font-semibold text-text-main-light dark:text-text-main-dark mb-6">Profile Photo</h3>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="flex-shrink-0">
              <div className="relative">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                    <span className="material-icons-outlined text-6xl text-gray-500">person</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <div className="text-white flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                      <span className="text-sm">Uploading...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 w-full md:w-auto">
              <button
                onClick={pickImage}
                disabled={uploading}
                className="px-6 py-2.5 flex items-center gap-2 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50 font-medium border border-primary/20"
              >
                <span className="material-icons-outlined">camera_alt</span>
                Change Photo
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">JPG, PNG or GIF. Max size 5MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Form Fields Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <h3 className="text-lg font-semibold text-text-main-light dark:text-text-main-dark mb-6">Personal Information</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                disabled
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span className="material-icons-outlined text-sm">info</span>
                Phone number cannot be changed. Contact your administrator for updates.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={5}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark resize-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Share a brief description about yourself</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isAdmin) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <EmployeeLayout>{content}</EmployeeLayout>;
};

