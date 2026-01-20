import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  bio: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const UserProfileCreation: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [syncContacts, setSyncContacts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      bio: user?.bio || '',
    },
  });

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const profilePhotoUrl = profilePhoto; // In real app, upload to S3 first
      const response = await authService.setupProfile({
        name: data.name,
        bio: data.bio,
        profilePhotoUrl: profilePhotoUrl || undefined,
      });

      if (response.success && response.data) {
        updateUser(response.data);
        if (syncContacts) {
          // Sync logic
          try {
            await authService.syncContacts({ contacts: [] });
          } catch (e) { console.error(e); }
        }
        navigate('/dashboard');
      } else {
        setError(response.error || 'Failed to save profile');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const formatMobile = (mobile?: string) => {
    if (!mobile) return '+1 555 019 2834'; // Default/Mock if empty
    return `+${mobile.slice(0, 2)} ${mobile.slice(2, 5)} ${mobile.slice(5, 8)} ${mobile.slice(8)}`; // Crude formatting
  };

  // Custom Toggle style
  const toggleStyle = `
    .toggle-checkbox:checked {
        right: 0;
        border-color: #a413ec;
    }
    .toggle-checkbox:checked + .toggle-label {
        background-color: #a413ec;
    }
  `;

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark font-display text-text-main dark:text-gray-100 transition-colors duration-200">
      <style>{toggleStyle}</style>

      {/* TopAppBar */}
      <header className="sticky top-0 z-50 flex items-center bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 pb-2 justify-between border-b border-transparent">
        <button onClick={() => navigate(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-gray-200 dark:active:bg-gray-700 transition-colors text-text-main dark:text-gray-100">
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h2 className="text-text-main dark:text-gray-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">
          Setup Profile
        </h2>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 flex flex-col px-6 pb-24">
        {/* HeadlineText */}
        <div className="pt-4 pb-2">
          <h1 className="text-text-main dark:text-gray-100 tracking-tight text-[28px] font-bold leading-tight text-center">
            Let's get to know you
          </h1>
          {/* BodyText */}
          <p className="text-gray-600 dark:text-gray-300 text-base font-normal leading-normal pt-2 text-center">
            Please complete your profile to connect with your team.
          </p>
        </div>

        {/* ProfileHeader (Photo Upload) */}
        <div className="flex flex-col items-center py-6">
          <div className="relative group cursor-pointer" onClick={handlePhotoClick}>
            {/* Avatar Image */}
            <div
              className="bg-center bg-no-repeat bg-cover rounded-full h-32 w-32 shadow-md border-4 border-white dark:border-[#2d1b36] bg-gray-200 dark:bg-gray-700"
              style={{ backgroundImage: `url(${profilePhoto || "https://lh3.googleusercontent.com/aida-public/AB6AXuDpVrjWG1e0Jsm9w9Yw-ZdsqhykKtN0bUmUYNwSuWeFN0HP4uprZ7I-Tp9IWwvBxkv9JEefN7Aeb9QDGkRjQ5YHQ3DTVFRRBF5V4lkqp0fw9yvW8BWEsimAcwSQovBSJkOFbXcTKHJYuamfQbFqetiUfEkwMAoTb8thrRyHViQHcBMWdcxNTaRJG_o2tQuvzhhBwiUcnqUMI6wjAUT26GDnCnTXBtofcNfIf9Wilj47Tj6SDULV3v1nB65qp1hXIpTA0Q0_RSnpFVTA"})` }}
            >
            </div>
            {/* Camera Badge */}
            <div className="absolute bottom-0 right-0 p-2 bg-primary rounded-full border-[3px] border-background-light dark:border-background-dark flex items-center justify-center shadow-lg transition-transform transform active:scale-95">
              <span className="material-symbols-outlined text-white text-[20px]">photo_camera</span>
            </div>
          </div>
          <p className="text-primary font-semibold mt-3 text-sm cursor-pointer" onClick={handlePhotoClick}>Change Photo</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 w-full">
          {/* Full Name (Mandatory) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-main dark:text-gray-100 text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
            <input
              {...register('name')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-surface-light dark:bg-[#2d1b36] px-4 py-3.5 text-base text-text-main dark:text-gray-100 placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-shadow"
              placeholder="e.g. Jane Doe"
              type="text"
            />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>

          {/* Mobile Number (Locked) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-main dark:text-gray-100 text-sm font-medium">Mobile Number</label>
            <div className="relative">
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-4 py-3.5 text-base text-gray-500 dark:text-gray-400 cursor-not-allowed"
                disabled
                type="tel"
                value={formatMobile(user?.mobile)}
                readOnly
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">lock</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 px-1">Verified via OTP</p>
          </div>

          {/* Bio (Optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-text-main dark:text-gray-100 text-sm font-medium">Bio <span className="text-gray-400 font-normal">(Optional)</span></label>
            <textarea
              {...register('bio')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-surface-light dark:bg-[#2d1b36] px-4 py-3 text-base text-text-main dark:text-gray-100 placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none resize-none transition-shadow"
              placeholder="Tell us a bit about your role..."
              rows={3}
            ></textarea>
          </div>

          {/* Permission Card */}
          <div className="mt-2 rounded-xl border border-primary/20 bg-surface-light dark:bg-[#2d1b36] p-4 shadow-sm flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined">contacts</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-text-main dark:text-gray-100">Sync Contacts</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">Find your team members easily.</p>
            </div>
            {/* Toggle Switch */}
            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
              <input
                checked={syncContacts}
                onChange={(e) => setSyncContacts(e.target.checked)}
                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:border-primary transition-all duration-300 z-10"
                id="toggle"
                name="toggle"
                type="checkbox"
              />
              <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer" htmlFor="toggle"></label>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </main>

      {/* Bottom Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 max-w-md mx-auto z-40">
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={isLoading}
          className="w-full rounded-full bg-primary py-4 text-white font-bold text-lg shadow-lg shadow-primary/30 active:scale-[0.98] transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-70"
        >
          {isLoading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
};
