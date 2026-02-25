import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { entityMasterBulkService } from '../../services/entityMasterBulkService';
import AnimatedList from '../../components/shared/AnimatedList';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Show All Settings when user is admin OR when on admin settings route (/admin/settings)
  const isAdmin = user?.role === 'admin' || location.pathname === '/admin/settings';
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const commonSettings = [
    { 
      icon: 'person', 
      title: 'Profile', 
      subtitle: 'Update your profile details', 
      screen: '/settings/profile',
      color: 'blue'
    },
    { 
      icon: 'lock', 
      title: 'Change Password', 
      subtitle: 'Update your password', 
      screen: '/settings/change-password',
      color: 'red'
    },
  ];

  // Eight sections: Entity Master Data, Employees, Departments, Designations, Organisation Structure, Service List, Entity List, Automation & Configurations
  const adminSettingsCards = [
    { 
      icon: 'business', 
      title: 'Entity Master Data', 
      subtitle: 'Name of the Organisation, Short Name, Address, E Mail ID, Web Site, Phone Number, Org Constitution, PAN, GST Number, Depot, Warehouse', 
      screen: '/admin/entity-master',
      color: 'purple'
    },
    { 
      icon: 'group', 
      title: 'Employees', 
      subtitle: 'NAME OF THE EMPLOYEE, MOBILE NUMBER, DESIGNATON, REPORTING TO, LEVEL', 
      screen: '/admin/users',
      color: 'blue'
    },
    { 
      icon: 'domain', 
      title: 'Departments', 
      subtitle: 'Manage business units', 
      screen: '/admin/settings/departments',
      color: 'green'
    },
    { 
      icon: 'badge', 
      title: 'Designations', 
      subtitle: 'Job titles & levels', 
      screen: '/admin/settings/designations',
      color: 'orange'
    },
    { 
      icon: 'account_tree', 
      title: 'Organisation Structure', 
      subtitle: 'Overall org structure view', 
      screen: '/admin/settings/organisation-structure',
      color: 'indigo'
    },
    { 
      icon: 'list_alt', 
      title: 'Service List', 
      subtitle: 'RECURRING TASK TITLE/SERVICE LIST, FREQUENCY, TASK ROLL OUT, ONE TIME TASK LIST', 
      screen: '/admin/services',
      color: 'teal'
    },
    { 
      icon: 'groups', 
      title: 'Entity List', 
      subtitle: 'NAME OF THE CLIENT, ENTITY TYPE, COST CENTRE, GSTR & compliance fields', 
      screen: '/admin/entities',
      color: 'pink'
    },
    { 
      icon: 'settings', 
      title: 'Automation & Configurations', 
      subtitle: 'Reminder configuration & auto escalation rules', 
      screen: '/admin/settings/reminder-config',
      color: 'cyan'
    },
  ];

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await entityMasterBulkService.getTemplate();
      toast.success('OrgIt Settings template downloaded. Contains: Entity Master, Entity List, Service List, Employees, Cost Centres, Branches. Fill and upload to bulk update.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: async (res) => {
        const data = res.data?.data;
        if (!data?.uploadId) {
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
          return;
        }
        try {
          const status = await entityMasterBulkService.pollUntilDone(data.uploadId);
          if (status.status === 'completed') {
            toast.success('Settings bulk upload completed.');
          } else {
            toast.warning('Bulk upload finished with errors.');
          }
          if (status.errors?.length) {
            status.errors.slice(0, 5).forEach((e: any) => toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`));
            if (status.errors.length > 5) toast.error(`… and ${status.errors.length - 5} more errors`);
          }
        } catch (err: any) {
          toast.error(err?.message || 'Failed to get upload status');
        }
        queryClient.invalidateQueries('admin-organization');
        queryClient.invalidateQueries(['client-entities']);
        queryClient.invalidateQueries('employees');
        queryClient.invalidateQueries(['task-services']);
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || error.message || 'Upload failed');
      },
    }
  );

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      e.target.value = '';
      return;
    }
    bulkUploadMutation.mutate(file);
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; iconBg: string; border: string; hover: string }> = {
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        iconBg: 'bg-blue-500',
        border: 'border-blue-200 dark:border-blue-800',
        hover: 'hover:border-blue-300 dark:hover:border-blue-700'
      },
      red: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        iconBg: 'bg-red-500',
        border: 'border-red-200 dark:border-red-800',
        hover: 'hover:border-red-300 dark:hover:border-red-700'
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        iconBg: 'bg-purple-500',
        border: 'border-purple-200 dark:border-purple-800',
        hover: 'hover:border-purple-300 dark:hover:border-purple-700'
      },
      green: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        iconBg: 'bg-green-500',
        border: 'border-green-200 dark:border-green-800',
        hover: 'hover:border-green-300 dark:hover:border-green-700'
      },
      orange: {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        iconBg: 'bg-orange-500',
        border: 'border-orange-200 dark:border-orange-800',
        hover: 'hover:border-orange-300 dark:hover:border-orange-700'
      },
      indigo: {
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        iconBg: 'bg-indigo-500',
        border: 'border-indigo-200 dark:border-indigo-800',
        hover: 'hover:border-indigo-300 dark:hover:border-indigo-700'
      },
      teal: {
        bg: 'bg-teal-50 dark:bg-teal-900/20',
        iconBg: 'bg-teal-500',
        border: 'border-teal-200 dark:border-teal-800',
        hover: 'hover:border-teal-300 dark:hover:border-teal-700'
      },
      pink: {
        bg: 'bg-pink-50 dark:bg-pink-900/20',
        iconBg: 'bg-pink-500',
        border: 'border-pink-200 dark:border-pink-800',
        hover: 'hover:border-pink-300 dark:hover:border-pink-700'
      },
      cyan: {
        bg: 'bg-cyan-50 dark:bg-cyan-900/20',
        iconBg: 'bg-cyan-500',
        border: 'border-cyan-200 dark:border-cyan-800',
        hover: 'hover:border-cyan-300 dark:hover:border-cyan-700'
      },
    };
    return colors[color] || colors.blue;
  };

  const SettingCard = ({ icon, title, subtitle, screen, color = 'blue' }: { 
    icon: string; 
    title: string; 
    subtitle: string; 
    screen: string;
    color?: string;
  }) => {
    const colorClasses = getColorClasses(color);
    return (
      <button
        onClick={() => {
          console.log('Navigating to:', screen);
          navigate(screen);
        }}
        className={`w-full flex items-start gap-4 p-5 ${colorClasses.bg} rounded-2xl text-left group transition-all duration-300 ease-out
          border-2 ${colorClasses.border} ${colorClasses.hover}
          shadow-md hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]`}
      >
        <div className={`w-12 h-12 ${colorClasses.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
          <span className="material-icons-outlined text-white text-xl">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1.5 group-hover:text-primary dark:group-hover:text-primary/80 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
            {subtitle}
          </p>
        </div>
        <span className="material-icons-outlined text-gray-400 group-hover:text-primary dark:group-hover:text-primary/80 transition-colors flex-shrink-0">
          chevron_right
        </span>
      </button>
    );
  };

  // Prepare items for AnimatedList
  const allSettingsItems = isAdmin 
    ? [...commonSettings, ...adminSettingsCards]
    : commonSettings;

  const handleSettingSelect = (item: any, index: number) => {
    const selectedItem = allSettingsItems[index];
    if (selectedItem) {
      navigate(selectedItem.screen);
    }
  };

  const content = (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full p-6 md:p-8">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                  <span className="material-icons-outlined text-white text-2xl">settings</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Settings
                </h1>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
                Manage your account settings and preferences. Download <strong className="text-primary">OrgIt Settings</strong> for one workbook with all sheets; individual templates are also available in each module.
              </p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary/50 text-gray-700 dark:text-gray-200 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                >
                  <span className="material-icons-outlined text-[18px]">download</span>
                  {isDownloadingTemplate ? 'Downloading...' : 'Download Template'}
                </button>
                <button
                  type="button"
                  onClick={() => bulkFileInputRef.current?.click()}
                  disabled={bulkUploadMutation.isLoading}
                  className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95"
                >
                  <span className="material-icons-outlined text-[18px]">upload</span>
                  {bulkUploadMutation.isLoading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Settings List with AnimatedList */}
        <div className="space-y-6">
          {/* General Settings Section */}
          {!isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">General Settings</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {commonSettings.map((item, index) => (
                  <SettingCard key={index} {...item} />
                ))}
              </div>
            </div>
          )}

          {/* All Settings with AnimatedList */}
          {isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  All Settings
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({allSettingsItems.length} items)
                </span>
              </div>
              
              <AnimatedList
                items={allSettingsItems.map((item, index) => (
                  <SettingCard key={index} {...item} />
                ))}
                onItemSelect={handleSettingSelect}
                showGradients={true}
                enableArrowNavigation={true}
                displayScrollbar={true}
                className="w-full bg-white dark:bg-slate-800/50 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700"
                itemClassName="hover:scale-[1.01] transition-transform"
              />
            </div>
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
